'use client';

import type { BoardMember } from '@/lib/board';
import { LENSES, type LensId } from '@/lib/lenses';

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
      ? active.filter((m) => m.id !== member.id)
      : [...active, member];
    onActiveChange(next);
  }

  function setLens(memberId: string, lens: LensId | undefined) {
    const next = active.map((m): BoardMember =>
      m.id === memberId ? (lens ? { ...m, lens } : { id: m.id, model: m.model, label: m.label }) : m,
    );
    onActiveChange(next);
  }

  const chairmanLabel = active.find((m) => m.id === chairmanId)?.label ?? chairmanId;
  const lensSummary = active.filter((m) => m.lens).length;

  return (
    <details className="border-board-border bg-board-surface rounded-md border px-4 py-3">
      <summary className="text-board-muted hover:text-board-text cursor-pointer text-xs select-none">
        Board settings ({active.length} members · {lensSummary > 0 ? `${lensSummary} with lens · ` : ''}
        chairman: {chairmanLabel})
      </summary>
      <div className="mt-3 flex flex-col gap-4 text-xs">
        <fieldset>
          <legend className="text-board-muted mb-1.5">Chairman</legend>
          <select
            className="border-board-border bg-board-bg w-full max-w-xs rounded-md border px-2 py-1"
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
        <fieldset>
          <legend className="text-board-muted mb-1.5">Members &amp; lenses</legend>
          <table className="w-full border-separate border-spacing-y-1">
            <tbody>
              {fullRoster.map((m) => {
                const checked = activeIds.has(m.id);
                const activeMember = active.find((x) => x.id === m.id);
                return (
                  <tr key={m.id}>
                    <td className="w-6 align-middle">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || (checked && active.length <= 2)}
                        onChange={() => toggle(m)}
                      />
                    </td>
                    <td className="align-middle">
                      <div>{m.label}</div>
                      <div className="text-board-muted font-mono text-[10px]">{m.model}</div>
                    </td>
                    <td className="w-44 align-middle">
                      <select
                        className="border-board-border bg-board-bg w-full rounded-md border px-2 py-1 disabled:opacity-40"
                        value={activeMember?.lens ?? ''}
                        disabled={disabled || !checked}
                        onChange={(e) =>
                          setLens(m.id, e.target.value === '' ? undefined : (e.target.value as LensId))
                        }
                      >
                        <option value="">no lens</option>
                        {Object.values(LENSES).map((lens) => (
                          <option key={lens.id} value={lens.id}>
                            {lens.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-board-muted mt-1 text-[10px]">
            Minimum 2 members. A lens overlays a thinking style on top of the model — leave empty
            to let the model answer in its default voice.
          </p>
        </fieldset>
      </div>
    </details>
  );
}
