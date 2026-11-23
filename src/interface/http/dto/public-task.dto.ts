import { z } from 'zod';

const TaskCategoryEnum = z.enum([
  'APP_INSTALL',
  'ACCOUNT_REGISTRATION',
  'SOCIAL_INTERACTION',
  'REVIEW_RATING',
  'SURVEY',
  'CONTENT_WRITING',
  'OTHER',
]);

export const PublicTaskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page phải là số nguyên >= 1').default(1),
  limit: z.coerce.number().int().min(1, 'limit phải >= 1').max(100, 'limit tối đa 100').default(20),
  category: TaskCategoryEnum.optional(),
  sort_by: z.enum(['LATEST', 'REWARD_DESC']).default('LATEST'),
});

export const TaskIdParamSchema = z.object({
  id: z.string().min(1, 'taskId không được để trống'),
});

export type PublicTaskListQuery = z.infer<typeof PublicTaskListQuerySchema>;
export type TaskIdParam = z.infer<typeof TaskIdParamSchema>;

