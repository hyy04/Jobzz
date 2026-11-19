import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../shared/errors/domain.error';
import { ZodError } from 'zod';

/**
 * Xử lý lỗi tập trung cho toàn bộ ứng dụng Fastify (Error Handling Contract ENG-02)
 */
export function globalErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  // 1. Bắt các lỗi nghiệp vụ DomainError
  if (error instanceof DomainError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message,
      },
    });
  }

  // 2. Bắt lỗi kiểm tra định dạng ZodError
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đầu vào không hợp lệ theo định dạng Schema.',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // 3. Fastify built-in validation error
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    });
  }

  // 4. Lỗi máy chủ không xác định
  const statusCode = (error as FastifyError).statusCode || 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Đã xảy ra sự cố nội bộ trên hệ thống.',
    },
  });
}

