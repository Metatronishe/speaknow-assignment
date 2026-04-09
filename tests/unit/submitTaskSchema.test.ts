import { describe, expect, it } from 'vitest'
import { submitTaskSchema } from '../../src/validation/submitTaskSchema.js'

describe('submitTaskSchema', () => {
  it('accepts a valid taskId and payload', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'task-123', payload: { key: 'value' } })
    expect(result.success).toBe(true)
  })

  it('accepts an empty payload object', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'abc', payload: {} })
    expect(result.success).toBe(true)
  })

  it('accepts taskId with underscores and hyphens', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'my_task-01', payload: {} })
    expect(result.success).toBe(true)
  })

  it('rejects an empty taskId', () => {
    const result = submitTaskSchema.safeParse({ taskId: '', payload: {} })
    expect(result.success).toBe(false)
  })

  it('rejects a taskId with spaces', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'task id', payload: {} })
    expect(result.success).toBe(false)
  })

  it('rejects a taskId with special characters', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'task@id!', payload: {} })
    expect(result.success).toBe(false)
  })

  it('rejects a taskId longer than 128 characters', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'a'.repeat(129), payload: {} })
    expect(result.success).toBe(false)
  })

  it('rejects input without taskId', () => {
    const result = submitTaskSchema.safeParse({ payload: {} })
    expect(result.success).toBe(false)
  })

  it('rejects input without payload', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'task-1' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-object payload', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'task-1', payload: 'string' })
    expect(result.success).toBe(false)
  })

  it('rejects an array as payload', () => {
    const result = submitTaskSchema.safeParse({ taskId: 'task-1', payload: [1, 2, 3] })
    expect(result.success).toBe(false)
  })
})
