/**
 * Outbound channel adapter: minimum interface every channel must satisfy.
 * Slack is the only channel shipped in v0.1.
 */
export interface ChannelAdapter {
  postReview(args: {
    reviewId: string
    destination: string
    summary: string
  }): Promise<void>
}
