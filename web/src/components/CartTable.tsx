import { formatBRL } from '../utils/money';

export interface CartLineAddon {
  addonOptionId: number;
  label: string;
  extraPriceCents: number;
}

export interface CartLine {
  productId: number;
  name: string;
  unitPriceCents: number;
  quantity: number;
  maxQuantity: number;
  addons?: CartLineAddon[];
  discountCents?: number;
  note?: string;
}

export function lineTotalCents(line: CartLine): number {
  return line.unitPriceCents * line.quantity - (line.discountCents ?? 0);
}

interface CartTableProps {
  lines: CartLine[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onChangeQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
}

export function CartTable({ lines, selectedIndex, onSelect, onChangeQuantity, onRemove }: CartTableProps) {
  if (lines.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-300 text-slate-400">
        Carrinho vazio — bipe ou busque um produto para começar
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-300 text-left text-slate-500">
          <th className="py-2">Produto</th>
          <th className="py-2">Qtd</th>
          <th className="py-2">Preço</th>
          <th className="py-2">Total</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr
            key={index}
            onClick={() => onSelect(index)}
            className={`cursor-pointer border-b border-gray-200 ${
              selectedIndex === index ? 'bg-amber-50' : ''
            }`}
          >
            <td className="py-2 pr-2">
              {line.name}
              {line.addons && line.addons.length > 0 && (
                <div className="mt-0.5 text-xs text-slate-400">
                  {line.addons.map((a) => a.label).join(', ')}
                </div>
              )}
              {line.note && <div className="mt-0.5 text-xs italic text-slate-400">"{line.note}"</div>}
            </td>
            <td className="py-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeQuantity(index, line.quantity - 1);
                  }}
                  aria-label="Diminuir quantidade"
                  className="h-9 w-9 rounded-lg bg-gray-100 text-base font-semibold hover:bg-gray-200"
                >
                  −
                </button>
                <input
                  id={`cart-qty-${index}`}
                  type="text"
                  inputMode="numeric"
                  value={line.quantity}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    onSelect(index);
                    e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const value = Number(e.target.value.replace(/\D/g, ''));
                    // Digitar 0 ou apagar não remove na hora — remove só ao
                    // confirmar (blur/Enter), pra não sumir a linha no meio da digitação.
                    if (!Number.isNaN(value) && value > 0) onChangeQuantity(index, value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      document.getElementById('product-search-input')?.focus();
                    }
                  }}
                  className="h-9 w-12 rounded-lg border border-gray-300 text-center font-medium"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeQuantity(index, line.quantity + 1);
                  }}
                  disabled={line.quantity >= line.maxQuantity}
                  aria-label="Aumentar quantidade"
                  className="h-9 w-9 rounded-lg bg-gray-100 text-base font-semibold hover:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </td>
            <td className="py-2">{formatBRL(line.unitPriceCents)}</td>
            <td className="py-2 font-medium">
              {formatBRL(lineTotalCents(line))}
              {line.discountCents ? (
                <div className="text-xs font-normal text-amber-600">−{formatBRL(line.discountCents)}</div>
              ) : null}
            </td>
            <td className="py-2 text-right">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                aria-label={`Remover ${line.name}`}
                className="h-9 w-9 rounded-lg text-lg text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
