// Core primitive
export { draft } from './draft.js'
export type {
  DraftConfig,
  DraftResult,
  DraftReviewConfig,
} from './draft.js'

// Errors
export { TetherError } from './errors.js'
export type { TetherErrorCode } from './errors.js'

// Channels
export { setChannelAdapter, getChannelAdapter } from './channels/index.js'
export type { ChannelAdapter } from './channels/index.js'
export { createSlackAdapter } from './channels/slack.js'
export type { SlackChannelAdapter, CreateSlackAdapterOptions } from './channels/slack.js'

// State
export {
  setStateAdapter,
  getStateAdapter,
  createMemoryAdapter,
  TERMINAL_RECORD_TTL_MS,
} from './state/index.js'
export type { StateAdapter, StoredReviewRecord } from './state/index.js'

// Internals occasionally useful for advanced integration / testing
export { INSTANCE_ID } from './internal/instance.js'

// One-time runtime warning so deployments to multi-replica / serverless
// surfaces see the limitation in their logs even if they skipped the README.
;(() => {
  if (process.env.TETHER_SUPPRESS_DEPLOYMENT_WARNING === '1') return
  console.warn(
    '[tether] v0.1 is single-process only. The Node process that calls draft() must ' +
      'also receive the Slack interaction callback. Multi-replica and serverless ' +
      'deployments are unsupported. Set TETHER_SUPPRESS_DEPLOYMENT_WARNING=1 to silence.',
  )
})()
