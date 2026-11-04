import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const dataDirectory = path.resolve(process.cwd(), 'data');

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = path.join(dataDirectory, 'reports.db');

const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL
      CHECK (length(trim(description)) > 0),
    created_at TEXT NOT NULL,
    image_paths TEXT NOT NULL
      CHECK (
        json_valid(image_paths)
        AND json_type(image_paths) = 'array'
        AND json_array_length(image_paths) BETWEEN 1 AND 5
      ),
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;
