// Temporary, per-tab persistence of the in-progress register form so the
// user's email, username, and phantom proof survive the full-page Twitch OAuth
// redirect. Passwords are intentionally NOT stored here — the user re-enters
// them on return. sessionStorage is scoped to the tab and cleared when it closes.

export const REGISTER_DRAFT_KEY = 'csgn:registerDraft'

export interface RegisterDraft {
  email: string
  username: string
  phantomProofToken: string
  verifiedWallet: string
  tosAccepted: boolean
}

export function storeRegisterDraft(draft: RegisterDraft): void {
  try {
    sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

export function readRegisterDraft(): RegisterDraft | null {
  try {
    const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RegisterDraft>
    return {
      email: typeof parsed.email === 'string' ? parsed.email : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      phantomProofToken: typeof parsed.phantomProofToken === 'string' ? parsed.phantomProofToken : '',
      verifiedWallet: typeof parsed.verifiedWallet === 'string' ? parsed.verifiedWallet : '',
      tosAccepted: parsed.tosAccepted === true,
    }
  } catch {
    clearRegisterDraft()
    return null
  }
}

export function clearRegisterDraft(): void {
  try {
    sessionStorage.removeItem(REGISTER_DRAFT_KEY)
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}
