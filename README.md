# Async Task Processor

A small, reliable asynchronous task processing service built on AWS serverless infrastructure.
Accepts tasks via HTTP, processes them asynchronously with simulated failures, retries up to
3 times via SQS redrive, and finalizes permanently failed tasks in a DLQ.

## Architecture

```
POST /tasks ──► API Gateway HTTP API
                     │
                     ▼
              submitTask (λ)
          validate → DynamoDB (PENDING)
               └──► SQS tasks-queue
                         │
                         ▼
                  processTask (λ)
               PENDING → PROCESSING
               simulate (~30% fail)
               → COMPLETED / throw
                         │
                         │ throw (×3 total)
                         ▼
                  SQS tasks-dlq
                         │
                         ▼
                   handleDlq (λ)
                   → FAILED

GET /tasks/:taskId ──► getTask (λ)
                       → current task state
```

Four Lambda functions, one DynamoDB table with a GSI, one SQS queue with a DLQ.

### Components

| Component | Responsibility |
|-----------|---------------|
| `submitTask` | Validate input, store task as `PENDING`, enqueue to SQS, return `202` |
| `getTask` | Return current task state by `taskId` |
| `processTask` | Consume SQS messages, simulate work, mark `COMPLETED` or re-throw for retry |
| `handleDlq` | Consume DLQ messages after max retries, mark task as `FAILED` |
| `taskRepository` | DynamoDB adapter — all state transitions go through here |
| `taskQueue` | SQS adapter — enqueue only |
| `taskProcessor` | Pure domain module — simulated work with 30% failure rate |
| `logger` | Structured JSON logger — all events include `taskId`, `event`, `level` |

### Task State Transitions

```
PENDING ──► PROCESSING ──► COMPLETED
                │
                │ (throw × maxReceiveCount)
                ▼
              [SQS DLQ]
                │
                ▼
             FAILED
```

Each state has exactly one owner. `submitTask` writes `PENDING`. `processTask` writes
`PROCESSING` and `COMPLETED`. `handleDlq` is the sole writer of `FAILED`.

## Quick Start

See the [Deployment Guide](docs/deployment.md) for step-by-step instructions including
AWS credentials setup, IAM policy, deploy and teardown.

```bash
npm install
npx serverless deploy --stage dev
npm test
```

## Further Reading

- [Deployment Guide](docs/deployment.md) — AWS IAM setup, deploy, test, teardown
- [Architecture Details](docs/architecture.md) — project structure, data model, IAM per function
- [Retry Strategy](docs/retry-strategy.md) — SQS redrive, timing parameters, design trade-offs
- [Known Limitations](docs/known-limitations.md) — conscious trade-offs and next steps
