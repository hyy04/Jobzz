import { z } from 'zod';

export const ClaimParamSchema = z.object({
  id: z.string().min(1, 'taskId không được để trống'),
});

export type ClaimParam = z.infer<typeof ClaimParamSchema>;

