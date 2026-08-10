# Archive

Superseded documents, kept **verbatim**. Nothing here has been edited except for a
four-line header at the top saying what replaced it and what it's still good for.

**None of these are authoritative on what we're doing now.** The current plan is
[`../plan.md`](../plan.md); the current designs are in [`../design/`](../design).

They are kept because *why* a decision was made is worth more than the decision, and
because several of them contain reasoning that the newer docs assume rather than repeat.

---

## The supersession sequence

Each of these was written believing it was the last word. Read left to right:

```
master-plan.md → ecosystem-strategy.md → onchain-thesis.md → socialfi-era2.md
              → campaign.md → ../plan.md
```

On **token design** specifically the line is shorter, and it ends outside this folder:

```
master-plan.md §5 → onchain-thesis.md §6 → ../design/token-economics.md
                                          + ../design/the-grid.md
```

---

## What's here

| Doc | Superseded by | Still worth reading for |
|---|---|---|
| [`master-plan.md`](master-plan.md) | [`../plan.md`](../plan.md), [`../design/token-economics.md`](../design/token-economics.md) | The schedule model; the treasury rules (§11.1); the jukebox rules (§11.2); the partner refusal list (§11.5). **All four still stand** and the new docs cite them |
| [`campaign.md`](campaign.md) | [`../plan.md`](../plan.md) | The three pillars (room · show · campaign), the CFB 27 formats and the dynasty league, and the exact copy — bio, pinned post, talk track |
| [`the-pitch.md`](the-pitch.md) | [`../plan.md`](../plan.md) | **"YOU'RE ON"**, the empty-slot-as-creative rule, the proof stack, the refusal list |
| [`ecosystem-strategy.md`](ecosystem-strategy.md) | [`../plan.md`](../plan.md), [`../design/token-economics.md`](../design/token-economics.md) | The speed-to-cash ranking (§3) and the **CSGN-for-Venues** play (§4) |
| [`onchain-thesis.md`](onchain-thesis.md) | [`../design/token-economics.md`](../design/token-economics.md), [`../design/the-grid.md`](../design/the-grid.md) | The eight ranked mechanisms (§6.3), Proof-of-Broadcast, Harberger ticker cells, "blockspace for attention" |
| [`socialfi-era2.md`](socialfi-era2.md) | [`../plan.md`](../plan.md) | The Era 1 → Era 2 rule change, the Privy funnel analysis, the founder promotion playbook (§5) |
| [`growth-and-market-plan.md`](growth-and-market-plan.md) | [`../plan.md`](../plan.md) | The creator-fee maths against the real pump.fun tier table, and the honest odds on market cap |
| [`agent-packets.md`](agent-packets.md) | [`../plan.md`](../plan.md), the build orders in [`../design/`](../design) | Packet **B2**, the partner-token surface — the exact change [`../design/the-grid.md`](../design/the-grid.md) §8 depends on |

---

## The rule for adding to this folder

A document is archived, never deleted, and never rewritten in place. When something
supersedes it:

1. `git mv` it here, so the history follows the file.
2. Add the four-line header: **ARCHIVED** + date, what supersedes it, "kept verbatim,
   not authoritative", and what it's still good for.
3. Add a row to the table above and, if it changes the sequence, to the diagram.
4. Append a line to [`../decisions.md`](../decisions.md).

If a claim in an archived doc is still true and still load-bearing, the superseding
document should quote it rather than leave it buried here.
