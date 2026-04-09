import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { DuplicateTaskError } from '../domain/errors.js'
import { type Task, TaskStatus } from '../domain/task.js'
import { logger } from '../infrastructure/logger.js'
import { create } from '../infrastructure/taskRepository.js'
import { enqueue } from '../infrastructure/taskQueue.js'
import { submitTaskSchema } from '../validation/submitTaskSchema.js'

function json (statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export async function handler (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let parsed: unknown
  try {
    parsed = JSON.parse(event.body ?? '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const result = submitTaskSchema.safeParse(parsed)
  if (!result.success) {
    logger.warn({ event: 'task.validation_failed', msg: JSON.stringify(result.error.issues) })
    return json(400, { error: 'Validation failed', issues: result.error.issues })
  }

  const { taskId, payload } = result.data
  const now = new Date().toISOString()
  const task: Task = {
    taskId,
    taskStatus: TaskStatus.PENDING,
    payload,
    attempts: 0,
    errorHistory: [],
    createdAt: now,
    updatedAt: now,
  }

  try {
    await create(task)
  } catch (err) {
    if (err instanceof DuplicateTaskError) {
      logger.warn({ event: 'task.duplicate', taskId })
      return json(409, { error: `Task already exists: ${taskId}` })
    }
    throw err
  }

  await enqueue(taskId)
  logger.info({ event: 'task.submitted', taskId })

  return json(202, { taskId, taskStatus: TaskStatus.PENDING })
}
