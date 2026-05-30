// Temporary, per-tab persistence of the in-progress register form so the
// user's typed email/username/password survive the full-page Twitch OAuth
// redirect. sessionStorage is scoped to the tab and cleared when it closes;
// the draft is also cleared on a successful Create Account or when the modal
// is closed manually.

export const REGISTER_DRAFT_KEY = 'csgn:registerDraft'

export interface RegisterDraft {
  email: string
  username: string
  password: string
  confirmPassword: string
  phantomProofToken: string
  verifiedWallet: string
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
      password: typeof parsed.password === 'string' ? parsed.password : '',
      confirmPassword: typeof parsed.confirmPassword === 'string' ? parsed.confirmPassword : '',
      phantomProofToken: typeof parsed.phantomProofToken === 'string' ? parsed.phantomProofToken : '',
      verifiedWallet: typeof parsed.verifiedWallet === 'string' ? parsed.verifiedWallet : '',
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
