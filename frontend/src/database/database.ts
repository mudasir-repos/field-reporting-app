import { open } from '@op-engineering/op-sqlite';

export const db = open({
  name: 'field-reports.sqlite',
});

export async function initializeDatabase(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY NOT NULL,
      description TEXT NOT NULL,
      image_paths TEXT NOT NULL,

      upload_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
          upload_status IN (
            'pending',
            'uploading',
            'waiting',
            'failed',
            'uploaded'
          )
        ),

      review_status TEXT NOT NULL DEFAULT 'not_submitted'
        CHECK (
          review_status IN (
            'not_submitted',
            'under_review',
            'approved',
            'rejected'
          )
        ),

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      uploaded_at TEXT,
      server_id TEXT UNIQUE,
      upload_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_reports_upload_status
    ON reports(upload_status);
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_reports_created_at
    ON reports(created_at);
  `);
}
