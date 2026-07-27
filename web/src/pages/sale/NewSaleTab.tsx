import type { AddonGroupWithOptions, CreateSalePaymentInput, Product, SaleType } from '@adega/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cashApi } from '../../api/cash.api';
import { customersApi } from '../../api/customers.api';
import { productsApi } from '../../api/products.api';
import { SaleDetail, salesApi } from '../../api/sales.api';
import { useAuth } from '../../auth/AuthContext';
import { AddonSelectionModal } from '../../components/AddonSelectionModal';
import { CartLine, CartTable, lineTotalCents } from '../../components/CartTable';
import { ProductSearchInput } from '../../components/ProductSearchInput';
import { Button } from '../../components/ui/Button';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { formatBRL, parseMoneyInput } from '../../utils/money';
import { PaymentModal } from './PaymentModal';
import { ReceiptPrint } from './ReceiptPrint';

interface SuspendedSale {
  cart: CartLine[];
  customerId: number | '';
  discountInput: string;
  saleType: SaleType;
  suspendedAt: string;
}

const SUSPENDED_KEY = 'adega_suspended_sales';

function loadSuspended(): SuspendedSale[] {
  try {
    return JSON.parse(localStorage.getItem(SUSPENDED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveSuspended(sales: SuspendedSale[]) {
  localStorage.setItem(SUSPENDED_KEY, JSON.stringify(sales));
}

function focusSearch() {
  document.getElementById('product-search-input')?.focus();
}

function ItemEditor({
  line,
  onApply,
}: {
  line: CartLine;
  onApply: (discountCents: number | undefined, note: string | undefined) => void;
}) {
  const lineSubtotal = line.unitPriceCents * line.quantity;
  const [mode, setMode] = useState<'valor' | 'percent'>('valor');
  const [discountInput, setDiscountInput] = useState(
    line.discountCents ? (line.discountCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [note, setNote] = useState(line.note ?? '');

  const discountCents =
    mode === 'valor'
      ? Math.min(parseMoneyInput(discountInput), lineSubtotal)
      : Math.min(Math.round((lineSubtotal * (Number(discountInput.replace(',', '.')) || 0)) / 100), lineSubtotal);

  function apply() {
    onApply(discountCents || undefined, note.trim() || undefined);
    focusSearch();
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="mb-2 text-sm font-medium text-gray-900">Item: {line.name}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-slate-500">Desconto do item</label>
          <div className="mt-1 flex">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'valor' | 'percent')}
              className="rounded-l-xl border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="valor">R$</option>
              <option value="percent">%</option>
            </select>
            <input
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), apply())}
              placeholder="0,00"
              inputMode="decimal"
              className="w-24 rounded-r-xl border border-l-0 border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-500">Observação</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), apply())}
            placeholder="Ex.: sem gelo, embalar separado..."
            className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <Button type="button" onClick={apply}>
          Aplicar
        </Button>
      </div>
      {discountCents > 0 && (
        <p className="mt-1 text-xs text-amber-700">
          Novo total do item: {formatBRL(lineSubtotal - discountCents)}
        </p>
      )}
    </div>
  );
}

