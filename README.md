# llm-board

**Stop asking one model. Convene the board.**

Three frontier LLMs. Independent answers. Anonymous peer review. One synthesised verdict — on your machine, in your terminal, on your dime.

---

## Why

Single-model answers sound confident. That's the problem.

One AI gives you one answer. It might be brilliant. It might be wrong in a way you can't catch — because you only saw one perspective.

`llm-board` asks every model on the bench the same question, has them grade each other anonymously, then a chairman folds the whole round into a single verdict that names where the board agrees, where it splits, and what you should actually do.

A board isn't a survey. It's a falsification pass.

---

## How it works

```
                                                                ┌─────────────────┐
   question  ──┬──▶  Opus    ─┐                                 │  Verdict        │
               │              │                                 │                 │
               ├──▶  Gemini   ├─▶  anonymise  ─▶  rank  ─▶  ▶▶  │  · agreements   │
               │              │     A · B · C       blind       │  · splits       │
               └──▶  Qwen    ─┘                                  │  · blind spots  │
                                                                 │  · recommend    │
                                                                 │  · first step   │
                                                                 └─────────────────┘

       stage 1                  stage 2                   stage 3
   independent answers      anonymous peer review     chairman synthesis
```

**Stage 1 — Independent answers.** Every member of the board answers in parallel. Token-by-token streaming straight into a tab view. No member sees what the others wrote.

**Stage 2 — Anonymous peer review.** Responses get re-labelled `A`, `B`, `C`. Every member ranks all of them — including, without knowing it, their own. They name the strongest, the weakest, and the one thing every answer missed.

**Stage 3 — Chairman synthesis.** The designated chairman receives the de-anonymised answers and every peer review, then writes the verdict in five sections: where the board agrees, where it splits, what was caught in peer review, the recommendation, and the one thing to do first.

---

## Quick start

```bash
pnpm install
cp .env.example .env.local        # paste OPENROUTER_API_KEY=sk-or-v1-...
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). Top up $5–10 of credits before your first round — a meaty question runs 50k–100k tokens across the whole board.

---

## The default board

| Seat     | Model                       | Brings                          |
| -------- | --------------------------- | ------------------------------- |
| `opus`   | `anthropic/claude-opus-4`   | Long-context reasoning, nuance  |
| `gemini` | `google/gemini-2.5-pro`     | Adversarial framing, breadth    |
| `qwen`   | `qwen/qwen3-max`            | Outside the western consensus   |

Chairman by default: `opus`. Pick a different chairman per round in the UI, or override the whole roster from `.env.local`:

```bash
BOARD_ROSTER="opus:anthropic/claude-opus-4:Opus,sonnet:anthropic/claude-sonnet-4.5:Sonnet,grok:x-ai/grok-4:Grok"
CHAIRMAN_ID=sonnet
```

Any model OpenRouter routes works. Pick three. Pick eight.

---

## When to convene the board

> Use it when **being wrong is expensive** and the answer **isn't lookup-able**.

**Worth the board:**

- *Price this product at $97 or $497?*
- *Migrate from Postgres to ClickHouse, or shard the writes?*
- *Hire a senior IC or two juniors?*
- *Is this landing-page copy strong enough to launch?*
- *Pivot to the vertical SaaS, or stay broad?*

**Not worth the board:**

- *What's the capital of France?* — one answer exists.
- *Write me a tweet.* — creation task, one model is fine.
- *Summarise this PDF.* — processing, not judgement.

The board is wasted on factual lookups and overkill on creative tasks. Save it for decisions.

---

## What you actually get

- **Parallel streaming** — every model answers at once; you watch the slowest one, not the sum.
- **Real peer review** — anonymised labels (A/B/C), structured rankings validated by Zod, explicit blind-spot detection.
- **A real verdict** — opinionated synthesis, not a both-sides essay. Ends in a single concrete next step.
- **Local transcripts** — every run lands in `data/transcripts/{timestamp}.json`. Yours. On your disk. No cloud anything.
- **Configurable roster** — env var or in-UI checkboxes. Two-minimum, no upper bound.
- **Zero accounts, zero telemetry, zero upsells.**

---

## Built on

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Vercel AI SDK pointed at OpenRouter through the OpenAI-compatible client · Zod for structured output. No state library, no UI kit, no dashboard. Around 600 lines of code, end to end.

```
src/
├── app/
│   ├── page.tsx                 the console
│   └── api/
│       ├── stage1/route.ts      parallel streaming (NDJSON)
│       ├── stage2/route.ts      anonymised review (Zod schema)
│       └── stage3/route.ts      chairman synthesis (text stream)
├── lib/
│   ├── board.ts                 roster & chairman config
│   ├── openrouter.ts            AI SDK ↔ OpenRouter
│   ├── anonymize.ts             Fisher-Yates + reveal mapping
│   ├── transcript.ts            save runs to disk
│   └── prompts/
│       ├── reviewer.ts
│       └── chairman.ts
└── components/
    └── BoardConsole.tsx         client orchestrator
```

---

## Scripts

```bash
pnpm dev          turbopack dev server
pnpm build        production build
pnpm start        serve the build
pnpm lint         eslint
pnpm typecheck    tsc --noEmit
pnpm format       prettier --write
```

---

## Status

This is a tool, not a product. No roadmap, no issue queue, no PR review window. Fork it. Rip out what you don't like. Hand the rest to one of your models when you want it changed — the whole codebase fits in a single prompt.

---

## License

MIT.
