import { z } from 'zod';

/**
 * DTO kiểm tra dữ liệu yêu cầu nộp bằng chứng nhiệm vụ
 * @ears .sdd/features/submit-task-proof/SPEC.md#REQ-STP-006..014
 */

export const SubmitProofItemDtoSchema = z.object({
  requirement_id: z.string().min(1, 'Mã yêu cầu bằng chứng (requirement_id) không được để trống'),
  value: z.string().min(1, 'Nội dung bằng chứng (value) không được để trống'),
});

export const SubmitProofBodyDtoSchema = z.object({
  proofs: z.array(SubmitProofItemDtoSchema).min(1, 'Danh sách bằng chứng phải có ít nhất 1 mục'),
});

export const ClaimParamDtoSchema = z.object({
  claimId: z.string().min(1, 'Mã lượt nhận việc (claimId) không được để trống'),
});

export type SubmitProofBodyDto = z.infer<typeof SubmitProofBodyDtoSchema>;
export type ClaimParamDto = z.infer<typeof ClaimParamDtoSchema>;