export function NewSaleTab() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [saleType, setSaleType] = useState<SaleType>('varejo');
  const [showPayment, setShowPayment] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null);
  const [suspendedCount, setSuspendedCount] = useState(() => loadSuspended().length);
  const [flash, setFlash] = useState<string | null>(null);
  const [addonPrompt, setAddonPrompt] = useState<{ product: Product; groups: AddonGroupWithOptions[] } | null>(
    null
  );
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
    queryKey: ['customers', 'lite'],
    queryFn: () => customersApi.listLite(),
  });

  const subtotalCents = cart.reduce((sum, l) => sum + lineTotalCents(l), 0);
  const discountCents = Math.min(parseMoneyInput(discountInput), subtotalCents);
  const totalCents = subtotalCents - discountCents;

  // Aviso rápido não-bloqueante (suspensão, recuperação...). Some sozinho.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(timer);
  }, [flash]);

  // Quando qualquer modal fecha, o foco volta para a busca — o operador
  // nunca precisa clicar para continuar bipando.
  useEffect(() => {
    if (!showPayment && !completedSale && !addonPrompt) {
      const timer = setTimeout(focusSearch, 50);
      return () => clearTimeout(timer);
    }
  }, [showPayment, completedSale, addonPrompt]);

  function pushLine(product: Product, addons?: CartLine['addons'], extraPriceCentsTotal = 0) {
    setCart((prev) => {
      if (!addons || addons.length === 0) {
        const existingIndex = prev.findIndex((l) => l.productId === product.id && !l.addons?.length);
        if (existingIndex >= 0) {
          return prev.map((l, i) =>
            i === existingIndex && l.quantity < l.maxQuantity ? { ...l, quantity: l.quantity + 1 } : l
          );
        }
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPriceCents: product.salePriceCents + extraPriceCentsTotal,
          quantity: 1,
          maxQuantity: product.isCombo ? 99 : product.stockQuantity,
          addons,
        },
      ];
    });
  }

  async function addProduct(product: Product) {
    const groups = await productsApi.listAvailableAddons(product.id);
    if (groups.length === 0) {
      pushLine(product);
      return;
    }
    setAddonPrompt({ product, groups });
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

  function suspendSale() {
    if (cart.length === 0) return;
    const suspended = loadSuspended();
    suspended.push({
      cart,
      customerId,
      discountInput,
      saleType,
      suspendedAt: new Date().toISOString(),
    });
    saveSuspended(suspended);
    setSuspendedCount(suspended.length);
    setCart([]);
    setDiscountInput('');
    setCustomerId('');
    setSaleType('varejo');
    setSelectedIndex(null);
    setFlash('Venda suspensa — F8 recupera quando o cliente voltar');
    focusSearch();
  }

  function resumeSale() {
    const suspended = loadSuspended();
    if (suspended.length === 0) return;
    if (cart.length > 0) {
      setFlash('Finalize ou suspenda (F7) a venda atual antes de recuperar outra');
      return;
    }
    const last = suspended.pop()!;
    saveSuspended(suspended);
    setSuspendedCount(suspended.length);
    setCart(last.cart);
    setCustomerId(last.customerId);
    setDiscountInput(last.discountInput);
    setSaleType(last.saleType);
    setFlash('Venda recuperada');
    focusSearch();
  }

  const mutation = useMutation({
    mutationFn: (payments: CreateSalePaymentInput[]) =>
      salesApi.create({
        items: cart.map((l) => {
          const addonsExtra = l.addons?.reduce((sum, a) => sum + a.extraPriceCents, 0) ?? 0;
          return {
            productId: l.productId,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents - addonsExtra,
            discountCents: l.discountCents || undefined,
            notes: l.note || undefined,
            addons: l.addons?.map((a) => ({ addonOptionId: a.addonOptionId })),
          };
        }),
        payments,
        discountCents: discountCents || undefined,
        customerId: customerId === '' ? undefined : customerId,
        cashSessionId: activeSession?.id,
        saleType,
      }),
    onSuccess: (detail) => {
      setShowPayment(false);
      setSaleError(null);
      setCompletedSale(detail);
      setCart([]);
      setDiscountInput('');
      setCustomerId('');
      setSaleType('varejo');
      setSelectedIndex(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (err: Error) => setSaleError(err.message),
  });

  const anyModalOpen = showPayment || completedSale !== null || addonPrompt !== null;

  useKeyboardShortcuts([
    { key: 'F2', handler: () => !anyModalOpen && focusSearch(), allowInInput: true },
    {
      key: 'F3',
      handler: () => !anyModalOpen && document.getElementById('customer-select')?.focus(),
      allowInInput: true,
    },
    {
      key: 'F4',
      handler: () => {
        if (anyModalOpen || cart.length === 0) return;
        const index = selectedIndex ?? cart.length - 1;
        setSelectedIndex(index);
        document.getElementById(`cart-qty-${index}`)?.focus();
      },
      allowInInput: true,
    },
    {
      key: 'F5',
      handler: () => !anyModalOpen && document.getElementById('discount-input')?.focus(),
      allowInInput: true,
    },
    { key: 'F6', handler: () => !anyModalOpen && cart.length > 0 && setShowPayment(true), allowInInput: true },
    { key: 'F7', handler: () => !anyModalOpen && suspendSale(), allowInInput: true },
    { key: 'F8', handler: () => !anyModalOpen && resumeSale(), allowInInput: true },
    { key: 'F9', handler: () => !anyModalOpen && cart.length > 0 && setShowPayment(true), allowInInput: true },
    { key: 'Delete', handler: () => selectedIndex !== null && removeLine(selectedIndex) },
    {
      key: 'ArrowDown',
      handler: () =>
        cart.length > 0 &&
        setSelectedIndex((i) => (i === null ? 0 : Math.min(i + 1, cart.length - 1))),
    },
    {
      key: 'ArrowUp',
      handler: () =>
        cart.length > 0 && setSelectedIndex((i) => (i === null ? cart.length - 1 : Math.max(i - 1, 0))),
    },
    {
      key: 'Escape',
      handler: () => {
        if (!anyModalOpen) setSelectedIndex(null);
      },
    },
  ]);

  if (loadingCash) return <div className="p-8 text-slate-500">Carregando...</div>;

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
        <div className="mx-auto max-w-sm rounded-xl border border-gray-300 p-6 text-center">
          <p className="font-medium text-gray-900">Em qual caixa este terminal vai vender?</p>
          <p className="mt-1 text-sm text-slate-500">
            Há {openSessions.length} caixas abertos — escolha o deste computador.
          </p>
          <div className="mt-4 space-y-2">
            {openSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseRegister(s.id)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-900 hover:bg-gray-100"
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
    <div className="flex min-h-full flex-col">
      <div className="grid flex-1 grid-cols-3 gap-6 p-6">
        <div className="col-span-2 space-y-4">
          <div className="flex items-baseline justify-between">
            <div className="text-sm">
              {flash && <span className="font-medium text-amber-700">{flash}</span>}
              {!flash && suspendedCount > 0 && (
                <button onClick={resumeSale} className="font-medium text-amber-600 hover:underline">
                  {suspendedCount} venda{suspendedCount > 1 ? 's' : ''} suspensa
                  {suspendedCount > 1 ? 's' : ''} — recuperar (F8)
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {activeSession.registerLabel}
              {openSessions.length > 1 && (
                <button onClick={() => chooseRegister('')} className="ml-2 text-amber-600 hover:underline">
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
          {selectedIndex !== null && cart[selectedIndex] && (
            <ItemEditor
              line={cart[selectedIndex]}
              onApply={(discountCents, note) => {
                setCart((prev) =>
                  prev.map((l, i) => (i === selectedIndex ? { ...l, discountCents, note } : l))
                );
              }}
            />
          )}
        </div>

        <div className="rounded-xl border border-gray-300 p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Resumo</h2>
          <div className="mb-3">
            <label htmlFor="customer-select" className="block text-sm text-slate-500">
              Cliente (opcional — F3)
            </label>
            <select
              id="customer-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Consumidor não identificado</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {customerId !== '' &&
              (() => {
                const selected = customers?.find((c) => c.id === customerId);
                if (!selected || selected.balanceCents === 0) return null;
                const isDebt = selected.balanceCents < 0;
                return (
                  <p className={`mt-1 text-xs ${isDebt ? 'text-red-600' : 'text-green-600'}`}>
                    {isDebt
                      ? `Deve ${formatBRL(-selected.balanceCents)}`
                      : `Crédito de ${formatBRL(selected.balanceCents)}`}
                  </p>
                );
              })()}
          </div>
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={saleType === 'atacado'}
              onChange={(e) => setSaleType(e.target.checked ? 'atacado' : 'varejo')}
            />
            Venda no atacado
          </label>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatBRL(subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="discount-input" className="text-slate-500">
                Desconto (F5)
              </label>
              <input
                id="discount-input"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    cart.length > 0 ? setShowPayment(true) : focusSearch();
                  }
                }}
                placeholder="0,00"
                inputMode="decimal"
                className="w-24 rounded-xl border border-gray-300 px-2 py-1 text-right"
              />
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 text-2xl font-bold">
              <span>Total</span>
              <span>{formatBRL(totalCents)}</span>
            </div>
          </div>

          <Button
            className="mt-4 w-full py-3 text-base"
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
          >
            Pagamento (F6)
          </Button>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            disabled={cart.length === 0}
            onClick={suspendSale}
          >
            Suspender venda (F7)
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white px-6 py-2 text-center text-xs text-slate-400 print:hidden">
        <span className="font-medium">F2</span> busca · <span className="font-medium">F3</span> cliente ·{' '}
        <span className="font-medium">F4</span> qtd · <span className="font-medium">F5</span> desconto ·{' '}
        <span className="font-medium">F6/F9</span> pagamento · <span className="font-medium">F7</span> suspender ·{' '}
        <span className="font-medium">F8</span> recuperar · <span className="font-medium">↑↓</span> seleciona item ·{' '}
        <span className="font-medium">Del</span> remove · <span className="font-medium">Esc</span> fecha
      </div>

      {showPayment && (
        <PaymentModal
          totalCents={totalCents}
          saleType={saleType}
          customerId={customerId}
          customers={customers ?? []}
          onCustomerChange={setCustomerId}
          onClose={() => setShowPayment(false)}
          onConfirm={(payments) => mutation.mutate(payments)}
          submitting={mutation.isPending}
          error={saleError}
        />
      )}

      {completedSale && (
        <ReceiptPrint
          detail={completedSale}
          onClose={() => setCompletedSale(null)}
          sellerName={user?.name}
          registerLabel={activeSession.registerLabel}
          customerName={customers?.find((c) => c.id === completedSale.sale.customerId)?.name}
        />
      )}

      {addonPrompt && (
        <AddonSelectionModal
          productName={addonPrompt.product.name}
          groups={addonPrompt.groups}
          onCancel={() => setAddonPrompt(null)}
          onConfirm={(selections, extraPriceCentsTotal) => {
            const addons = selections.map((s) => {
              const option = addonPrompt.groups
                .flatMap((g) => g.options)
                .find((o) => o.id === s.addonOptionId)!;
              return { addonOptionId: option.id, label: option.label, extraPriceCents: option.extraPriceCents };
            });
            pushLine(addonPrompt.product, addons, extraPriceCentsTotal);
            setAddonPrompt(null);
          }}
        />
      )}
    </div>
  );
}
