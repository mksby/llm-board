import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LensId } from './lenses';

const TRANSCRIPTS_DIR = path.resolve(process.cwd(), 'data', 'transcripts');

export interface Transcript {
  id: string;
  createdAt: string;
  question: string;
  board: Array<{ id: string; model: string; label: string; lens?: LensId }>;
  chairmanId: string;
  stage1: Array<{ id: string; text: string }>;
  stage2: {
    /** `letter -> id` reveal mapping that was used when sending to reviewers */
    reveal: Record<string, string>;
    /** One peer review per board member, keyed by reviewer id */
    reviews: Array<{ reviewerId: string; payload: unknown }>;
  };
  stage3: {
    verdict: string;
  };
}

function timestampId(): string {
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, '-');
  return iso;
}

export function newTranscriptId(): string {
  return timestampId();
}

export async function writeTranscript(t: Transcript): Promise<string> {
  await fs.mkdir(TRANSCRIPTS_DIR, { recursive: true });
  const file = path.join(TRANSCRIPTS_DIR, `${t.id}.json`);
  await fs.writeFile(file, JSON.stringify(t, null, 2), 'utf8');
  return file;
}

export async function readTranscript(id: string): Promise<Transcript | null> {
  const file = path.join(TRANSCRIPTS_DIR, `${id}.json`);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as Transcript;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
