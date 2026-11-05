import { type Asset } from 'react-native-image-picker';

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  WAITING = 'waiting',
  FAILED = 'failed',
}

export type ReportsTab = 'queue' | 'all';

export interface CreateReportDraft {
  description: string;
  images: Asset[];
}
