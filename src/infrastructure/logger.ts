type LogLevel = 'info' | 'warn' | 'error'

interface LogFields {
  event: string
  taskId?: string
  attempt?: number
  errorType?: string
  msg?: string
}

function log (level: LogLevel, fields: LogFields): void {
  console.log(JSON.stringify({ level, ...fields }))
}

export const logger = {
  info: (fields: LogFields) => log('info', fields),
  warn: (fields: LogFields) => log('warn', fields),
  error: (fields: LogFields) => log('error', fields),
}
