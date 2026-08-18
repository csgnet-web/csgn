import { Link } from 'react-router-dom'
import { LegalPage, Clause } from '@/components/legal/LegalPage'

/**
 * Terms of Service.
 *
 * Boilerplate, written to cover the things this product actually does that
 * could cost us: user-submitted content going out on a broadcast, a token with
 * no promised value, payouts that depend on measurement, and accounts we may
 * need to remove. It is deliberately short and readable — a wall of unread
 * legalese protects nobody.
 *
 * NOT LEGAL ADVICE, and not a substitute for counsel. See the note at the foot
 * of the page, which says so to the reader too.
 */
export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="18 August 2026">
      <Clause n="1" title="What CSGN is">
        <p>
          CSGN is a 24-hour streaming network. Members claim two-hour blocks and broadcast from
          their own channels, and members submit links to clips that air between those blocks. We
          operate the schedule and the broadcast. We do not host your video.
        </p>
      </Clause>

      <Clause n="2" title="Your account">
        <p>
          You must be at least 18, or the age of majority where you live, whichever is higher. One
          person, one account. You are responsible for everything done through your account and for
          keeping your sign-in method, wallet and streaming credentials secure. We cannot recover a
          self-custodied wallet for you.
        </p>
      </Clause>

      <Clause n="3" title="Content you submit">
        <p>
          You keep ownership of everything you submit. By submitting a link or going on air you
          grant CSGN a non-exclusive, worldwide, royalty-free licence to display, embed, transmit
          and rebroadcast that content on the network and in clips and promotional material, for as
          long as you leave it with us plus a reasonable period afterwards for archives and
          recordings already made.
        </p>
        <p>
          <strong className="text-white">You promise you have the right to do that.</strong> You
          must own or be licensed for everything in what you submit, including music. Do not submit
          anything that infringes copyright, is illegal, depicts a minor sexually, promotes violence
          or hate, or is intended to mislead people about a financial product. Everything is
          reviewed before it airs, but review is not approval and does not transfer responsibility
          to us.
        </p>
      </Clause>

      <Clause n="4" title="Copyright complaints">
        <p>
          If you believe something on CSGN infringes your copyright, write to{' '}
          <span className="font-mono text-gray-300">legal@csgn.fun</span> with the work concerned,
          where it appears, your contact details, and a statement that you have a good-faith belief
          the use is unauthorised. We remove infringing material promptly and terminate the accounts
          of repeat infringers.
        </p>
      </Clause>

      <Clause n="5" title="Airtime, blocks and payouts">
        <p>
          Airtime for submitted clips is allocated in proportion to the $CSGN you hold, subject to a
          published per-member ceiling. Claiming a block and going live are free and are not
          allocated by holdings.
        </p>
        <p>
          Creator fees are a share of the trading fees the token generates while you are on air,
          scaled by the share of our checks that found your channel actually broadcasting. Every
          figure shown before a block settles is an <strong className="text-white">estimate</strong>.
          Amounts are not guaranteed, may be zero, and are subject to review. Fees are held until
          you provide a wallet. We may withhold payment where we reasonably believe there has been
          fraud, manipulation or a breach of these terms.
        </p>
      </Clause>

      <Clause n="6" title="$CSGN">
        <p>
          $CSGN is a token on Solana. It is not a share, a security offering, a deposit, or a claim
          on our assets or revenue, and we do not promise that it will hold or increase in value.
          Buying it is entirely at your own risk and it may become worthless. Nothing on this site
          is financial, investment, tax or legal advice.
        </p>
        <p>
          Holding $CSGN affects promotion only — how much airtime your clips receive and whether you
          can post to the broadcast ticker. It never gates having an account, claiming a block, or
          going live.
        </p>
      </Clause>

      <Clause n="7" title="Acceptable use">
        <p>
          Do not attempt to manipulate airtime, votes or fees; do not operate multiple accounts to
          increase your share; do not scrape, overload or interfere with the service; do not
          impersonate anyone. We may remove content, suspend or terminate an account, and withhold
          unpaid amounts where we reasonably believe this clause has been broken.
        </p>
      </Clause>

      <Clause n="8" title="The service is provided as-is">
        <p>
          CSGN is provided without warranties of any kind. We do not promise the network will be
          uninterrupted, that a scheduled clip will air at an exact moment, or that any measurement
          will be free of error. To the maximum extent permitted by law, our total liability to you
          for any claim is limited to the greater of the amounts we actually paid you in the three
          months before the claim, or US$100. We are not liable for lost profits, lost tokens, or
          indirect or consequential loss.
        </p>
      </Clause>

      <Clause n="9" title="Changes and ending">
        <p>
          We may change these terms; material changes will be posted here with a new date, and
          continuing to use CSGN means you accept them. You may stop at any time and delete your
          content. We may suspend or close the service, or your account, and will give notice where
          we reasonably can.
        </p>
      </Clause>

      <Clause n="10" title="Contact">
        <p>
          <span className="font-mono text-gray-300">legal@csgn.fun</span>. See also our{' '}
          <Link to="/privacy" className="text-primary-400 hover:text-primary-300 underline">
            Privacy Policy
          </Link>.
        </p>
      </Clause>
    </LegalPage>
  )
}
