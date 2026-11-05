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
