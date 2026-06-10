# llm-board

A peer-review harness for multi-LLM panels. The same question fans out to every panel member in parallel, each member anonymously ranks the others' answers, and a designated chairman model synthesises a final verdict.

Requests are routed through OpenRouter, so the panel composition is a config string and any model OpenRouter supports works. The harness runs end-to-end on the OpenRouter free tier — no required spend.

---

## How it works

![Three-stage pipeline: a question fans out in parallel to model 1 through model N, their responses are anonymised as A/B/C and fanned back out so every model peer-reviews and ranks the others blind, then a chairman synthesises the final verdict containing agreements, splits, blind spots, a recommendation, and the first concrete step.](docs/how-it-works.png)

**Stage 1 — Independent answers.** Every member receives the question and answers in parallel via `streamText`. Tokens are multiplexed back to the client as NDJSON, one frame per token, tagged with the producing member's id. No member sees the others' answers.

**Stage 2 — Anonymous peer review.** Responses are re-labelled `A`, `B`, `C`, … by Fisher-Yates shuffle. Every member receives the full anonymised set and returns a `generateObject` payload (Zod-validated) containing rankings, the strongest/weakest letter with justification, and one point every answer missed.

**Stage 3 — Chairman synthesis.** The designated chairman receives the de-anonymised answers and every peer review, then streams a markdown verdict in five sections: agreements, splits, blind spots caught in review, recommendation, first step.

The panel size is flexible. Minimum two members; maximum twenty-six (limited by the anonymisation alphabet). The default is five — one model per thinking-style lens (see "Thinking-style lenses" below), running on the OpenRouter free tier out of the box.

---

## Quick start

Requires Node 24 (pinned in `.mise.toml`) and pnpm 10 (pinned in `package.json` via `packageManager`).

