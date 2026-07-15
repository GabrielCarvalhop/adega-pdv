import { formatBRL } from '../utils/money';

export interface CartLine {
  productId: number;
  name: string;
  unitPriceCents: number;
  quantity: number;
  maxQuantity: number;
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
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-neutral-300 text-neutral-400">
        Carrinho vazio — bipe ou busque um produto para começar
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-neutral-200 text-left text-neutral-500">
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
            className={`cursor-pointer border-b border-neutral-100 ${
              selectedIndex === index ? 'bg-blue-50' : ''
            }`}
          >
            <td className="py-2">{line.name}</td>
            <td className="py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeQuantity(index, line.quantity - 1);
                  }}
                  className="h-6 w-6 rounded bg-neutral-100 hover:bg-neutral-200"
                >
                  −
                </button>
                <span className="w-6 text-center">{line.quantity}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeQuantity(index, line.quantity + 1);
                  }}
                  disabled={line.quantity >= line.maxQuantity}
                  className="h-6 w-6 rounded bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </td>
            <td className="py-2">{formatBRL(line.unitPriceCents)}</td>
            <td className="py-2 font-medium">{formatBRL(line.unitPriceCents * line.quantity)}</td>
            <td className="py-2 text-right">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                className="text-red-500 hover:underline"
              >
                Remover
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
