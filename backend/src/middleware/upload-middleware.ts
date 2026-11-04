import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const temporaryDirectory = path.resolve(process.cwd(), 'uploads', 'temp');

fs.mkdirSync(temporaryDirectory, { recursive: true });

const allowedMimeTypes: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, temporaryDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = allowedMimeTypes[file.mimetype];

    callback(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },

  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes[file.mimetype]) {
      callback(new Error('Unsupported image format.'));
      return;
    }

    callback(null, true);
  },
});

export default upload;
