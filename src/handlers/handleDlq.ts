import type { SQSEvent } from 'aws-lambda'
import { logger } from '../infrastructure/logger.js'
import { markFailed } from '../infrastructure/taskRepository.js'

export async function handler (event: SQSEvent): Promise<void> {
  const record = event.Records[0]
  const { taskId } = JSON.parse(record.body) as { taskId: string }
  const attempts = Number(record.attributes.ApproximateReceiveCount)

  await markFailed(taskId)
  logger.error({ event: 'task.permanently_failed', taskId, attempt: attempts })
}
