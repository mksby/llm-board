# llm-board

A peer-review harness for multi-LLM panels. The same question fans out to every panel member in parallel, each member anonymously ranks the others' answers, and a designated chairman model synthesises a final verdict.

Requests are routed through OpenRouter, so the panel composition is a config string and any model OpenRouter supports works. The harness runs end-to-end on the OpenRouter free tier — no required spend.

---

## How it works

```
                                                                ┌─────────────────┐
   question  ──┬──▶  model 1  ─┐                                │  Verdict        │
               │               │                                │                 │
               ├──▶  model 2   ├─▶  anonymise  ─▶  rank  ─▶ ▶▶  │  · agreements   │
               │               │     A · B · C       blind      │  · splits       │
               ├──▶  model 3  ─┘                                │  · blind spots  │
               │      ...                                       │  · recommend    │
               └──▶  model N                                    │  · first step   │
                                                                └─────────────────┘

       stage 1                   stage 2                   stage 3
   independent answers      anonymous peer review     chairman synthesis
```

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

- **Env var.** `BOARD_ROSTER="id|slug|label,id|slug|label,..."` and optional `CHAIRMAN_ID=id`. The pipe separator lets OpenRouter `:free` slugs round-trip without ambiguity.
- **UI.** The settings panel toggles members on/off and picks a different chairman without restarting the server.

The chairman defaults to the first member if `CHAIRMAN_ID` is unset or invalid.

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

Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4. Vercel AI SDK pointed at OpenRouter through the OpenAI-compatible client. Zod for request validation and structured output. No state library, no UI kit. ~600 lines of TypeScript, end to end.

```
src/
├── app/
│   ├── page.tsx                 console
│   └── api/
│       ├── stage1/route.ts      parallel streaming (NDJSON)
│       ├── stage2/route.ts      anonymised review (Zod schema)
│       └── stage3/route.ts      chairman synthesis (text stream)
├── lib/
│   ├── board.ts                 roster + chairman config
│   ├── openrouter.ts            AI SDK ↔ OpenRouter
│   ├── anonymize.ts             Fisher-Yates + reveal mapping
│   ├── transcript.ts            persist runs to disk
│   ├── types.ts                 shared Zod schemas
│   └── prompts/
│       ├── reviewer.ts
│       └── chairman.ts
└── components/
    └── BoardConsole.tsx         client orchestrator
```

Every round produces a `data/transcripts/{timestamp}.json` containing the question, the panel roster, all answers, the anonymisation reveal mapping, all peer reviews, and the chairman's verdict.

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
