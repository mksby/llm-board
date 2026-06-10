'use client';

import type { BoardMember } from '@/lib/board';

interface Props {
  fullRoster: readonly BoardMember[];
  active: readonly BoardMember[];
  chairmanId: string;
  disabled: boolean;
  onActiveChange: (next: readonly BoardMember[]) => void;
  onChairmanChange: (id: string) => void;
}

export function BoardSettings({
  fullRoster,
  active,
  chairmanId,
  disabled,
  onActiveChange,
  onChairmanChange,
}: Props) {
  const activeIds = new Set(active.map((m) => m.id));

  function toggle(member: BoardMember) {
    const next = activeIds.has(member.id)
      ? fullRoster.filter((m) => activeIds.has(m.id) && m.id !== member.id)
      : fullRoster.filter((m) => activeIds.has(m.id) || m.id === member.id);
    onActiveChange(next);
  }

  return (
    <details className="border-board-border bg-board-surface group rounded-md border px-4 py-3">
      <summary className="text-board-muted hover:text-board-text cursor-pointer text-xs select-none">
        Board settings ({active.length} members · chairman: {active.find((m) => m.id === chairmanId)?.label ?? chairmanId})
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <fieldset>
          <legend className="text-board-muted mb-1.5">Members</legend>
          <div className="space-y-1">
            {fullRoster.map((m) => {
              const checked = activeIds.has(m.id);
              return (
                <label key={m.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || (checked && active.length <= 2)}
                    onChange={() => toggle(m)}
                  />
                  <span>{m.label}</span>
                  <span className="text-board-muted font-mono">{m.model}</span>
                </label>
              );
            })}
          </div>
          <p className="text-board-muted mt-1 text-[10px]">Minimum 2 members.</p>
        </fieldset>
        <fieldset>
          <legend className="text-board-muted mb-1.5">Chairman</legend>
          <select
            className="border-board-border bg-board-bg w-full rounded-md border px-2 py-1"
            value={chairmanId}
            disabled={disabled}
            onChange={(e) => onChairmanChange(e.target.value)}
          >
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </fieldset>
      </div>
    </details>
  );
}
