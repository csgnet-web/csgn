# Turning on Google, X and email sign-in

**Follow this top to bottom once.** The code for all three is already shipped —
what is missing is console configuration, which cannot be done from a repo. Until
you finish a section, that button returns *"That sign-in method is not switched on
for this site yet."*

Budget about 15 minutes for Google and email. **X takes longer** because it needs
a developer account that X has to approve — start that one first if you want all
three live today.

Things you will need open:

| | |
|---|---|
| Firebase console | <https://console.firebase.google.com> → your CSGN project |
| X developer portal | <https://developer.x.com/en/portal/dashboard> (only for §2) |
| Your Firebase project ID | Firebase console → ⚙ → Project settings → **Project ID** |

Write the project ID down now — §2 needs it, and getting it wrong is the single
most common reason X sign-in fails.

---

## 0. First, find the screen everything happens on

1. Firebase console → your project.
2. Left sidebar → **Build** → **Authentication**.
3. If you have never used it: click **Get started**.
4. Click the **Sign-in method** tab.

You should see a list of providers with **Status** beside each. That list is what
you are editing for the rest of this document.

---

## 1. Google — the easy one

1. On **Sign-in method**, click **Add new provider** (or the pencil beside Google
   if it is already listed).
2. Choose **Google**.
3. Flip the **Enable** toggle on.
4. Fill in the two required fields:
   - **Project public-facing name** — what the user sees on the Google consent
     screen. Put **CSGN** here, not the project ID. This is the name a stranger
     reads while deciding whether to trust the button.
   - **Project support email** — pick your address from the dropdown.
5. Click **Save**.

That is genuinely it. Firebase creates the OAuth client for you.

☐ **Check:** Google now shows **Enabled** in the provider list.

---

## 2. X (Twitter) — the long one

Firebase still labels this provider **Twitter**. It uses OAuth 1.0a, which is why
it needs keys from X rather than being one toggle.

### 2.1 Get a developer account

1. Go to <https://developer.x.com/en/portal/dashboard> and sign in with the X
   account that should own the app (use the **CSGN** account, not a personal one —
   the app name shows on the authorization screen).
2. If prompted, apply for access. The **Free** tier is enough for sign-in.
3. Wait for approval. This can be instant or can take a day. Everything below is
   blocked until it clears.

### 2.2 Create the app

1. In the portal, create a **Project**, then an **App** inside it.
2. Name it something a stranger will understand on the consent screen — **CSGN**.

### 2.3 Set up user authentication (the step people miss)

1. Open your App → **User authentication settings** → **Set up**.
2. Fill in:
   - **App permissions** → **Read** (sign-in needs nothing more; do not ask for
     write access you will not use)
   - **Type of App** → **Web App, Automated App or Bot**
   - **Callback URI / Redirect URL** →

     ```
     https://YOUR-PROJECT-ID.firebaseapp.com/__/auth/handler
     ```

     Replace `YOUR-PROJECT-ID` with the project ID you wrote down. Those are two
     underscores in `/__/auth/handler`.

     > Firebase shows you this exact URL on its own Twitter provider screen (§2.5)
     > with a copy button. If you would rather copy than type, open that first.

   - **Website URL** → `https://csgn.fun`
3. **Save**.

### 2.4 Copy the keys

1. App → **Keys and tokens**.
2. Under **Consumer Keys**, click **Regenerate** (or View) on **API Key and
   Secret**.
3. Copy both. **The secret is shown once** — if you lose it, regenerate and use
   the new pair.

### 2.5 Paste them into Firebase

1. Firebase → **Authentication** → **Sign-in method** → **Add new provider** →
   **Twitter**.
2. Toggle **Enable**.
3. Paste the **API key** and **API key secret**.
4. Confirm the callback URL shown there matches what you put in §2.3. If it does
   not, fix §2.3 to match this one — Firebase's is authoritative.
5. **Save**.

☐ **Check:** Twitter shows **Enabled**.

> **Know this before you launch it:** X often does not give us an email address.
> That is expected and handled — `finalizeSocialAccount` treats email as optional
> and mints the account anyway. Nothing to configure.

---

## 3. Email link (passwordless)

There is no password anywhere in CSGN. The email row sends a link that signs you
in when opened.

