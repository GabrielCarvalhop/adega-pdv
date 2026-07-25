import type { AddonGroupWithOptions, CreateItemAddonSelection } from '@adega/shared';
import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { formatBRL } from '../utils/money';

interface AddonSelectionModalProps {
  productName: string;
  groups: AddonGroupWithOptions[];
  onConfirm: (selections: CreateItemAddonSelection[], extraPriceCentsTotal: number) => void;
  onCancel: () => void;
}

export function AddonSelectionModal({ productName, groups, onConfirm, onCancel }: AddonSelectionModalProps) {
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  function toggleOption(group: AddonGroupWithOptions, optionId: number) {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selectionType === 'single') {
        return { ...prev, [group.id]: current.includes(optionId) ? [] : [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.maxSelect) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  const isValid = groups.every((g) => {
    const count = (selected[g.id] ?? []).length;
    return count >= g.minSelect && count <= g.maxSelect;
  });

  const extraPriceCentsTotal = groups.reduce((sum, g) => {
    const ids = selected[g.id] ?? [];
    return sum + ids.reduce((s, id) => s + (g.options.find((o) => o.id === id)?.extraPriceCents ?? 0), 0);
  }, 0);

  function handleConfirm() {
    const selections: CreateItemAddonSelection[] = groups.flatMap((g) =>
      (selected[g.id] ?? []).map((addonOptionId) => ({ addonOptionId }))
    );
    onConfirm(selections, extraPriceCentsTotal);
  }

  return (
    <Modal title={`Complementos — ${productName}`} onClose={onCancel}>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        {groups.map((group) => {
          const count = (selected[group.id] ?? []).length;
          return (
            <div key={group.id}>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-gray-900">{group.name}</p>
                <span className="text-xs text-slate-400">
                  {group.minSelect >= 1 ? 'Obrigatório' : 'Opcional'}
                  {group.selectionType === 'multiple' && ` · até ${group.maxSelect}`}
                </span>
              </div>
              {group.description && <p className="text-xs text-slate-400">{group.description}</p>}
              <div className="mt-2 space-y-1">
                {group.options.map((option) => {
                  const isSelected = (selected[group.id] ?? []).includes(option.id);
                  const disabled =
                    !isSelected && group.selectionType === 'multiple' && count >= group.maxSelect;
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                        isSelected ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type={group.selectionType === 'single' ? 'radio' : 'checkbox'}
                          name={`addon-group-${group.id}`}
                          checked={isSelected}
                          disabled={disabled}
                          onChange={() => toggleOption(group, option.id)}
                        />
                        {option.label}
                      </span>
                      {option.extraPriceCents > 0 && (
                        <span className="text-slate-500">+ {formatBRL(option.extraPriceCents)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
        <span className="text-sm text-slate-500">
          {extraPriceCentsTotal > 0 ? `+ ${formatBRL(extraPriceCentsTotal)}` : 'Sem custo adicional'}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={!isValid} onClick={handleConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
