import { z } from 'zod'

export const submitTaskSchema = z.object({
  taskId: z.string().min(1).max(128).regex(/^[\w\-]+$/, 'taskId must contain only alphanumeric characters, underscores, and hyphens'),
  payload: z.record(z.unknown()),
})

export type SubmitTaskInput = z.infer<typeof submitTaskSchema>
