import { StoragePort, SaveFileResult } from './ports/storage.port';
import { MissingFileError } from '../shared/errors/claim-errors';

export interface UploadProofImageCommand {
  fileBuffer: Buffer;
  mimeType: string;
  originalFilename?: string;
}

/**
 * UseCase: UploadProofImageUseCase
 * Xử lý tải tệp ảnh bằng chứng nhiệm vụ lên máy chủ an toàn
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-001..005
 */
export class UploadProofImageUseCase {
  constructor(private readonly storagePort: StoragePort) {}

  public async execute(command: UploadProofImageCommand): Promise<SaveFileResult> {
    if (!command.fileBuffer || command.fileBuffer.length === 0) {
      throw new MissingFileError();
    }

    return this.storagePort.saveFile(
      command.fileBuffer,
      command.mimeType,
      command.originalFilename
    );
  }
}

