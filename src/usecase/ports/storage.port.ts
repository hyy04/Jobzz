/**
 * Cổng giao tiếp dịch vụ lưu trữ tệp tin (Clean Architecture ARCH-01)
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-001..005
 */
export interface SaveFileResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StoragePort {
  /**
   * Lưu tệp tin nhị phân vào hệ thống lưu trữ
   */
  saveFile(
    fileBuffer: Buffer,
    mimeType: string,
    originalFilename?: string
  ): Promise<SaveFileResult>;
}