```bash
pnpm install
cp .env.example .env.local        # paste OPENROUTER_API_KEY=sk-or-v1-...
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Get a key at [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Running on the free tier

OpenRouter exposes free model variants under a `:free` suffix. The harness has no special-case logic for them — they're just models with $0/token pricing. The free tier has two limits (verified against the OpenRouter docs on 2026-06-10):

| Constraint     | No purchased credits | $10+ purchased credits |
| -------------- | -------------------- | ---------------------- |
| Per minute     | 20 requests          | 20 requests            |
| Per day        | 50 requests          | 1 000 requests         |

Credits stay on the account — `:free` models still cost $0/token. The $10 only unlocks the higher daily ceiling.

One full round costs `2N + 1` requests, where N is the panel size:

| Panel size | Requests/round | Free rounds/day (no credits) | Free rounds/day ($10+ credits) |
| ---------- | -------------- | ---------------------------- | ------------------------------ |
| 2          | 5              | ≈ 10                         | ≈ 200                          |
| 3          | 7              | ≈ 7                          | ≈ 140                          |
| 5          | 11             | ≈ 4                          | ≈ 90                           |

The default roster (in `src/lib/board.ts`) is already a free-tier full council — five members, one per lens, no spend required. Browse the wider catalogue at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0); other free options today include Google Gemma 4, Nous Hermes 3 405B, additional Qwen and Llama variants.

Caveats: free routes are rate-limited per model rather than per account and occasionally cold-start slowly. If a member fails mid-round the harness logs the error and proceeds with whoever responded. A round needs at least two successful answers to enter stage 2.

---

## Configuring the panel

The default roster lives in `src/lib/board.ts` — five free-tier models, one per lens, default chairman is GPT-OSS 120B (the strongest free synthesiser):

```ts
{ id: 'llama',    model: 'meta-llama/llama-3.3-70b-instruct:free',   lens: 'contrarian'       }
{ id: 'qwen',     model: 'qwen/qwen3-next-80b-a3b-instruct:free',    lens: 'first-principles' }
{ id: 'gptoss',   model: 'openai/gpt-oss-120b:free',                 lens: 'expansionist'     }  // also chairman
{ id: 'nemotron', model: 'nvidia/nemotron-3-ultra-550b-a55b:free',   lens: 'outsider'         }
{ id: 'kimi',     model: 'moonshotai/kimi-k2.6:free',                lens: 'executor'         }
```

A 5-member round costs 11 OpenRouter requests — roughly 4 rounds/day on the bare free tier or ~90 rounds/day after a $10 credit top-up. To run on paid frontier models instead, drop one of the presets from `.env.example` into `.env.local`.

Two override paths:

- **Env var.** `BOARD_ROSTER="id|slug|label[|lens],..."` and optional `CHAIRMAN_ID=id`. The pipe separator lets OpenRouter `:free` slugs round-trip without ambiguity. The optional fourth field is a thinking-style lens (see below).
- **UI.** The settings panel toggles members on/off, picks a different chairman, and assigns lenses without restarting the server.

The chairman defaults to the first member if `CHAIRMAN_ID` is unset or invalid.

### Notable models on OpenRouter

A picker organised by tier. All slugs verified against the OpenRouter catalogue on 2026-06-10. Prices are USD per million tokens, input / output.

**Paid frontiers:**

| Slug                                    | Ctx  | $/Mtok in / out | Notes                                   |
| --------------------------------------- | ---- | --------------- | --------------------------------------- |
| `anthropic/claude-opus-4.7`             | 1M   | 5 / 25          | Anthropic flagship. Decisive synthesis. |
| `anthropic/claude-opus-4.8`             | 1M   | 5 / 25          | Newest Anthropic, same price as 4.7.    |
| `anthropic/claude-sonnet-4.6`           | 1M   | 3 / 15          | Best chairman pick — see below.         |
| `openai/gpt-5.4`                        | 1M+  | 2.5 / 15        | Strong synthesiser, 1M+ context.        |
| `openai/gpt-5.5`                        | 1M+  | 5 / 30          | Newest GPT. Output is the cost driver.  |
| `google/gemini-3.1-pro-preview`         | 1M   | 2 / 12          | Largest practical context, cheap.       |
| `google/gemini-3.5-flash`               | 1M   | 1.5 / 9         | Fast mid-tier, structured-output ok.    |
| `x-ai/grok-4.20`                        | 2M   | 1.25 / 2.5      | 2M ctx + cheap + opinionated voice.     |
| `qwen/qwen3-max`                        | 262k | 0.78 / 3.9      | Alibaba flagship.                       |
| `meta-llama/llama-4-maverick`           | 1M   | 0.15 / 0.6      | Llama 4 flagship — cheapest 1M ctx.     |
| `mistralai/mistral-large-2512`          | 262k | 0.5 / 1.5       | EU-hosted, cheapest 200k+ option.       |
| `cohere/command-a`                      | 256k | 2.5 / 10        | Cohere flagship.                        |

**Reasoning models** — use as panel members for deep thinking. Avoid as chairman: visible chain-of-thought can leak into the streamed verdict and break the markdown.

| Slug                                    | Ctx  | $/Mtok in / out | Notes                                   |
| --------------------------------------- | ---- | --------------- | --------------------------------------- |
| `openai/o3`                             | 200k | 2 / 8           | RL-tuned reasoning.                     |
| `openai/o4-mini`                        | 200k | 1.1 / 4.4       | Cheaper reasoning tier.                 |
| `deepseek/deepseek-r1`                  | 164k | 0.7 / 2.5       | Open-weights reasoning.                 |
| `anthropic/claude-haiku-4.5`            | 200k | 1 / 5           | Smallest Anthropic. Not a reasoner, but fast and cheap. |

**Free tier** (`:free` suffix, $0 per token, shared 20 RPM / 50–1 000 RPD ceiling — see "Running on the free tier"):

| Slug                                              | Ctx  | Notes                                        |
| ------------------------------------------------- | ---- | -------------------------------------------- |
| `openai/gpt-oss-120b:free`                        | 131k | Best free synthesiser → best free chairman.  |
| `meta-llama/llama-3.3-70b-instruct:free`          | 131k | Tight format-following.                      |
| `qwen/qwen3-next-80b-a3b-instruct:free`           | 262k | Balanced free option, broad ctx.             |
| `nvidia/nemotron-3-ultra-550b-a55b:free`          | 1M   | 550B params, 1M ctx, slower.                 |
| `nvidia/nemotron-3-super-120b-a12b:free`          | 1M   | Mid-tier Nemotron, 1M ctx.                   |
| `moonshotai/kimi-k2.6:free`                       | 262k | Diverse RLHF, fast.                          |
| `nousresearch/hermes-3-llama-3.1-405b:free`       | 131k | 405B params, slow but strong.                |
| `google/gemma-4-31b-it:free`                      | 262k | Google open-weights tier.                    |
| `openai/gpt-oss-20b:free`                         | 131k | Cheap-feeling fallback for the 120B.         |

A wider list (23 free models, 339 total) is at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0).

### Picking a chairman

The chairman gets every answer + every peer review and must produce a 5-section verdict without hedging. That favours format-strict synthesis models over reasoning models or specialists.

| Use case                                   | Recommended chairman                                |
| ------------------------------------------ | --------------------------------------------------- |
| Default (credits available)                | `anthropic/claude-sonnet-4.6`                       |
| Maximum quality, no budget cap             | `anthropic/claude-opus-4.7` or `anthropic/claude-opus-4.8` |
| Long panel context (5+ members × ≥ 10k tokens) | `google/gemini-3.1-pro-preview` or `x-ai/grok-4.20` |
| Running fully free                         | `openai/gpt-oss-120b:free`                          |

Avoid as chairman: reasoning models (`o3`, `o4-mini`, `deepseek-r1`) — their thinking trace leaks; specialised models (`qwen3-coder`, `gpt-5-codex`) — over-fit to code; and members of the panel that have already answered, when you can afford a separate chair (eliminates self-bias).

---

## Thinking-style lenses

Multi-model diversity catches some blind spots automatically — different models, different RLHF, different blind spots. The harness layers a second axis of diversity on top: an optional per-member system prompt that biases the model toward a single thinking style. Other members are told they'll cover other angles, so each leans fully into its assigned stance instead of hedging.

| Lens                  | Posture                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `contrarian`          | Hunts for what will fail. Leads with the strongest objection.            |
| `first-principles`    | Strips assumptions. Reframes the question if the question is wrong.      |
| `expansionist`        | Hunts for unseen upside. Assumes risk is someone else's job.             |
| `outsider`            | Fresh eyes. Catches curse-of-knowledge blind spots and unclear terms.    |
| `executor`            | Only cares about Monday morning. Names the first concrete step.          |

The five together create three useful tensions (contrarian vs expansionist, first-principles vs executor, with the outsider keeping the panel honest). Assigning all five gives you the full council; assigning none keeps the harness in pure model-diversity mode. Mix freely.

Lenses apply to stage 1 only — peer review (stage 2) is always run with a neutral reviewer prompt so judgement is not biased by stance.

Set via env (4th segment of each `BOARD_ROSTER` entry) or via the lens dropdown in the UI settings panel.

---

## When the harness adds signal

The peer-review pass costs `2N + 1` calls and adds wall-clock time. It pays off when there's genuine uncertainty and a single-model blind spot would be expensive to miss:

- Pricing or positioning decisions with limited prior data
- Architecture choices that are hard to reverse
- Hiring tradeoffs (one senior vs two juniors, in-house vs contractor)
- Reviewing copy or specs for missed assumptions

For factual lookups, summarisation, and creative generation, a single model is fine. The board adds latency and tokens with no upside on those tasks.

---

## Architecture

Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4. Vercel AI SDK pointed at OpenRouter through the OpenAI-compatible client. Zod for request validation and structured output. No state library, no UI kit. ~1 400 lines of TypeScript, end to end.

```
src/
├── app/
│   ├── layout.tsx               root layout
│   ├── page.tsx                 console
│   ├── globals.css              tailwind v4 + design tokens
│   └── api/
│       ├── stage1/route.ts      parallel streaming (NDJSON)
│       ├── stage2/route.ts      anonymised review (Zod schema)
│       └── stage3/route.ts      chairman synthesis (text stream, persists transcript)
├── lib/
│   ├── board.ts                 roster + chairman config + env parser
│   ├── openrouter.ts            AI SDK ↔ OpenRouter
│   ├── anonymize.ts             Fisher-Yates + reveal mapping
│   ├── lenses.ts                thinking-style system prompts
│   ├── transcript.ts            persist runs to disk
│   ├── types.ts                 shared Zod schemas
│   └── prompts/
│       ├── reviewer.ts
│       └── chairman.ts
└── components/
    ├── BoardConsole.tsx         client orchestrator (runs the 3 stages)
    ├── BoardInput.tsx           textarea + submit
    ├── BoardSettings.tsx        member toggles, chairman, lens dropdowns
    ├── StageOneTabs.tsx         per-member streamed-answer tabs
    ├── StageTwoGrid.tsx         anonymisation reveal + ranked grid
    └── StageThreeVerdict.tsx    streamed chairman verdict
```

Once stage 3 finishes streaming, the route writes `data/transcripts/{timestamp}.json` containing the question, the panel roster (including any assigned lenses), every answer, the anonymisation reveal mapping, every peer review, and the chairman's verdict. The transcript id is also surfaced on the response in the `X-Transcript-Id` header for clients that want to correlate runs to the on-disk file.

---

## Scripts

```bash
pnpm dev          # turbopack dev server
pnpm build        # production build
pnpm start        # serve the build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm format       # prettier --write
```

---

## License

MIT.
