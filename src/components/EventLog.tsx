'use client';

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type LogStage = 1 | 2 | 3 | 'system';
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  stage: LogStage;
  memberLabel?: string;
  level: LogLevel;
  message: string;
}

interface Props {
  logs: readonly LogEntry[];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function stageLabel(stage: LogStage): string {
  if (stage === 'system') return '·';
  return `S${stage}`;
}

function stageVariant(stage: LogStage): 'secondary' | 'outline' {
  return stage === 'system' ? 'outline' : 'secondary';
}

export function EventLog({ logs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm tracking-wide uppercase">Event log</CardTitle>
        <div className="flex gap-1">
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {errorCount} {errorCount === 1 ? 'error' : 'errors'}
            </Badge>
          )}
          {warnCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {logs.length} {logs.length === 1 ? 'event' : 'events'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="max-h-72 overflow-auto font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No events yet. Submit a question to start a round.</p>
          ) : (
            <ul className="space-y-0.5">
              {logs.map((entry) => (
                <li
                  key={entry.id}
                  className={
                    entry.level === 'error'
                      ? 'text-destructive'
                      : entry.level === 'warn'
                        ? 'text-amber-700'
                        : ''
                  }
                >
                  <span className="text-muted-foreground">{formatTime(entry.timestamp)}</span>{' '}
                  <Badge variant={stageVariant(entry.stage)} className="px-1 py-0 text-[10px] align-middle">
                    {stageLabel(entry.stage)}
                  </Badge>{' '}
                  {entry.memberLabel && (
                    <span className="text-foreground/80">{entry.memberLabel} · </span>
                  )}
                  <span>{entry.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
