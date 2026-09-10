/**
 * THE MODEL CALL — one place, one prompt, one model.
 *
 * Split from `rightNow.ts` so that everything deciding what may go on air stays
 * pure and testable with no API key and no network, and this file is only the
 * round trip. That split is the point: the prompt is an instruction and the
 * vetting is a control, and they should not live in the same file where the
 * next person might assume the first one enforces something.
 *
 * ── Model, and what it costs ───────────────────────────────────────────────
 *
 * Claude Opus 5, at low effort. The job is a handful of short lines every two
 * hours: twelve runs a day, a couple of thousand input tokens and a few hundred
 * output tokens each. That is single-digit dollars a month at Opus rates, so
 * there is nothing to save by reaching for a smaller model and something real
 * to lose — this text is the channel's voice, on screen, unsupervised.
 *
 * `CSGN_RAIL_MODEL` overrides it without a deploy if that judgement changes.
 *
 * The system prompt is fixed text and is marked cacheable, so the repeated half
 * of every run is served from cache rather than re-read.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  RAIL_SYSTEM_PROMPT, buildRailPrompt, parseModelLines,
  type Candidate, type RailSource,
} from './rightNow'

/** Opus 5 unless the operator says otherwise. See the header for the cost. */
const DEFAULT_MODEL = 'claude-opus-5'

/** Four short lines. Small enough that the whole response arrives well inside
 *  a serverless invocation, so there is nothing to stream. */
const MAX_TOKENS = 1_024

export function railWriterConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export function railModel(): string {
  return (process.env.CSGN_RAIL_MODEL || '').trim() || DEFAULT_MODEL
}

export interface WriteResult {
  candidates: Candidate[]
  model: string
  /** Populated when the call failed. The run is not fatal — the previous rail
   *  simply stays up — but the operator needs to be able to see why. */
  error?: string
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number }
}

/**
 * Ask for lines. Never throws: a failed run leaves the rail exactly as it was,
 * which is the correct behaviour for a thing nobody is watching, and the caller
 * logs the reason.
 */
export async function writeRailLines(sources: readonly RailSource[], wanted: number): Promise<WriteResult> {
  const model = railModel()
  if (!railWriterConfigured()) {
    return { candidates: [], model, error: 'ANTHROPIC_API_KEY is not configured' }
  }

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      // Low effort on purpose: this is short-form writing against a tight brief,
      // not a reasoning problem, and thinking is on by default on Opus 5.
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: RAIL_SYSTEM_PROMPT,
          // The stable half of every run. Volatile material goes in the user
          // message, after this breakpoint, so the prefix keeps matching.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildRailPrompt(sources, wanted) }],
    })

    // A refusal is a 200 with no usable content — check before reading it, or a
    // declined run parses as "the model wrote nothing" with no reason attached.
    if (response.stop_reason === 'refusal') {
      return {
        candidates: [],
        model,
        error: `model declined: ${response.stop_details?.category ?? 'unknown'}`,
      }
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    return {
      candidates: parseModelLines(text),
      model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      },
    }
  } catch (err) {
    return { candidates: [], model, error: err instanceof Error ? err.message : String(err) }
  }
}
