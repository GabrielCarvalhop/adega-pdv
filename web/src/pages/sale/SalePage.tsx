import type { CreateSalePaymentInput, Product } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cashApi } from '../../api/cash.api';
import { customersApi } from '../../api/customers.api';
import { SaleDetail, salesApi } from '../../api/sales.api';
import { CartLine, CartTable } from '../../components/CartTable';
import { ProductSearchInput } from '../../components/ProductSearchInput';
import { Button } from '../../components/ui/Button';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { formatBRL, parseMoneyInput } from '../../utils/money';
import { PaymentModal } from './PaymentModal';
import { ReceiptPrint } from './ReceiptPrint';

export function SalePage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [showPayment, setShowPayment] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);
  const queryClient = useQueryClient();

  const { data: openSessions, isLoading: loadingCash } = useQuery({
    queryKey: ['cash', 'open-sessions'],
    queryFn: () => cashApi.openSessions(),
  });

  // Cada terminal lembra em qual caixa registra as vendas.
  const [registerSessionId, setRegisterSessionId] = useState<number | ''>(() => {
    const saved = localStorage.getItem('adega_register_session');
    return saved ? Number(saved) : '';
  });

  const activeSession =
    openSessions && openSessions.length === 1
      ? openSessions[0]
      : openSessions?.find((s) => s.id === registerSessionId);

  function chooseRegister(id: number | '') {
    setRegisterSessionId(id);
    if (id === '') localStorage.removeItem('adega_register_session');
    else localStorage.setItem('adega_register_session', String(id));
  }

  const { data: customers } = useQuery({
    queryKey: ['customers', { search: '' }],
    queryFn: () => customersApi.list(),
  });

  const subtotalCents = cart.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const discountCents = Math.min(parseMoneyInput(discountInput), subtotalCents);
  const totalCents = subtotalCents - discountCents;

  function addProduct(product: Product) {
    setCart((prev) => {
      const existingIndex = prev.findIndex((l) => l.productId === product.id);
      if (existingIndex >= 0) {
        return prev.map((l, i) =>
          i === existingIndex && l.quantity < l.maxQuantity ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.salePriceCents,
          quantity: 1,
          maxQuantity: product.stockQuantity,
        },
      ];
    });
  }

  function changeQuantity(index: number, quantity: number) {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((l, i) => (i === index ? { ...l, quantity: Math.min(quantity, l.maxQuantity) } : l));
    });
  }

  function removeLine(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
  }

  const mutation = useMutation({
    mutationFn: (payments: CreateSalePaymentInput[]) =>
      salesApi.create({
        items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
        payments,
        discountCents: discountCents || undefined,
        customerId: customerId === '' ? undefined : customerId,
        cashSessionId: activeSession?.id,
      }),
    onSuccess: (detail) => {
      setShowPayment(false);
      setSaleError(null);
      setCompletedSale(detail);
      setCart([]);
      setDiscountInput('');
      setCustomerId('');
      setSelectedIndex(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
    onError: (err: Error) => setSaleError(err.message),
  });

  useKeyboardShortcuts([
    { key: 'F2', handler: () => document.getElementById('product-search-input')?.focus(), allowInInput: true },
    { key: 'F4', handler: () => cart.length > 0 && setShowPayment(true) },
    { key: 'F6', handler: () => document.getElementById('discount-input')?.focus(), allowInInput: true },
    { key: 'F8', handler: () => selectedIndex !== null && removeLine(selectedIndex) },
    { key: 'Delete', handler: () => selectedIndex !== null && removeLine(selectedIndex) },
    {
      key: 'Escape',
      handler: () => {
        if (showPayment) setShowPayment(false);
        else setSelectedIndex(null);
      },
      allowInInput: true,
    },
  ]);

  if (loadingCash) return <div className="p-8 text-neutral-500">Carregando...</div>;

  if (!openSessions || openSessions.length === 0) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-medium text-amber-800">Nenhum caixa aberto</p>
          <p className="mt-1 text-sm text-amber-700">É necessário abrir o caixa antes de iniciar vendas.</p>
          <Link to="/caixa">
            <Button className="mt-4">Abrir caixa</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-sm rounded-lg border border-neutral-200 p-6 text-center">
          <p className="font-medium text-neutral-800">Em qual caixa este terminal vai vender?</p>
          <p className="mt-1 text-sm text-neutral-500">
            Há {openSessions.length} caixas abertos — escolha o deste computador.
          </p>
          <div className="mt-4 space-y-2">
            {openSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseRegister(s.id)}
                className="w-full rounded-lg border border-neutral-200 px-4 py-3 font-medium text-neutral-800 hover:bg-neutral-50"
              >
                {s.registerLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-6 p-8">
      <div className="col-span-2 space-y-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-neutral-800">Venda</h1>
          <p className="text-sm text-neutral-500">
            {activeSession.registerLabel}
            {openSessions.length > 1 && (
              <button onClick={() => chooseRegister('')} className="ml-2 text-blue-600 hover:underline">
                trocar
              </button>
            )}
          </p>
        </div>
        <ProductSearchInput onSelect={addProduct} />
        <CartTable
          lines={cart}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onChangeQuantity={changeQuantity}
          onRemove={removeLine}
        />
      </div>

      <div className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-3 font-semibold text-neutral-800">Resumo</h2>
        <div className="mb-3">
          <label htmlFor="customer-select" className="block text-sm text-neutral-500">
            Cliente (opcional)
          </label>
          <select
            id="customer-select"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Consumidor não identificado</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Subtotal</span>
            <span>{formatBRL(subtotalCents)}</span>
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="discount-input" className="text-neutral-500">
              Desconto (F6)
            </label>
            <input
              id="discount-input"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              placeholder="0,00"
              className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-right"
            />
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatBRL(totalCents)}</span>
          </div>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={cart.length === 0}
          onClick={() => setShowPayment(true)}
        >
          Pagamento (F4)
        </Button>
      </div>

      {showPayment && (
        <PaymentModal
          totalCents={totalCents}
          onClose={() => setShowPayment(false)}
          onConfirm={(payments) => mutation.mutate(payments)}
          submitting={mutation.isPending}
          error={saleError}
        />
      )}

      {completedSale && <ReceiptPrint detail={completedSale} onClose={() => setCompletedSale(null)} />}
    </div>
  );
}
