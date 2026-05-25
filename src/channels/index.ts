import type { ChannelAdapter } from './types.js'

const adapters = new Map<string, ChannelAdapter>()

/**
 * Register a channel adapter under a channel name. In v0.1 only `'slack'`
 * is meaningful, but the registry shape makes it possible to add `'email'`
 * and `'webhook'` in later versions without changing call sites.
 */
export function setChannelAdapter(channel: string, adapter: ChannelAdapter): void {
  adapters.set(channel, adapter)
}

export function getChannelAdapter(channel: string): ChannelAdapter | undefined {
  return adapters.get(channel)
}

/**
 * Test-only helper.
 */
export function _resetChannelAdaptersForTests(): void {
  adapters.clear()
}

export type { ChannelAdapter } from './types.js'
