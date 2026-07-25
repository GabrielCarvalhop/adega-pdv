import { useEffect } from 'react';
import type { SaleDetail } from '../../api/sales.api';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { formatBRL } from '../../utils/money';

interface ReceiptPrintProps {
  detail: SaleDetail;
  onClose: () => void;
  sellerName?: string;
  registerLabel?: string;
  customerName?: string;
}

export function ReceiptPrint({ detail, onClose, sellerName, registerLabel, customerName }: ReceiptPrintProps) {
  const { sale, items, payments } = detail;
  const { user } = useAuth();

  // Enter emenda direto na próxima venda — tratado aqui (e não só via botão
  // focado) para funcionar mesmo se o foco estiver em outro lugar do modal.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <Modal title={`Venda #${sale.id} concluída`} onClose={onClose}>
      <div id="receipt-print" className="space-y-2 text-sm">
        <div className="text-center">
          <p className="font-bold">{user?.storeName ?? 'Comprovante de venda'}</p>
          <p className="text-xs text-slate-500">Comprovante não-fiscal · Venda #{sale.id}</p>
          <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleString('pt-BR')}</p>
          {(sellerName || registerLabel || customerName) && (
            <p className="mt-1 text-xs text-slate-500">
              {sellerName && `Vendedor: ${sellerName}`}
              {sellerName && registerLabel && ' · '}
              {registerLabel && `Caixa: ${registerLabel}`}
              {(sellerName || registerLabel) && customerName && ' · '}
              {customerName && `Cliente: ${customerName}`}
            </p>
          )}
        </div>

        <div className="border-t border-dashed border-gray-300 pt-2">
          {items
            .filter((i) => !i.canceled)
            .map((item) => (
              <div key={item.id}>
                <div className="flex justify-between">
                  <span>
                    {item.quantity}x {item.productNameSnapshot}
                  </span>
                  <span>{formatBRL(item.totalCents)}</span>
                </div>
                {item.addons.map((addon) => (
                  <div key={addon.id} className="flex justify-between pl-3 text-xs text-slate-500">
                    <span>+ {addon.labelSnapshot}</span>
                    {addon.extraPriceCentsSnapshot > 0 && (
                      <span>{formatBRL(addon.extraPriceCentsSnapshot)}</span>
                    )}
                  </div>
                ))}
                {item.notes && <div className="pl-3 text-xs italic text-slate-400">"{item.notes}"</div>}
              </div>
            ))}
        </div>

        <div className="border-t border-dashed border-gray-300 pt-2">
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
          {sale.surchargeCents > 0 && (
            <div className="flex justify-between">
              <span>Acréscimo (atacado)</span>
              <span>+{formatBRL(sale.surchargeCents)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatBRL(sale.totalCents)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-300 pt-2">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{p.methodLabel}</span>
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

      <div className="mt-6 flex items-center justify-between gap-2 print:hidden">
        <span className="text-xs text-slate-400">Enter inicia a próxima venda</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
          {/* autoFocus: Enter emenda direto na próxima venda, sem mouse. */}
          <Button autoFocus onClick={onClose}>
            Nova venda (Enter)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
