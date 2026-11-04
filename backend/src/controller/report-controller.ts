import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

import db from '../config/database.js';

const reportSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  createdAt: z.iso.datetime(),
});

const idempotencyKeySchema = z.uuid();

interface StoredReport {
  id: string;
  description: string;
  created_at: string;
  image_paths: string;
  received_at: string;
}

const getReport = (id: string): StoredReport | undefined => {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as
    | StoredReport
    | undefined;
};

const deleteTemporaryFiles = (files: Express.Multer.File[]) => {
  for (const file of files) {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

const formatReport = (report: StoredReport) => ({
  id: report.id,
  description: report.description,
  createdAt: report.created_at,
  imagePaths: JSON.parse(report.image_paths) as string[],
  receivedAt: report.received_at,
});

export const createReport = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const files = Array.isArray(req.files) ? req.files : [];

  try {
    // Validate the request body.
    const bodyResult = reportSchema.safeParse(req.body);

    if (!bodyResult.success) {
      deleteTemporaryFiles(files);

      return res.status(400).json({
        message: 'Invalid report data.',
        errors: bodyResult.error.issues,
      });
    }

    // Validate the idempotency key.
    const keyResult = idempotencyKeySchema.safeParse(
      req.get('Idempotency-Key'),
    );

    if (!keyResult.success) {
      deleteTemporaryFiles(files);

      return res.status(400).json({
        message: 'A valid Idempotency-Key UUID is required.',
      });
    }

    if (files.length < 1 || files.length > 5) {
      deleteTemporaryFiles(files);

      return res.status(400).json({
        message: 'A report must contain between 1 and 5 images.',
      });
    }

    const { description, createdAt } = bodyResult.data;
    const reportId = keyResult.data;

    // Start an SQLite transaction.
    db.exec('BEGIN IMMEDIATE');

    // Check whether this report has already been received.
    const existingReport = getReport(reportId);

    if (existingReport) {
      db.exec('ROLLBACK');

      deleteTemporaryFiles(files);

      return res.status(200).json({
        message: 'Report already exists.',
        report: formatReport(existingReport),
      });
    }

    // Prepare permanent image storage.
    const reportDirectory = path.resolve(
      process.cwd(),
      'uploads',
      'reports',
      reportId,
    );

    fs.mkdirSync(reportDirectory, { recursive: true });

    const imagePaths = files.map((file) =>
      path.posix.join('uploads', 'reports', reportId, file.filename),
    );

    // Insert report metadata into SQLite.
    db.prepare(
      `
      INSERT INTO reports (
        id,
        description,
        created_at,
        image_paths
      )
      VALUES (?, ?, ?, ?)
    `,
    ).run(reportId, description, createdAt, JSON.stringify(imagePaths));

    // Move images from temporary to permanent storage.
    files.forEach((file) => {
      const destination = path.join(reportDirectory, file.filename);

      fs.renameSync(file.path, destination);
    });

    // Commit only after all images have been moved successfully.
    db.exec('COMMIT');

    return res.status(201).json({
      message: 'Report created successfully.',
      report: formatReport(getReport(reportId)!),
    });
  } catch (error) {
    // Roll back any uncommitted database changes.
    try {
      db.exec('ROLLBACK');
    } catch {
      // No active transaction.
    }

    // Remove temporary files.
    deleteTemporaryFiles(files);

    // Remove partially created permanent files.
    if (files.length > 0) {
      const key = req.get('Idempotency-Key');

      if (key && idempotencyKeySchema.safeParse(key).success) {
        const reportDirectory = path.resolve(
          process.cwd(),
          'uploads',
          'reports',
          key,
        );

        fs.rmSync(reportDirectory, {
          recursive: true,
          force: true,
        });
      }
    }

    next(error);
  }
};

export const getReports = (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = db
      .prepare(
        `
    SELECT * FROM reports
    ORDER BY received_at DESC
  `,
      )
      .all() as unknown as StoredReport[];

    const formattedReports = reports.map((report) => {
      const formatted = formatReport(report);

      return {
        ...formatted,
        imageUrls: formatted.imagePaths.map(
          (imagePath) =>
            `${req.protocol}://${req.get('host')}/${imagePath.replaceAll('\\', '/')}`,
        ),
      };
    });

    return res.status(200).json({
      count: formattedReports.length,
      reports: formattedReports,
    });
  } catch (error) {
    next(error);
  }
};
