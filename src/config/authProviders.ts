/**
 * WHICH SIGN-IN DOORS ARE ACTUALLY OPEN.
 *
 * Google, X and email-link all need console work that cannot be done from this
 * repository: an OAuth client and consent screen in Google Cloud, an app with
 * callback URLs on the X developer portal, and an authorised-domain entry plus
 * an email template in Firebase Auth. `docs/auth-provider-setup.md` is the
 * step-by-step for all three.
 *
 * Until that is done, those buttons are not broken — they are UNBUILT, and the
 * difference matters on screen. A live button that throws
 * `auth/operation-not-allowed` at somebody teaches them the product is broken;
 * a greyed one with "Soon" on it teaches them to come back. So the doors stay
 * visible (they are the plan, and seeing them is reassuring) and stay shut.
 *
 * FLIP THIS TO `true` once the walkthrough is done. That is the whole change —
 * one boolean, no component edits — because a launch switch you have to hunt
 * for is a launch switch that gets flipped at the wrong time.
 */
export const SOCIAL_AUTH_ENABLED = false

/** Shown on each shut door. Kept here so all three say the same thing. */
export const SOCIAL_AUTH_SOON_LABEL = 'Soon'

/**
 * TIKTOK AS A SIGN-UP DOOR.
 *
 * Separate from `SOCIAL_AUTH_ENABLED` because it needs completely different
 * console work and is ready at a different time. Google, X and email-link are
 * Firebase Auth providers — a consent screen and an authorised domain. TikTok
 * is not a Firebase provider at all: the OAuth runs in our own functions and
 * the session comes from a custom token, so what it needs is
 *
 *   1. TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI in
 *      Netlify, and
 *   2. `https://csgn.fun/auth/tiktok` — the LANDING page, not the function —
 *      registered as a redirect URI in the TikTok developer console, and
 *   3. Login Kit approved for the `user.info.basic` and `video.list` scopes.
 *
 * The server refuses cleanly when 1 is missing (`tiktok_not_configured`), so
 * the only thing this flag protects against is a live button that fails on 2
 * or 3 — a redirect mismatch, which is TikTok's least helpful error message.
 *
 * FLIP THIS TO `true` once the console entry is in. See
 * docs/setup-tiktok-and-share.md.
 */
export const TIKTOK_AUTH_ENABLED = false
