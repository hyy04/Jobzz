import { z } from 'zod';

/**
 * Zod Schemas cho API Quản trị xét duyệt bài nộp của Admin
 * @ears .sdd/features/review-task-submission/SPEC.md#REQ-RTS-001..016
 */

export const listSubmissionsQuerySchema = z.object({
  task_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const submissionParamSchema = z.object({
  claimId: z.string().min(1, 'claimId không được để trống'),
});

export const rejectSubmissionBodySchema = z.object({
  rejection_reason: z
    .string({ required_error: 'Vui lòng cung cấp lý do từ chối bài nộp.' })
    .trim()
    .min(10, 'Lý do từ chối phải có tối thiểu 10 ký tự.')
    .max(500, 'Lý do từ chối không được vượt quá 500 ký tự.'),
});

export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type SubmissionParam = z.infer<typeof submissionParamSchema>;
export type RejectSubmissionBody = z.infer<typeof rejectSubmissionBodySchema>;

