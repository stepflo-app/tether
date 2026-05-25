import { randomUUID } from 'node:crypto'

/**
 * Generate a unique review ID. Prefixed so it is easy to grep for in logs
 * and impossible to confuse with Slack's own IDs.
 */
export function createReviewId(): string {
  return `rv_${randomUUID()}`
}

/**
 * Generate a unique instance ID for this process. Used to detect when a
 * Slack interaction callback lands on the wrong instance (multi-replica or
 * serverless deployments, which are unsupported in v0.1).
 */
export function createInstanceId(): string {
  return `inst_${randomUUID()}`
}
