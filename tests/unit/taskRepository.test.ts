import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DuplicateTaskError } from '../../src/domain/errors.js'
import { TaskStatus, type Task } from '../../src/domain/task.js'
import {
  create,
  getById,
  listFailed,
  markCompleted,
  markFailed,
  markProcessing,
  recordAttemptError,
} from '../../src/infrastructure/taskRepository.js'

vi.mock('../../src/config.js', () => ({
  config: {
    tasksTable: 'test-table',
    tasksQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123/test-queue',
    tasksDlqUrl: 'https://sqs.us-east-1.amazonaws.com/123/test-dlq',
  },
}))

const ddbMock = mockClient(DynamoDBDocumentClient)

beforeEach(() => {
  ddbMock.reset()
})

const baseTask: Task = {
  taskId: 'task-1',
  taskStatus: TaskStatus.PENDING,
  payload: { foo: 'bar' },
  attempts: 0,
  errorHistory: [],
  createdAt: '2026-04-09T00:00:00.000Z',
  updatedAt: '2026-04-09T00:00:00.000Z',
}

describe('create', () => {
  it('sends PutCommand with attribute_not_exists condition', async () => {
    ddbMock.on(PutCommand).resolves({})

    await create(baseTask)

    const calls = ddbMock.commandCalls(PutCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({
      TableName: 'test-table',
      Item: baseTask,
      ConditionExpression: 'attribute_not_exists(taskId)',
    })
  })

  it('throws DuplicateTaskError on ConditionalCheckFailedException', async () => {
    const err = Object.assign(new Error('Condition failed'), { name: 'ConditionalCheckFailedException' })
    ddbMock.on(PutCommand).rejects(err)

    await expect(create(baseTask)).rejects.toBeInstanceOf(DuplicateTaskError)
  })

  it('rethrows unexpected errors from DynamoDB', async () => {
    ddbMock.on(PutCommand).rejects(new Error('ServiceUnavailable'))

    await expect(create(baseTask)).rejects.toThrow('ServiceUnavailable')
  })
})

describe('markProcessing', () => {
  it('sends UpdateCommand with IN condition on taskStatus', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    await markProcessing('task-1', 1)

    const calls = ddbMock.commandCalls(UpdateCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({
      TableName: 'test-table',
      Key: { taskId: 'task-1' },
      ConditionExpression: 'taskStatus IN (:pending, :processing)',
    })
  })

  it('sets attempts from the provided value', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    await markProcessing('task-1', 2)

    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input
    expect(input.ExpressionAttributeValues![':attempts']).toBe(2)
  })
})

describe('markCompleted', () => {
  it('sends UpdateCommand with COMPLETED status', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    await markCompleted('task-1')

    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input
    expect(input.ExpressionAttributeValues![':status']).toBe(TaskStatus.COMPLETED)
  })
})

describe('markFailed', () => {
  it('sends UpdateCommand with FAILED status and <> COMPLETED condition', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    await markFailed('task-1')

    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input
    expect(input).toMatchObject({
      TableName: 'test-table',
      Key: { taskId: 'task-1' },
      ConditionExpression: 'taskStatus <> :completed',
    })
    expect(input.ExpressionAttributeValues![':status']).toBe(TaskStatus.FAILED)
    expect(input.ExpressionAttributeValues![':completed']).toBe(TaskStatus.COMPLETED)
  })
})

describe('recordAttemptError', () => {
  it('sends UpdateCommand with list_append on errorHistory', async () => {
    ddbMock.on(UpdateCommand).resolves({})

    const entry = { attempt: 1, errorType: 'SimulatedProcessingError', message: 'fail', timestamp: '2026-04-09T00:00:00.000Z' }
    await recordAttemptError('task-1', entry)

    const input = ddbMock.commandCalls(UpdateCommand)[0].args[0].input
    expect(input.UpdateExpression).toContain('list_append(errorHistory, :entry)')
    expect(input.ExpressionAttributeValues![':entry']).toEqual([entry])
  })
})

describe('getById', () => {
  it('returns the task when found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: baseTask })

    const result = await getById('task-1')
    expect(result).toEqual(baseTask)
  })

  it('returns null when item is not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined })

    const result = await getById('task-1')
    expect(result).toBeNull()
  })
})

describe('listFailed', () => {
  it('queries the GSI with FAILED status', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [baseTask] })

    const result = await listFailed()

    const input = ddbMock.commandCalls(QueryCommand)[0].args[0].input
    expect(input).toMatchObject({
      IndexName: 'taskStatus-updatedAt-index',
      ExpressionAttributeValues: { ':status': TaskStatus.FAILED },
    })
    expect(result).toEqual([baseTask])
  })

  it('returns empty array when no failed tasks exist', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: undefined })

    const result = await listFailed()
    expect(result).toEqual([])
  })
})
