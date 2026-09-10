// The client half of a TikTok SIGN-UP round trip.
//
// Twitch's version of this file explains the mechanism at length and
// `src/lib/linkWait.ts` implements it; what is here is TikTok's storage key and
// TikTok's types.
//
// One difference is worth naming, because it changes what a leak would cost.
// The Twitch flow claims a PROOF — evidence that a channel is yours, useless on
// its own. This one claims a FIREBASE CUSTOM TOKEN, and exchanging that signs
// you in. Hence the single-use burn on the server, the ten-minute expiry, and
// the fact that the token never touches a URL.

import type { TikTokLinkStatus } from '@/lib/api'
import {
  storePendingLink, readPendingLink, clearPendingLink, waitForLink,
  type PendingLink, type WaitOptions,
} from '@/lib/linkWait'

export const TIKTOK_LINK_KEY = 'csgn:tiktokLink'

export type PendingTikTokLink = PendingLink

export const storePendingTikTokLink = (link: PendingTikTokLink): void =>
  storePendingLink(TIKTOK_LINK_KEY, link)

export const readPendingTikTokLink = (): PendingTikTokLink | null =>
  readPendingLink(TIKTOK_LINK_KEY)

export const clearPendingTikTokLink = (): void => clearPendingLink(TIKTOK_LINK_KEY)

export const waitForTikTokLink = (
  link: PendingTikTokLink,
  options: WaitOptions<TikTokLinkStatus>,
): Promise<TikTokLinkStatus | null> => waitForLink(link, options)
