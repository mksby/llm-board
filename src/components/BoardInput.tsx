'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  disabled: boolean;
  onSubmit: (question: string) => void;
}

export function BoardInput({ disabled, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const canSubmit = !disabled && value.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit(value.trim());
      }}
    >
      <Textarea
        placeholder="Ask the board a hard question..."
        rows={5}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
            e.preventDefault();
            onSubmit(value.trim());
          }
        }}
        className="min-h-[8rem] resize-y"
      />
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">Cmd/Ctrl+Enter to submit</p>
        <Button type="submit" disabled={!canSubmit}>
          Convene the board
        </Button>
      </div>
    </form>
  );
}
