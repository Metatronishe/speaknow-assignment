export enum TaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ErrorHistoryEntry {
  attempt: number
  errorType: string
  message: string
  timestamp: string
}

export interface Task {
  taskId: string
  status: TaskStatus
  payload: Record<string, unknown>
  attempts: number
  lastError?: string
  errorHistory: ErrorHistoryEntry[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// Defines which target statuses are reachable from each source status.
// Enforcement of *who* may make a transition is an architectural invariant
// (documented in the design doc), not enforced here.
const LEGAL_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.PROCESSING, TaskStatus.FAILED],
  [TaskStatus.PROCESSING]: [TaskStatus.PROCESSING, TaskStatus.COMPLETED, TaskStatus.FAILED],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.FAILED]: [],
}

export function isLegalTransition (from: TaskStatus, to: TaskStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to)
}
