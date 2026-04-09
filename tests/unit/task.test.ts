import { describe, expect, it } from 'vitest'
import { TaskStatus, isLegalTransition } from '../../src/domain/task.js'

describe('isLegalTransition', () => {
  it('PENDING → PROCESSING is legal', () => {
    expect(isLegalTransition(TaskStatus.PENDING, TaskStatus.PROCESSING)).toBe(true)
  })

  it('PENDING → FAILED is legal', () => {
    expect(isLegalTransition(TaskStatus.PENDING, TaskStatus.FAILED)).toBe(true)
  })

  it('PENDING → COMPLETED is illegal', () => {
    expect(isLegalTransition(TaskStatus.PENDING, TaskStatus.COMPLETED)).toBe(false)
  })

  it('PROCESSING → COMPLETED is legal', () => {
    expect(isLegalTransition(TaskStatus.PROCESSING, TaskStatus.COMPLETED)).toBe(true)
  })

  it('PROCESSING → PROCESSING is legal (re-delivery idempotency)', () => {
    expect(isLegalTransition(TaskStatus.PROCESSING, TaskStatus.PROCESSING)).toBe(true)
  })

  it('PROCESSING → FAILED is legal', () => {
    expect(isLegalTransition(TaskStatus.PROCESSING, TaskStatus.FAILED)).toBe(true)
  })

  it('COMPLETED → any transition is illegal', () => {
    for (const target of Object.values(TaskStatus)) {
      expect(isLegalTransition(TaskStatus.COMPLETED, target)).toBe(false)
    }
  })

  it('FAILED → any transition is illegal', () => {
    for (const target of Object.values(TaskStatus)) {
      expect(isLegalTransition(TaskStatus.FAILED, target)).toBe(false)
    }
  })
})
