import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getById } from '../infrastructure/taskRepository.js'

function json (statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export async function handler (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const taskId = event.pathParameters?.taskId
  if (!taskId) {
    return json(400, { error: 'Missing taskId' })
  }

  const task = await getById(taskId)
  if (!task) {
    return json(404, { error: `Task not found: ${taskId}` })
  }

  return json(200, task)
}
