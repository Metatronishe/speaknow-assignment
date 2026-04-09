export class ValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class SimulatedProcessingError extends Error {
  constructor (message = 'Simulated processing failure') {
    super(message)
    this.name = 'SimulatedProcessingError'
  }
}

export class DuplicateTaskError extends Error {
  constructor (taskId: string) {
    super(`Task already exists: ${taskId}`)
    this.name = 'DuplicateTaskError'
  }
}
