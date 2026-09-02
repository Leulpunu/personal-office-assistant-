export type DocumentStatus = 'processing' | 'ready' | 'failed';

export type DocumentRecordDTO = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
  createdAt: string;
  status: DocumentStatus;
  extractionError: string | null;
};

export type DocumentSearchResultDTO = DocumentRecordDTO & {
  excerpt: string;
  rank: number;
};
