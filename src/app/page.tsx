import { BoardConsole } from '@/components/BoardConsole';
import { BOARD, DEFAULT_CHAIRMAN_ID } from '@/lib/board';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">llm-board</h1>
        <p className="text-muted-foreground mt-1 max-w-prose text-sm">
          Ask the board a hard question. Every member answers independently, peer-reviews the others
          anonymously, then the chairman synthesises a verdict.
        </p>
      </header>
      <BoardConsole initialBoard={BOARD} initialChairmanId={DEFAULT_CHAIRMAN_ID} />
    </main>
  );
}
