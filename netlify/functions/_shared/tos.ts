// Authoritative Terms-of-Service version. The server stamps this onto the user
// doc (acceptedTosAt + tosVersion) whenever a user accepts, so the recorded
// version cannot be spoofed by the client. Bump this string when the ToS text
// materially changes (mirrored for display only in src/lib/tos.ts).
export const TOS_VERSION = '1.0'
