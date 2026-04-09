# Retry Strategy

## Mechanism

Retries are handled natively by the SQS redrive policy — no custom retry loop in application
code.

1. `submitTask` enqueues `{ taskId }` to `TasksQueue`.
2. SQS triggers `processTask`. The handler reads `ApproximateReceiveCount` from the SQS
   record to set the `attempts` field on the task.
3. If `processTask` throws, SQS considers the message unprocessed and redelivers it after
   the visibility timeout expires.
4. After `maxReceiveCount = 3` failed deliveries, SQS automatically moves the message to
   `TasksDlq`.
5. `handleDlq` consumes the DLQ message and writes `taskStatus = FAILED` to DynamoDB —
   guarded by `ConditionExpression: taskStatus <> COMPLETED` to prevent overwriting a
   task that succeeded on a concurrent final attempt.

`processTask` never writes `FAILED` directly. The DLQ handler is the single owner of that
transition.

## Timing Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| SQS `VisibilityTimeout` | 60 s | ≥ 6× Lambda timeout — AWS best practice |
| `processTask` Lambda timeout | 10 s | Simulated work is sub-second |
| `maxReceiveCount` | 3 | 1 initial attempt + 2 retries — matches "retried up to 2 times" |
| `batchSize` | 1 | One message = one invocation — clean 1:1 retry contract |
| DLQ `MessageRetentionPeriod` | 14 days | Maximum retention for post-hoc inspection |
| Main queue `MessageRetentionPeriod` | 4 days | SQS default |

## Design Trade-offs

**Fixed visibility timeout** instead of progressive backoff via `ChangeMessageVisibility`.
For this assignment's low throughput and sub-second simulated work the fixed timeout is
negligible. Progressive backoff is the correct next step for services with transient
downstream failures.

**`batchSize = 1`** instead of `ReportBatchItemFailures` with a larger batch. With batch
sizes greater than 1, a single failed task causes the entire batch to be retried — the
partial batch failure problem. `batchSize = 1` eliminates this at the cost of lower
throughput, which is an acceptable trade-off for this assignment's simplicity framing.
`ReportBatchItemFailures` is the correct approach for production throughput.
