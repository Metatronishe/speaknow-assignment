function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  tasksTable: requireEnv('TASKS_TABLE'),
  tasksQueueUrl: requireEnv('TASKS_QUEUE_URL'),
  tasksDlqUrl: requireEnv('TASKS_DLQ_URL'),
} as const
