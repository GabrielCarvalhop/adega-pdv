import type { SaleDetail } from '../../api/sales.api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatBRL } from '../../utils/money';

const methodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Cartão débito',
  credito: 'Cartão crédito',
  pix: 'Pix',
};

interface ReceiptPrintProps {
  detail: SaleDetail;
  onClose: () => void;
}

export function ReceiptPrint({ detail, onClose }: ReceiptPrintProps) {
  const { sale, items, payments } = detail;

  return (
    <Modal title={`Venda #${sale.id} concluída`} onClose={onClose}>
      <div id="receipt-print" className="space-y-2 text-sm">
        <div className="text-center">
          <p className="font-bold">ADEGA PDV</p>
          <p className="text-xs text-neutral-500">Comprovante não-fiscal</p>
          <p className="text-xs text-neutral-500">{new Date(sale.createdAt).toLocaleString('pt-BR')}</p>
        </div>

        <div className="border-t border-dashed border-neutral-300 pt-2">
          {items
            .filter((i) => !i.canceled)
            .map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}x {item.productNameSnapshot}
                </span>
                <span>{formatBRL(item.totalCents)}</span>
              </div>
            ))}
        </div>

        <div className="border-t border-dashed border-neutral-300 pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatBRL(sale.subtotalCents)}</span>
          </div>
          {sale.discountCents > 0 && (
            <div className="flex justify-between">
              <span>Desconto</span>
              <span>-{formatBRL(sale.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatBRL(sale.totalCents)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-neutral-300 pt-2">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{methodLabels[p.method]}</span>
              <span>{formatBRL(p.amountCents)}</span>
            </div>
          ))}
          {payments.some((p) => p.changeCents > 0) && (
            <div className="flex justify-between">
              <span>Troco</span>
              <span>{formatBRL(payments.reduce((s, p) => s + p.changeCents, 0))}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 print:hidden">
        <Button variant="secondary" onClick={onClose}>
          Nova venda
        </Button>
        <Button onClick={() => window.print()}>Imprimir</Button>
      </div>
    </Modal>
  );
}
