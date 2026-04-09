import type { SQSEvent } from 'aws-lambda'
import { type ErrorHistoryEntry } from '../domain/task.js'
import { defaultDeps, execute } from '../domain/taskProcessor.js'
import { logger } from '../infrastructure/logger.js'
import { markCompleted, markProcessing, recordAttemptError } from '../infrastructure/taskRepository.js'

export async function handler (event: SQSEvent): Promise<void> {
  const record = event.Records[0]
  const { taskId } = JSON.parse(record.body) as { taskId: string }
  const attempts = Number(record.attributes.ApproximateReceiveCount)

  await markProcessing(taskId, attempts)
  logger.info({ event: 'task.processing_started', taskId, attempt: attempts })

  try {
    await execute({}, defaultDeps)
    await markCompleted(taskId)
    logger.info({ event: 'task.completed', taskId, attempt: attempts })
  } catch (err) {
    const errorType = err instanceof Error ? err.constructor.name : 'UnknownError'
    const message = err instanceof Error ? err.message : String(err)

    const entry: ErrorHistoryEntry = {
      attempt: attempts,
      errorType,
      message,
      timestamp: new Date().toISOString(),
    }

    await recordAttemptError(taskId, entry)
    logger.warn({ event: 'task.attempt_failed', taskId, attempt: attempts, errorType, msg: message })

    throw err
  }
}
