# Known Limitations

These are conscious trade-offs documented for the reviewer, not oversights.

## ApproximateReceiveCount for attempt tracking

The `attempts` field is set from SQS's `ApproximateReceiveCount` message attribute, which
is approximate by design. In rare edge cases (SQS infrastructure hiccups, long visibility
timeouts) the counter may be off by one. For the 3-attempt window of this assignment this
is acceptable. A DynamoDB atomic counter (`ADD attempts 1`) would be the precise alternative
at the cost of an additional write per attempt.

## Simulation not idempotent on infrastructure failure

If `markCompleted` (the DynamoDB write after successful simulation) fails, SQS redelivers
the message and the simulation runs again. A task that already "succeeded" in the simulation
may fail on retry and eventually land in `FAILED`. An idempotency check at the start of
`processTask` (read current `taskStatus`, skip if already `COMPLETED`) would fix this.
Deferred as out of scope.

## Inline error history

Up to 3 error entries are stored directly in the task DynamoDB item (bounded by
`maxReceiveCount = 3`). A separate `task_events` table with per-event TTL would be the
correct approach if history retention, analytics, or independent lifetimes were required.

## Fixed visibility timeout

Retries use a fixed 60 s visibility timeout. Progressive backoff via
`ChangeMessageVisibility` is the correct next step for services with transient downstream
failures. See [Retry Strategy](retry-strategy.md) for full rationale.

## batchSize = 1

Higher throughput requires `ReportBatchItemFailures` with a larger batch size and per-message
failure reporting. See [Retry Strategy](retry-strategy.md).

## reservedConcurrency omitted

`processTask` would ideally run with `reservedConcurrency: 5` to prevent accidental
account-wide Lambda scaling. This setting requires the account's unreserved concurrency to
remain above 10 (AWS minimum). The deployment account has a total limit of 10 concurrent
executions, making the setting impossible to apply. In a standard AWS account (default limit
1000) this would be set.

## No CloudWatch Alarms

DLQ depth and Lambda error rate are not alarmed. Alerting on `ApproximateNumberOfMessagesVisible`
on the DLQ is the obvious first production step after deployment.

## No authentication, rate limiting, or WAF

The HTTP API is intentionally open — the assignment explicitly excludes authentication.
