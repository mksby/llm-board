# llm-board

A board of LLMs answers your hard questions side-by-side, peer-reviews each other anonymously, then a chairman synthesises the final verdict.

You ask one model, you get one answer. That answer might be great. It might be wrong in a confident-sounding way. The board fan-outs your question across multiple frontier models, has them rank each other's reasoning without knowing who said what, then a designated chairman folds everything into one recommendation that names where the board agrees, where it splits, and what you should actually do.

## How it works

| Stage | What happens | UI |
|---|---|---|
| **1. Independent answers** | Every board member answers the question in parallel | Tab view, token-by-token streaming |
| **2. Peer review** | Responses are anonymised, every member ranks all answers and flags blind spots | Ranked grid |
| **3. Chairman synthesis** | The chairman receives de-anonymised answers plus all reviews, streams a structured verdict | Verdict panel |

The full transcript of every run (including the anonymisation mapping) is saved under `data/transcripts/`.

## Default board

| Id | Model |
|---|---|
| `opus` | Claude Opus (Anthropic) |
| `gemini` | Gemini Pro (Google) |
| `qwen` | Qwen 3 Max (Alibaba) |

Chairman by default: `opus`. Override either through `BOARD_ROSTER` / `CHAIRMAN_ID` env vars or in the UI settings panel.

## Setup

Requires Node 24 (pinned in `.mise.toml`) and pnpm 10.

```bash
pnpm install
cp .env.example .env.local
# put OPENROUTER_API_KEY=sk-or-v1-... into .env.local
pnpm dev
```

Open http://localhost:3000.

Get an OpenRouter key at https://openrouter.ai/keys. Top up credits before running — one full three-stage round on a hard question can cost 50k–100k tokens across all models.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |

## Project layout

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # main UI
│   ├── globals.css
│   └── api/
│       ├── stage1/route.ts    # parallel streaming answers
│       ├── stage2/route.ts    # anonymised peer review
│       └── stage3/route.ts    # chairman synthesis
├── lib/
│   ├── board.ts               # roster + chairman defaults
│   ├── openrouter.ts          # AI SDK client
│   ├── anonymize.ts           # shuffle / un-shuffle helper
│   ├── transcript.ts          # save runs to data/transcripts/
│   └── prompts/
│       ├── reviewer.ts
│       └── chairman.ts
└── components/
    ├── BoardInput.tsx
    ├── StageOneTabs.tsx
    ├── StageTwoGrid.tsx
    ├── StageThreeVerdict.tsx
    └── BoardSettings.tsx
data/transcripts/              # gitignored, one JSON per run
```

## What questions benefit from the board

Use it when being wrong is expensive and there is real uncertainty: pricing decisions, positioning angles, framework / architecture choices, hire-vs-build, pivot-or-stay, "is this idea fatally flawed". Skip it for factual lookups, trivial yes/no questions, and creation tasks (it will not write a tweet better than one model alone).