1. Firebase → **Authentication** → **Sign-in method**.
2. Click **Email/Password** (add it as a new provider if it is not listed).
3. Turn on **BOTH** toggles:
   - **Email/Password** → Enable
   - **Email link (passwordless sign-in)** → Enable

   The second one is a separate switch underneath the first and is easy to miss.
   With only the first on, the modal's email row fails.
4. **Save**.

### 3.1 Make the email not look like spam

1. **Authentication** → **Templates** tab → **Email address sign-in**.
2. Click the pencil and set:
   - **Sender name** → `CSGN`
   - **Subject** → something a person recognises, e.g. `Your CSGN sign-in link`
3. Save.

> Leave the **action URL** alone. The app passes its own return URL
> (`/auth/email/complete`) on every send, which overrides the template default.

☐ **Check:** Email/Password shows **Enabled**, and the row mentions email link.

---

## 4. Authorized domains — do this or nothing works

Firebase refuses sign-in from any domain not on this list.

1. **Authentication** → **Settings** tab → **Authorized domains**.
2. Confirm these are present, and **Add domain** for any that are not:

| Domain | Why |
|---|---|
| `localhost` | local development (usually there already) |
| `YOUR-PROJECT-ID.firebaseapp.com` | the OAuth handler itself (already there) |
| `csgn.fun` | production |
| `www.csgn.fun` | only if you serve it |
| your Netlify preview domain | if you test sign-in on deploy previews |

☐ **Check:** every domain you will actually sign in from is listed.

---

## 5. Test it, in this order

Use a real phone for at least one of these. Desktop hides the problems mobile has.

☐ **Google, desktop.** Open CSGN → **Sign In** → *Continue with Google*. A popup
appears, you pick an account, the popup closes, you are signed in. Your handle is
generated for you — you are never asked to invent one.

☐ **Google, phone.** Same, in Safari or Chrome. Should be a redirect, not a
popup, and it should return you to where you started.

☐ **X.** *Continue with X* → X's authorize screen shows **your app name** → you
land back signed in.

☐ **Email, same device.** Type an address, tap **Submit**, see "Check your email",
open the link on that device → you land on `/studio` signed in.

☐ **Email, different device.** Send from desktop, open the link on your phone.
The page asks for the address (it cannot read the other device's storage) — type
it, and you are in. **This branch is the one worth testing**; it is the common
real-world path and the one most likely to be broken by a bad template.

☐ **Returning user.** Sign out, sign in again with the same provider. You should
land straight back in your existing account with the same handle — not a second
account.

☐ **Admin check.** Firebase → **Authentication** → **Users** shows each test
account with the right provider icon, and CSGN's own **Admin → Auth Events** tab
lists the sign-ins.

---

## 6. When something fails

The modal shows real messages, but the browser console shows the Firebase code.
Match it here.

| What you see | What it means | Fix |
|---|---|---|
| "That sign-in method is not switched on for this site yet" / `auth/operation-not-allowed` | The provider is off | Finish §1, §2 or §3 for that provider |
| `auth/unauthorized-domain` | Signing in from a domain Firebase does not trust | §4 — add the domain |
| X: "Callback URL not approved" | The URI in §2.3 does not match Firebase's | Copy Firebase's exact handler URL from §2.5 |
| X: `auth/invalid-credential` | API key or secret wrong, or the secret was regenerated after you pasted it | Re-copy both from §2.4 and re-save in §2.5 |
| Email link says "expired or already used" | Links are single use and time limited | Ask for a fresh one |
| Email never arrives | Almost always spam, or a template with no sender name | Check spam, then §3.1 |
| Popup opens and instantly closes | The user closed it, or a blocker killed it | Expected; the modal shows no error for a user-cancelled popup |
| "You already have an account using a different sign-in" | Same email, different provider | Sign in the original way; linking providers is a separate feature |

---

## 7. What is deliberately not here

- **Passkeys.** The design has an "I have a passkey" row; Firebase Auth has no
  native passkey support, so it is not built. It needs a WebAuthn flow plus a
  custom-token exchange — its own piece of work, not a console toggle.
- **Instagram and Snapchat.** Not Firebase providers. They would each need a
  custom OIDC integration.
- **Apple and Facebook.** Both ARE supported by Firebase and would slot in beside
  Google with the same shape of setup. Apple is worth adding if iOS traffic grows —
  it is required by App Store rules for native apps, though not for the web.
