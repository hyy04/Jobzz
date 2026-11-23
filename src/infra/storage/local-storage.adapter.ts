import { StoragePort, SaveFileResult } from '../../usecase/ports/storage.port';
import {
  InvalidFileTypeError,
  FileTooLargeError,
} from '../../shared/errors/claim-errors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Adapter lưu trữ tệp cục bộ vào thư mục tĩnh của ứng dụng
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-SUB-001..005
 */
export class LocalStorageAdapter implements StoragePort {
  private readonly uploadDir: string;
  private readonly publicPrefix: string;

  constructor(options?: { uploadDir?: string; publicPrefix?: string }) {
    this.uploadDir =
      options?.uploadDir || path.resolve(process.cwd(), 'public', 'uploads', 'proofs');
    this.publicPrefix = options?.publicPrefix || '/uploads/proofs';

    // Đảm bảo thư mục lưu trữ luôn tồn tại
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  public async saveFile(
    fileBuffer: Buffer,
    mimeType: string,
    originalFilename?: string
  ): Promise<SaveFileResult> {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new InvalidFileTypeError();
    }

    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new FileTooLargeError();
    }

    const ext = this.getExtensionFromMime(mimeType, originalFilename);
    const uniqueId = crypto.randomUUID();
    const fileName = `proof-${uniqueId}${ext}`;
    const targetPath = path.join(this.uploadDir, fileName);

    // Ghi tệp nhị phân xuống đĩa
    await fs.promises.writeFile(targetPath, fileBuffer);

    const fileUrl = `${this.publicPrefix}/${fileName}`;
    return {
      fileUrl,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
    };
  }

  private getExtensionFromMime(mimeType: string, originalFilename?: string): string {
    if (originalFilename) {
      const ext = path.extname(originalFilename).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        return ext === '.jpeg' ? '.jpg' : ext;
      }
    }
    switch (mimeType) {
      case 'image/png':
        return '.png';
      case 'image/jpeg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      default:
        return '.png';
    }
  }
}
