import { FastifyRequest, FastifyReply } from 'fastify';
import { UploadProofImageUseCase } from '../../../usecase/upload-proof-image.usecase';
import { MissingFileError } from '../../../shared/errors/claim-errors';

/**
 * Controller xử lý tải lên tệp ảnh bằng chứng nhiệm vụ
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-001..005
 */
export class ProofUploadController {
  constructor(private readonly uploadUseCase: UploadProofImageUseCase) {}

  public uploadProofImage = async (request: FastifyRequest, reply: FastifyReply) => {
    let fileBuffer: Buffer | null = null;
    let mimeType = '';
    let originalFilename: string | undefined;

    const contentType = request.headers['content-type'] || '';

    // Trường hợp 1: Nhận Raw Buffer qua Content-Type image/* hoặc application/octet-stream
    if (Buffer.isBuffer(request.body)) {
      fileBuffer = request.body;
      mimeType = contentType.split(';')[0].trim();
      originalFilename = (request.headers['x-filename'] as string) || undefined;
    }
    // Trường hợp 2: Nhận JSON payload chứa base64
    else if (request.body && typeof request.body === 'object') {
      const body = request.body as any;
      if (body.file) {
        let base64Data = body.file as string;
        // Bóc Data URL prefix nếu có (data:image/png;base64,...)
        if (base64Data.includes(';base64,')) {
          const parts = base64Data.split(';base64,');
          mimeType = parts[0].replace('data:', '');
          base64Data = parts[1];
        } else {
          mimeType = body.mime_type || 'image/png';
        }
        fileBuffer = Buffer.from(base64Data, 'base64');
        originalFilename = body.filename;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new MissingFileError();
    }

    const result = await this.uploadUseCase.execute({
      fileBuffer,
      mimeType,
      originalFilename,
    });

    return reply.status(201).send({
      data: {
        file_url: result.fileUrl,
        file_name: result.fileName,
        file_size: result.fileSize,
        mime_type: result.mimeType,
      },
    });
  };
}

