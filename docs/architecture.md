# Architecture Details

## Project Structure

```
task-processing/
├── serverless.yml              # Infrastructure + function definitions
├── src/
│   ├── handlers/               # Lambda entry points (transport layer only)
│   │   ├── submitTask.ts       # POST /tasks → 202 / 400 / 409
│   │   ├── getTask.ts          # GET /tasks/:taskId → 200 / 404
│   │   ├── processTask.ts      # SQS consumer (main queue)
│   │   └── handleDlq.ts        # SQS consumer (DLQ) → FAILED
│   ├── domain/                 # Business logic — no AWS SDK imports
│   │   ├── task.ts             # TaskStatus enum, Task type, state transition matrix
│   │   ├── taskProcessor.ts    # Simulated work + 30% failure rate, injectable deps
│   │   └── errors.ts           # ValidationError, SimulatedProcessingError, DuplicateTaskError
│   ├── infrastructure/         # AWS adapters
│   │   ├── taskRepository.ts   # DynamoDB: create, markProcessing, markCompleted,
│   │   │                       #   recordAttemptError, markFailed, getById, listFailed
│   │   ├── taskQueue.ts        # SQS: enqueue(taskId)
│   │   └── logger.ts           # Structured JSON logger
│   ├── validation/
│   │   └── submitTaskSchema.ts # Zod schema for POST /tasks body
│   └── config.ts               # Env var loading, fail-fast on missing vars at cold start
└── tests/
    └── unit/                   # Vitest unit tests, aws-sdk-client-mock
```

## Domain / Infrastructure Boundary

`src/domain/` contains no AWS SDK imports. All infrastructure access (DynamoDB, SQS) goes
through adapters in `src/infrastructure/`. This keeps business logic independently testable
and decoupled from the AWS runtime.

`taskProcessor.ts` accepts injectable `sleep` and `random` functions, making the 30% failure
simulation fully deterministic in unit tests without mocking timers or global state.

## Data Model

**Table `TasksTable`** — single table, PK `taskId` (String), billing mode `PAY_PER_REQUEST`.

| Field | Type | Notes |
|-------|------|-------|
| `taskId` | S (PK) | From request body |
| `taskStatus` | S | `PENDING` / `PROCESSING` / `COMPLETED` / `FAILED` |
| `payload` | M | Original JSON payload from request |
| `attempts` | N | Set from `ApproximateReceiveCount` on each `markProcessing` call |
| `lastError` | S | Message of the most recent error |
| `errorHistory` | L | Up to 3 entries: `{ attempt, errorType, message, timestamp }` |
| `createdAt` | S (ISO) | Set at `PutItem` |
| `updatedAt` | S (ISO) | Updated on every write |
| `completedAt` | S (ISO) | Set on `COMPLETED` or `FAILED` |

**GSI `taskStatus-updatedAt-index`** — PK `taskStatus`, SK `updatedAt`. Used by
`taskRepository.listFailed` to query failed tasks sorted by most recent first.

`taskStatus` is used as the attribute name instead of `status` to avoid the DynamoDB
reserved word, eliminating the need for `ExpressionAttributeNames` aliases in queries.

## IAM Permissions (least-privilege per function)

| Function | DynamoDB | SQS |
|----------|----------|-----|
| `submitTask` | `PutItem` | `SendMessage` on `TasksQueue` |
| `getTask` | `GetItem` | — |
| `processTask` | `UpdateItem` | — |
| `handleDlq` | `UpdateItem` | — |

Per-function IAM is implemented via the `serverless-iam-roles-per-function` plugin.
Each function receives only the permissions it directly uses.

## State Transition Ownership

| Transition | Owner | DynamoDB operation |
|------------|-------|--------------------|
| `→ PENDING` | `submitTask` | `PutItem` with `attribute_not_exists(taskId)` |
| `→ PROCESSING` | `processTask` | `UpdateItem` with `taskStatus IN (PENDING, PROCESSING)` |
| `→ COMPLETED` | `processTask` | `UpdateItem` |
| `→ FAILED` | `handleDlq` | `UpdateItem` with `taskStatus <> COMPLETED` |

The condition on `→ FAILED` prevents a race where a late successful DynamoDB write and a
concurrent DLQ delivery could overwrite `COMPLETED` with `FAILED`.
