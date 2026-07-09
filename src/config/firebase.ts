import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function required(key: string): string {
  const v = import.meta.env[key] as string | undefined
  if (!v) throw new Error(`Missing required environment variable: ${key}`)
  return v
}

const firebaseConfig = {
  apiKey: required('VITE_FIREBASE_API_KEY'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: required('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
}

const app = initializeApp(firebaseConfig)

// App Check attests that Firestore/Auth requests come from this real web app,
// not a script with the (public) API key. No-ops when the site key env var is
// unset so local dev and preview deploys keep working. Enforcement is a
// separate Firebase-console switch — see docs/ops-cost-security-runbook.md.
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined
if (appCheckSiteKey) {
  const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN as string | undefined
  if (debugToken || import.meta.env.DEV) {
    // Must be set before initializeAppCheck. `true` makes the SDK mint a debug
    // token and log it to the browser console; register it in the Firebase
    // console to allow local dev traffic once enforcement is on.
    ;(globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken ?? true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
