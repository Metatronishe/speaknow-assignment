# Deployment Guide

## Prerequisites

- Node.js 20+ — verify with `node --version`
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) — verify with `aws --version`
- An AWS account with programmatic access (see below)

## Step 1 — Create an IAM Policy

Open [AWS Console → IAM → Policies](https://console.aws.amazon.com/iam/home#/policies) →
**Create policy** → **JSON** tab, paste the following:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudformation:*"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket", "s3:DeleteBucket", "s3:GetBucketLocation",
        "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
        "s3:ListBucket", "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration", "s3:GetBucketPolicy",
        "s3:PutBucketPolicy", "s3:ListBucketVersions",
        "s3:GetBucketVersioning", "s3:PutBucketVersioning"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction", "lambda:DeleteFunction",
        "lambda:GetFunction", "lambda:GetFunctionConfiguration",
        "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration",
        "lambda:AddPermission", "lambda:RemovePermission", "lambda:GetPolicy",
        "lambda:CreateEventSourceMapping", "lambda:DeleteEventSourceMapping",
        "lambda:GetEventSourceMapping", "lambda:ListEventSourceMappings",
        "lambda:TagResource", "lambda:ListTags"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable", "dynamodb:DeleteTable",
        "dynamodb:DescribeTable", "dynamodb:UpdateTable",
        "dynamodb:ListTagsOfResource", "dynamodb:TagResource",
        "dynamodb:DescribeTimeToLive", "dynamodb:UpdateTimeToLive",
        "dynamodb:DescribeContinuousBackups"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:CreateQueue", "sqs:DeleteQueue", "sqs:GetQueueAttributes",
        "sqs:SetQueueAttributes", "sqs:GetQueueUrl",
        "sqs:ListQueues", "sqs:TagQueue"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:PassRole",
        "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy",
        "iam:AttachRolePolicy", "iam:DetachRolePolicy",
        "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
        "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy",
        "iam:GetPolicyVersion", "iam:ListPolicyVersions",
        "iam:TagRole", "iam:ListPolicies"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "apigateway:GET", "apigateway:POST",
        "apigateway:PUT", "apigateway:DELETE", "apigateway:PATCH"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup", "logs:DeleteLogGroup",
        "logs:DescribeLogGroups", "logs:PutRetentionPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

Name it `task-processor-deployer-policy` → **Create policy**.

## Step 2 — Create an IAM User

1. Go to [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → **Create user**
2. Username: `task-processor-deployer`
3. **Permissions** → **Attach policies directly** → select `task-processor-deployer-policy`
4. Create the user → open it → **Security credentials** tab → **Create access key**
5. Use case: **Command Line Interface (CLI)**
6. Save the **Access Key ID** and **Secret Access Key** — the secret is shown only once

## Step 3 — Configure AWS CLI

```bash
aws configure
```

Enter when prompted:

```
AWS Access Key ID:     <your Access Key ID>
AWS Secret Access Key: <your Secret Access Key>
Default region name:   us-east-1
Default output format: json
```

Verify credentials are working:

```bash
aws sts get-caller-identity
```

A JSON response with `UserId`, `Account`, and `Arn` confirms credentials are valid.

## Step 4 — Install Dependencies

```bash
npm install
```

## Step 5 — Deploy

```bash
npx serverless deploy --stage dev
```

The deploy output includes the HTTP API endpoint URL:

```
endpoints:
  POST - https://<api-id>.execute-api.us-east-1.amazonaws.com/tasks
  GET  - https://<api-id>.execute-api.us-east-1.amazonaws.com/tasks/{taskId}
```

If the terminal output is gone, retrieve the endpoint with:

```bash
aws apigatewayv2 get-apis \
  --region us-east-1 \
  --query "Items[?Name=='task-processing-dev'].ApiEndpoint" \
  --output text
```

## Step 6 — Run Tests

Unit tests run locally without AWS credentials — all AWS clients are mocked:

```bash
npm test
```

## Step 7 — Verify the Deployed Service

**Submit a task:**

```bash
curl -X POST https://<api-id>.execute-api.us-east-1.amazonaws.com/tasks \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-001", "payload": {"foo": "bar"}}'
```

Response `202 Accepted`:

```json
{ "taskId": "task-001", "taskStatus": "PENDING" }
```

**Check task status:**

```bash
curl https://<api-id>.execute-api.us-east-1.amazonaws.com/tasks/task-001
```

The status progresses: `PENDING` → `PROCESSING` → `COMPLETED` or `FAILED`.
Since SQS `VisibilityTimeout` is 60 s, allow ~1 minute between retries.

**Error responses:**

| Scenario | Status | Example |
|----------|--------|---------|
| Duplicate `taskId` | `409` | `{ "error": "Task already exists: task-001" }` |
| Invalid input | `400` | `{ "error": "Validation failed", "issues": [...] }` |
| Task not found | `404` | `{ "error": "Task not found: task-001" }` |

## Step 8 — Teardown

To remove all deployed AWS resources:

```bash
npx serverless remove --stage dev
```
