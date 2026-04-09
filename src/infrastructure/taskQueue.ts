import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { config } from '../config.js'

const sqsClient = new SQSClient({})

export async function enqueue (taskId: string): Promise<void> {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: config.tasksQueueUrl,
    MessageBody: JSON.stringify({ taskId }),
  }))
}
