import { describe, expect, it, vi } from 'vitest'
import { SimulatedProcessingError } from '../../src/domain/errors.js'
import { execute } from '../../src/domain/taskProcessor.js'

const noopSleep = vi.fn().mockResolvedValue(undefined)

describe('execute', () => {
  it('resolves when random result is above failure threshold', async () => {
    await expect(execute({}, { sleep: noopSleep, random: () => 0.9 })).resolves.toBeUndefined()
  })

  it('resolves when random result is exactly at failure threshold', async () => {
    await expect(execute({}, { sleep: noopSleep, random: () => 0.3 })).resolves.toBeUndefined()
  })

  it('throws SimulatedProcessingError when random result is below failure threshold', async () => {
    await expect(execute({}, { sleep: noopSleep, random: () => 0.1 })).rejects.toBeInstanceOf(SimulatedProcessingError)
  })

  it('throws SimulatedProcessingError when random returns zero', async () => {
    await expect(execute({}, { sleep: noopSleep, random: () => 0 })).rejects.toBeInstanceOf(SimulatedProcessingError)
  })

  it('calls sleep once per execution', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    await execute({}, { sleep, random: () => 0.9 })
    expect(sleep).toHaveBeenCalledOnce()
  })
})
