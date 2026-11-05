import type { Asset } from 'react-native-image-picker';

import { db } from './database';
import { saveReportImages, deleteReportImages } from '../utils/image-storage';
import { ReviewStatus, StoredReport, UploadStatus } from '../types';

export interface CreateLocalReportInput {
  id: string;
  description: string;
  images: Asset[];
}

export interface LocalReport {
  id: string;
  description: string;
  imagePaths: string[];
  uploadStatus: string;
  createdAt: string;
}

interface ReportDatabaseRow {
  id: string;
  description: string;
  image_paths: string;
  upload_status: UploadStatus;
  review_status: ReviewStatus;
  created_at: string;
  updated_at: string;
  uploaded_at: string | null;
  server_id: string | null;
  upload_attempts: number;
  last_error: string | null;
}

export async function createLocalReport(
  input: CreateLocalReportInput,
): Promise<LocalReport> {
  const { id, description, images } = input;

  const trimmedDescription = description.trim();

  if (!id.trim()) {
    throw new Error('Report ID is required.');
  }

  if (!trimmedDescription) {
    throw new Error('Report description is required.');
  }

  if (images.length < 1 || images.length > 5) {
    throw new Error('A report must contain between 1 and 5 images.');
  }

  // Step 1: Copy compressed images into permanent storage.
  const savedImages = await saveReportImages(id, images);

  const imagePaths = savedImages.map(image => {
    if (!image.uri) {
      throw new Error('A saved image is missing its URI.');
    }

    return image.uri;
  });

  const now = new Date().toISOString();

  try {
    // Step 2: Save the report in SQLite.
    await db.transaction(async tx => {
      await tx.execute(
        `
          INSERT INTO reports (
            id,
            description,
            image_paths,
            upload_status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?);
        `,
        [
          id,
          trimmedDescription,
          JSON.stringify(imagePaths),
          'pending',
          now,
          now,
        ],
      );
    });

    // Step 3: Return the locally saved report.
    return {
      id,
      description: trimmedDescription,
      imagePaths,
      uploadStatus: 'pending',
      createdAt: now,
    };
  } catch (error) {
    // Step 4: Remove copied images if SQLite insertion fails.
    try {
      await deleteReportImages(id);
    } catch (cleanupError) {
      console.error('Failed to clean up report images:', cleanupError);
    }

    throw error;
  }
}

export async function getLocalReports(): Promise<StoredReport[]> {
  const result = await db.execute(`
    SELECT *
    FROM reports
    ORDER BY created_at DESC;
  `);

  const rows = result.rows as unknown as ReportDatabaseRow[];

  return rows.map(row => {
    const imagePaths: unknown = JSON.parse(row.image_paths);

    if (
      !Array.isArray(imagePaths) ||
      !imagePaths.every(path => typeof path === 'string')
    ) {
      throw new Error(`Invalid image paths for report ${row.id}.`);
    }

    return {
      id: row.id,
      description: row.description,
      imagePaths,
      uploadStatus: row.upload_status,
      reviewStatus: row.review_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      uploadedAt: row.uploaded_at,
      serverId: row.server_id,
      uploadAttempts: row.upload_attempts,
      lastError: row.last_error,
    };
  });
}
