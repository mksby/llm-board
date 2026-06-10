# llm-board

A peer-review harness for multi-LLM panels. The same question fans out to every panel member in parallel, each member anonymously ranks the others' answers, and a designated chairman model synthesises a final verdict.

Requests are routed through OpenRouter, so the panel composition is a config string and any model OpenRouter supports works. The harness runs end-to-end on the OpenRouter free tier — no required spend.

---

## How it works

![Three-stage pipeline: a question fans out in parallel to model 1 through model N, their responses are anonymised as A/B/C and fanned back out so every model peer-reviews and ranks the others blind, then a chairman synthesises the final verdict containing agreements, splits, blind spots, a recommendation, and the first concrete step.](docs/how-it-works.png)

**Stage 1 — Independent answers.** Every member receives the question and answers in parallel via `streamText`. Tokens are multiplexed back to the client as NDJSON, one frame per token, tagged with the producing member's id. No member sees the others' answers.

**Stage 2 — Anonymous peer review.** Responses are re-labelled `A`, `B`, `C`, … by Fisher-Yates shuffle. Every member receives the full anonymised set and returns a `generateObject` payload (Zod-validated) containing rankings, the strongest/weakest letter with justification, and one point every answer missed.

**Stage 3 — Chairman synthesis.** The designated chairman receives the de-anonymised answers and every peer review, then streams a markdown verdict in five sections: agreements, splits, blind spots caught in review, recommendation, first concrete step.

The panel size is flexible. Minimum two members; maximum twenty-six (limited by the anonymisation alphabet). Three is the default.

---

## Quick start

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

A ready-to-paste free roster — three providers, three lineages (Meta, Alibaba, OpenAI open-weights):

```bash
BOARD_ROSTER="llama|meta-llama/llama-3.3-70b-instruct:free|Llama 3.3 70B,qwen|qwen/qwen3-next-80b-a3b-instruct:free|Qwen 3 Next 80B,gptoss|openai/gpt-oss-120b:free|GPT-OSS 120B"
```

Browse the rest at [openrouter.ai/models?max_price=0](https://openrouter.ai/models?max_price=0). Free options currently include NVIDIA Nemotron (1M context), Google Gemma, Nous Hermes, Moonshot Kimi, additional Qwen and Llama variants.

Caveats: free routes are rate-limited per model rather than per account and occasionally cold-start slowly. If a member fails mid-round the harness logs the error and proceeds with whoever responded. A round needs at least two successful answers to enter stage 2.

---

## Configuring the panel

The default roster lives in `src/lib/board.ts`:

```ts
{ id: 'opus',   model: 'anthropic/claude-opus-4', label: 'Claude Opus 4' }
{ id: 'gemini', model: 'google/gemini-2.5-pro',   label: 'Gemini 2.5 Pro' }
{ id: 'qwen',   model: 'qwen/qwen3-max',          label: 'Qwen 3 Max' }
```

Two override paths:

- **Env var.** `BOARD_ROSTER="id|slug|label[|lens],..."` and optional `CHAIRMAN_ID=id`. The pipe separator lets OpenRouter `:free` slugs round-trip without ambiguity. The optional fourth field is a thinking-style lens (see below).
- **UI.** The settings panel toggles members on/off, picks a different chairman, and assigns lenses without restarting the server.

The chairman defaults to the first member if `CHAIRMAN_ID` is unset or invalid.

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

Once stage 3 finishes streaming, the route writes `data/transcripts/{timestamp}.json` containing the question, the panel roster (including any assigned lenses), every answer, the anonymisation reveal mapping, every peer review, and the chairman's verdict. The transcript id is also surfaced on the response in the `X-Transcript-Id` header so the client can correlate runs to files.

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
