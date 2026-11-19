import { z } from 'zod';

export const TaskCategoryEnum = z.enum([
  'APP_INSTALL',
  'ACCOUNT_REGISTRATION',
  'SOCIAL_INTERACTION',
  'REVIEW_RATING',
  'SURVEY',
  'CONTENT_WRITING',
  'OTHER',
]);

export const StepInstructionDtoSchema = z.object({
  step_number: z.number().int().min(1, 'Thứ tự bước phải từ 1 trở lên.'),
  instruction: z.string().min(10, 'Hướng dẫn phải từ 10 ký tự.').max(1000, 'Hướng dẫn tối đa 1,000 ký tự.'),
  target_url: z.string().url('URL không hợp lệ.').optional().nullable(),
  image_url: z.string().optional().nullable(),
});

export const ProofRequirementDtoSchema = z.object({
  id: z.string().optional(),
  proof_type: z.enum(['SCREENSHOT_IMAGE', 'TEXT']),
  title: z.string().min(5, 'Tiêu đề bằng chứng phải từ 5 ký tự.').max(150, 'Tiêu đề tối đa 150 ký tự.'),
  description: z.string().min(10, 'Mô tả bằng chứng phải từ 10 ký tự.').max(1000, 'Mô tả tối đa 1,000 ký tự.'),
  is_required: z.boolean().optional().default(true),
});

export const CreateTaskDtoSchema = z.object({
  title: z.string().min(10, 'Tiêu đề phải từ 10 ký tự.').max(150, 'Tiêu đề tối đa 150 ký tự.'),
  description: z.string().min(20, 'Mô tả phải từ 20 ký tự.').max(5000, 'Mô tả tối đa 5,000 ký tự.'),
  category: TaskCategoryEnum,
  reward_coins: z.number().int().min(1, 'Mức thưởng tối thiểu 1 Xu.').max(500000, 'Mức thưởng tối đa 500,000 Xu.'),
  quota: z.number().int().min(1, 'Số lượng tối thiểu 1 lượt.').max(10000, 'Số lượng tối đa 10,000 lượt.'),
  steps: z.array(StepInstructionDtoSchema).optional().default([]),
  proof_requirements: z.array(ProofRequirementDtoSchema).optional().default([]),
  execution_time_minutes: z.number().int().min(15).max(1440).optional().default(60),
  auto_approval_days: z.number().int().min(1).max(7).optional().default(3),
  auto_publish: z.boolean().optional().default(false),
});

export const UpdateTaskDtoSchema = z.object({
  expected_version: z.number().int().min(1, 'expected_version bắt buộc để kiểm soát xung đột OCC.'),
  title: z.string().min(10).max(150).optional(),
  description: z.string().min(20).max(5000).optional(),
  category: TaskCategoryEnum.optional(),
  reward_coins: z.number().int().min(1).max(500000).optional(),
  quota: z.number().int().min(1).max(10000).optional(),
  steps: z.array(StepInstructionDtoSchema).optional(),
  proof_requirements: z.array(ProofRequirementDtoSchema).optional(),
  execution_time_minutes: z.number().int().min(15).max(1440).optional(),
  auto_approval_days: z.number().int().min(1).max(7).optional(),
});

export const ChangeStatusDtoSchema = z.object({
  action: z.enum(['PUBLISH', 'PAUSE', 'RESUME', 'CLOSE']),
  expected_version: z.number().int().min(1, 'expected_version bắt buộc để kiểm soát xung đột OCC.'),
});

export type CreateTaskDto = z.infer<typeof CreateTaskDtoSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskDtoSchema>;
export type ChangeStatusDto = z.infer<typeof ChangeStatusDtoSchema>;

