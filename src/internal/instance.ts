import { createInstanceId } from './id.js'

/**
 * Process-local instance identifier. Computed once, at module load.
 *
 * The Slack interaction helper uses this to detect cross-process callbacks:
 * if a callback lands on a Node process whose `INSTANCE_ID` does not match
 * the `ownerInstanceId` stored on the review record, the deployment shape
 * is unsupported in v0.1 and we fail loudly.
 */
export const INSTANCE_ID: string = createInstanceId()
