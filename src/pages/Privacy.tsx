import { Link } from 'react-router-dom'
import { LegalPage, Clause } from '@/components/legal/LegalPage'

/**
 * Privacy Policy.
 *
 * Written from what the code actually collects — read off the user document,
 * the auth-event log and the third parties the app really calls — rather than
 * from a generic template. A policy that lists data we do not hold is worse than
 * useless: it is a false statement about our own systems.
 */
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="18 August 2026">
      <Clause n="1" title="Who we are">
        <p>
          CSGN operates the streaming network at csgn.fun. For questions about this policy or your
          data, write to <span className="font-mono text-gray-300">privacy@csgn.fun</span>.
        </p>
      </Clause>

      <Clause n="2" title="What we collect">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-white">Account</strong> — the identifier from whichever sign-in
            you used (Google, X, email address, or a Solana wallet address), a username, and a
            display name.
          </li>
          <li>
            <strong className="text-white">Connections</strong> — your Twitch account id and handle
            if you link one; your wallet address if you provide one.
          </li>
          <li>
            <strong className="text-white">What you submit</strong> — links to your posts, titles,
            the running order you set, and the colour you pick for your on-air card.
          </li>
          <li>
            <strong className="text-white">Broadcast records</strong> — which blocks you claimed,
            whether our checks found your channel live, and what fees those blocks generated.
          </li>
          <li>
            <strong className="text-white">Live checks</strong> — if you turn on stream forwarding,
            we ask Twitch about once a minute whether your channel is live, and store the public
            answer: live or not, the viewer count, the stream title and the category. We keep a
            running count of the minutes you were live and, separately, the minutes we actually
            carried you on CSGN. We check no channel that has not switched forwarding on, and we
            stop within a minute of you switching it off.
          </li>
          <li>
            <strong className="text-white">Sign-in events</strong> — the time, the method, whether
            it succeeded, any error, and the browser user-agent string. We keep these for 90 days to
            investigate abuse and fix broken sign-in.
          </li>
        </ul>
        <p>
          We do not collect payment card details, we do not sell data, and we do not run advertising
          trackers. Your email address and wallet address are never shown on your public profile or
          returned in any response another member can reach.
        </p>
      </Clause>

      <Clause n="3" title="Why we use it">
        <p>
          To run your account and the schedule; to work out and pay what you are owed; to review
          content before it airs; to prevent fraud and abuse; and to keep the service working. Our
          legal basis is performance of our agreement with you, and our legitimate interest in
          operating a safe network.
        </p>
      </Clause>

      <Clause n="4" title="Who else sees it">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong className="text-white">Google Firebase</strong> — authentication, database and hosting.</li>
          <li><strong className="text-white">Netlify</strong> — hosting and serverless functions.</li>
          <li><strong className="text-white">Twitch</strong> — when you link a channel, and to check whether it is live.</li>
          <li><strong className="text-white">Google, X</strong> — if you use them to sign in.</li>
          <li><strong className="text-white">YouTube, TikTok, Instagram</strong> — we request public information about a post you link, and embed it during playback. Their own policies apply to what they collect from viewers.</li>
          <li><strong className="text-white">Solana and public data providers</strong> — wallet balances and token data are read from public sources; a wallet address on a public blockchain is not private.</li>
        </ul>
      </Clause>

      <Clause n="5" title="What is public">
        <p>
          Your username, display name, avatar, linked Twitch handle, the blocks you have streamed,
          and any clip of yours that airs — including your name on screen. Everything else is
          visible only to you and to administrators.
        </p>
      </Clause>

      <Clause n="6" title="How long we keep it">
        <p>
          Account and broadcast records for as long as your account exists, and afterwards only
          where we need them for accounting, dispute or legal reasons. Sign-in events are deleted
          automatically after 90 days. Recordings already broadcast may persist in archives.
        </p>
      </Clause>

      <Clause n="7" title="Your rights">
        <p>
          You can ask for a copy of your data, ask us to correct it, or ask us to delete your
          account and content — write to{' '}
          <span className="font-mono text-gray-300">privacy@csgn.fun</span> and we will respond
          within 30 days. Depending on where you live you may also have the right to object to
          processing, to restrict it, or to complain to your data protection authority. We cannot
          delete anything already recorded on a public blockchain.
        </p>
      </Clause>

      <Clause n="8" title="Cookies and storage">
        <p>
          We use browser storage to keep you signed in and to finish a sign-in that started in
          another tab or browser. We do not use advertising or cross-site tracking cookies.
        </p>
      </Clause>

      <Clause n="9" title="Children">
        <p>
          CSGN is not for anyone under 18. If you believe a child has created an account, write to
          us and we will remove it.
        </p>
      </Clause>

      <Clause n="10" title="Changes">
        <p>
          Material changes will be posted here with a new date. See also our{' '}
          <Link to="/terms" className="text-primary-400 hover:text-primary-300 underline">
            Terms of Service
          </Link>.
        </p>
      </Clause>
    </LegalPage>
  )
}
