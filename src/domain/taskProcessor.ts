import { SimulatedProcessingError } from './errors.js'

const FAILURE_RATE = 0.3
const SIMULATED_WORK_DELAY_MS = 200

interface ProcessorDeps {
  sleep: (ms: number) => Promise<void>
  random: () => number
}

export const defaultDeps: ProcessorDeps = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: Math.random,
}

export async function execute (
  payload: Record<string, unknown>,
  deps: ProcessorDeps = defaultDeps,
): Promise<void> {
  await deps.sleep(SIMULATED_WORK_DELAY_MS)

  if (deps.random() < FAILURE_RATE) {
    throw new SimulatedProcessingError()
  }
}
