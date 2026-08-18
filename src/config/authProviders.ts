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
