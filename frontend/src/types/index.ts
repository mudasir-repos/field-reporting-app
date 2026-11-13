import { type Asset } from 'react-native-image-picker';

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  WAITING = 'waiting',
  FAILED = 'failed',
  UPLOADED = 'uploaded',
}

export type ReportsTab = 'queue' | 'all';

export type ReviewStatus =
  | 'not_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface CreateReportDraft {
  description: string;
  images: Asset[];
}

export interface StoredReport {
  id: string;
  description: string;
  imagePaths: string[];
  uploadStatus: UploadStatus;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string | null;
  serverId: string | null;
  uploadAttempts: number;
  lastError: string | null;
}

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

export interface UpdateReportStatusInput {
  uploadStatus: UploadStatus;
  /** New cumulative attempt count. Pass to increment after each try. */
  uploadAttempts?: number;
  /** Set to null to clear a previous error; omit to leave unchanged. */
  lastError?: string | null;
  /** Set once the server confirms receipt. */
  serverId?: string | null;
  /** ISO timestamp of successful upload. */
  uploadedAt?: string | null;
}

export interface ReportDatabaseRow {
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

export interface ServerReport {
  id: string;
  description: string;
  createdAt: string;
  imagePaths: string[];
  imageUrls: string[];
  receivedAt: string;
}

export interface ServerSuccessResponse {
  message: string;
  report: ServerReport;
}

export interface GetReportsResponse {
  count: number;
  reports: ServerReport[];
}


