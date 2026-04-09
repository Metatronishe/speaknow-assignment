import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { config } from '../config.js'
import { DuplicateTaskError } from '../domain/errors.js'
import { type ErrorHistoryEntry, type Task, TaskStatus } from '../domain/task.js'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export async function create (task: Task): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: config.tasksTable,
      Item: task,
      ConditionExpression: 'attribute_not_exists(taskId)',
    }))
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      throw new DuplicateTaskError(task.taskId)
    }
    throw err
  }
}

export async function markProcessing (taskId: string, attempts: number): Promise<void> {
  const now = new Date().toISOString()
  await docClient.send(new UpdateCommand({
    TableName: config.tasksTable,
    Key: { taskId },
    UpdateExpression: 'SET taskStatus = :status, attempts = :attempts, updatedAt = :now',
    ConditionExpression: 'taskStatus IN (:pending, :processing)',
    ExpressionAttributeValues: {
      ':status': TaskStatus.PROCESSING,
      ':attempts': attempts,
      ':now': now,
      ':pending': TaskStatus.PENDING,
      ':processing': TaskStatus.PROCESSING,
    },
  }))
}

export async function markCompleted (taskId: string): Promise<void> {
  const now = new Date().toISOString()
  await docClient.send(new UpdateCommand({
    TableName: config.tasksTable,
    Key: { taskId },
    UpdateExpression: 'SET taskStatus = :status, completedAt = :now, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': TaskStatus.COMPLETED,
      ':now': now,
    },
  }))
}

export async function recordAttemptError (taskId: string, entry: ErrorHistoryEntry): Promise<void> {
  const now = new Date().toISOString()
  await docClient.send(new UpdateCommand({
    TableName: config.tasksTable,
    Key: { taskId },
    UpdateExpression: 'SET updatedAt = :now, lastError = :msg, errorHistory = list_append(errorHistory, :entry)',
    ExpressionAttributeValues: {
      ':now': now,
      ':msg': entry.message,
      ':entry': [entry],
    },
  }))
}

export async function markFailed (taskId: string): Promise<void> {
  const now = new Date().toISOString()
  await docClient.send(new UpdateCommand({
    TableName: config.tasksTable,
    Key: { taskId },
    UpdateExpression: 'SET taskStatus = :status, completedAt = :now, updatedAt = :now',
    ConditionExpression: 'taskStatus <> :completed',
    ExpressionAttributeValues: {
      ':status': TaskStatus.FAILED,
      ':now': now,
      ':completed': TaskStatus.COMPLETED,
    },
  }))
}

export async function getById (taskId: string): Promise<Task | null> {
  const result = await docClient.send(new GetCommand({
    TableName: config.tasksTable,
    Key: { taskId },
  }))
  return (result.Item as Task) ?? null
}

export async function listFailed (): Promise<Task[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: config.tasksTable,
    IndexName: 'taskStatus-updatedAt-index',
    KeyConditionExpression: 'taskStatus = :status',
    ExpressionAttributeValues: { ':status': TaskStatus.FAILED },
    ScanIndexForward: false,
  }))
  return (result.Items as Task[]) ?? []
}
