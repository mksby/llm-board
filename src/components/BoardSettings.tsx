'use client';

import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

// Radix Select doesn't allow empty-string values, so we use a sentinel for
// "no lens assigned" and translate at the boundary.
const LENS_NONE = '__none__';

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
      m.id === memberId
        ? lens
          ? { ...m, lens }
          : { id: m.id, model: m.model, label: m.label }
        : m,
    );
    onActiveChange(next);
  }

  const chairmanLabel = active.find((m) => m.id === chairmanId)?.label ?? chairmanId;
  const lensSummary = active.filter((m) => m.lens).length;

  return (
    <Collapsible className="bg-card rounded-md border">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-4 py-3 text-xs">
        <span>
          Board settings ({active.length} members
          {lensSummary > 0 && ` · ${lensSummary} with lens`}
          {' · '}chairman: {chairmanLabel})
        </span>
        <ChevronDown className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">
        <div className="flex flex-col gap-4 text-xs">
          <div>
            <Label className="text-muted-foreground mb-1.5 block">Chairman</Label>
            <Select
              value={chairmanId}
              onValueChange={(v) => v && onChairmanChange(v)}
              disabled={disabled}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-muted-foreground mb-1.5 block">Members &amp; lenses</Label>
            <ul className="space-y-2">
              {fullRoster.map((m) => {
                const checked = activeIds.has(m.id);
                const activeMember = active.find((x) => x.id === m.id);
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={disabled || (checked && active.length <= 2)}
                      onCheckedChange={() => toggle(m)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{m.label}</div>
                      <div className="text-muted-foreground truncate font-mono text-[10px]">
                        {m.model}
                      </div>
                    </div>
                    <Select
                      value={activeMember?.lens ?? LENS_NONE}
                      disabled={disabled || !checked}
                      onValueChange={(v) => {
                        if (!v) return;
                        setLens(m.id, v === LENS_NONE ? undefined : (v as LensId));
                      }}
                    >
                      <SelectTrigger className="w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={LENS_NONE}>no lens</SelectItem>
                        {Object.values(LENSES).map((lens) => (
                          <SelectItem key={lens.id} value={lens.id}>
                            {lens.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground mt-2 text-[10px]">
              Minimum 2 members. A lens overlays a thinking style on top of the model.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
