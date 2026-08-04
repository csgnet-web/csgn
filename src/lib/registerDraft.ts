// Temporary, per-tab persistence of the in-progress register form so the
// user's username, wallet proof (and email, on the classic path) survive the
// full-page Twitch OAuth redirect. Passwords are intentionally NOT stored here —
// the user re-enters them on return, which is one more reason the wallet path is
// the better default: it has nothing that can't be restored. sessionStorage is
// scoped to the tab and cleared when it closes.

export const REGISTER_DRAFT_KEY = 'csgn:registerDraft'

export interface RegisterDraft {
  email: string
  username: string
  phantomProofToken: string
  verifiedWallet: string
  /** True when the draft was taken on the classic email + password path, so the
   *  form comes back with those fields open instead of on the wallet step. */
  emailMode: boolean
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
      emailMode: parsed.emailMode === true,
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
