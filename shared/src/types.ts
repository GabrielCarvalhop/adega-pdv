export type ProductCategory =
  | 'vinho'
  | 'cerveja'
  | 'destilado'
  | 'espumante'
  | 'licor'
  | 'outro';

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  brand: string | null;
  volumeMl: number | null;
  barcode: string | null;
  sku: string | null;
  costPriceCents: number;
  salePriceCents: number;
  stockQuantity: number;
  minStock: number;
  active: boolean;
  visibleInCatalog: boolean;
  imageUrl: string | null;
  catalogSubtitle: string | null;
  /** Preço "de" (riscado) no cardápio quando maior que salePriceCents. */
  compareAtPriceCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType =
  | 'entrada_manual'
  | 'saida_manual'
  | 'ajuste'
  | 'venda'
  | 'cancelamento_venda'
  | 'pedido'
  | 'cancelamento_pedido'
  | 'devolucao'
  | 'perda'
  | 'avaria'
  | 'consumo_interno';

export interface StockMovement {
  id: number;
  productId: number;
  type: StockMovementType;
  quantity: number;
  prevQuantity: number | null;
  nextQuantity: number | null;
  reason: string | null;
  unitCostCents: number | null;
  saleId: number | null;
  orderId: number | null;
  userId: number | null;
  createdAt: string;
}

export type SaleStatus = 'aberta' | 'concluida' | 'cancelada';

export type FiscalStatus =
  | 'nao_emitida'
  | 'pendente'
  | 'emitida'
  | 'erro'
  | 'cancelada';

export interface Sale {
  id: number;
  status: SaleStatus;
  subtotalCents: number;
  discountCents: number;
  discountPercent: number | null;
  totalCents: number;
  cashSessionId: number;
  fiscalStatus: FiscalStatus;
  fiscalDocumentId: string | null;
  userId: number | null;
  customerId: number | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  completedAt: string | null;
  canceledAt: string | null;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  discountCents: number;
  totalCents: number;
  canceled: boolean;
}

export type PaymentMethod = 'dinheiro' | 'debito' | 'credito' | 'pix';

export interface Payment {
  id: number;
  saleId: number;
  method: PaymentMethod;
  amountCents: number;
  amountReceivedCents: number | null;
  changeCents: number;
  createdAt: string;
}

export type CashSessionStatus = 'aberto' | 'fechado';

export interface CashSession {
  id: number;
  status: CashSessionStatus;
  registerLabel: string;
  openingAmountCents: number;
  expectedAmountCents: number | null;
  countedAmountCents: number | null;
  differenceCents: number | null;
  openedAt: string;
  closedAt: string | null;
  openedByUserId: number | null;
  closedByUserId: number | null;
  notes: string | null;
}

export interface PaymentBreakdown {
  dinheiro: number;
  debito: number;
  credito: number;
  pix: number;
}

export interface CashSessionSummary {
  session: CashSession;
  salesCount: number;
  salesTotalCents: number;
  paymentBreakdown: PaymentBreakdown;
  suprimentosCents: number;
  sangriasCents: number;
  canceledCount: number;
}

export interface DailyConsolidatedRegister {
  cashSessionId: number;
  registerLabel: string;
  status: CashSessionStatus;
  openedAt: string;
  closedAt: string | null;
  salesTotalCents: number;
  paymentBreakdown: PaymentBreakdown;
  differenceCents: number | null;
}

export interface DailyConsolidated {
  date: string;
  registers: DailyConsolidatedRegister[];
  totals: {
    salesTotalCents: number;
    paymentBreakdown: PaymentBreakdown;
    balcaoCents: number;
    onlineCents: number;
    totalDifferenceCents: number;
  };
}

export type CashMovementType = 'sangria' | 'suprimento';

export interface CashMovement {
  id: number;
  cashSessionId: number;
  type: CashMovementType;
  amountCents: number;
  reason: string;
  userId: number | null;
  createdAt: string;
}

export type UserRole = 'admin' | 'gerente' | 'operador';

export interface AuditLog {
  id: number;
  userId: number | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface AuthUser {
  token: string;
  user: User;
}

export interface LoginRequest {
  userId: number;
  pin: string;
}

export interface CreateUserRequest {
  name: string;
  role: UserRole;
  pin: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  pin?: string;
  active?: boolean;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  document: string | null;
  birthdate: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  document?: string;
  birthdate?: string;
  address?: string;
  notes?: string;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest> & {
  active?: boolean;
  blocked?: boolean;
};

export interface CustomerAddress {
  id: number;
  customerId: number;
  label: string | null;
  zip: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  reference: string | null;
  isPrimary: boolean;
}

export interface CreateCustomerAddressRequest {
  label?: string;
  zip?: string;
  street: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  reference?: string;
  isPrimary?: boolean;
}

export interface CustomerStats {
  totalPurchases: number;
  totalSpentCents: number;
  avgTicketCents: number;
  lastPurchaseAt: string | null;
  topProducts: { name: string; quantity: number }[];
}

export interface Payable {
  id: number;
  description: string;
  category: string | null;
  amountCents: number;
  dueDate: string;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayableRequest {
  description: string;
  category?: string;
  amountCents: number;
  dueDate: string;
  notes?: string;
}

export type UpdatePayableRequest = Partial<CreatePayableRequest>;

// ---- Request payloads ----

export interface CreateSaleItemInput {
  productId: number;
  quantity: number;
  unitPriceCents: number;
  discountCents?: number;
}

export interface CreateSalePaymentInput {
  method: PaymentMethod;
  amountCents: number;
  amountReceivedCents?: number;
}

export interface CreateSaleRequest {
  items: CreateSaleItemInput[];
  payments: CreateSalePaymentInput[];
  discountCents?: number;
  customerId?: number;
  cashSessionId?: number;
  notes?: string;
}

export interface OpenCashSessionRequest {
  openingAmountCents: number;
  registerLabel: string;
}

export interface CloseCashSessionRequest {
  countedAmountCents: number;
  notes?: string;
}

export interface CreateCashMovementRequest {
  type: CashMovementType;
  amountCents: number;
  reason: string;
}

export interface CreateProductRequest {
  name: string;
  category: ProductCategory;
  brand?: string;
  volumeMl?: number;
  barcode?: string;
  sku?: string;
  costPriceCents: number;
  salePriceCents: number;
  stockQuantity?: number;
  minStock?: number;
}

export type UpdateProductRequest = Partial<CreateProductRequest> & {
  active?: boolean;
  visibleInCatalog?: boolean;
  imageUrl?: string | null;
  catalogSubtitle?: string | null;
  compareAtPriceCents?: number | null;
};

export interface StoreSettings {
  catalogEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeCents: number;
  minOrderCents: number;
  pendingTtlMinutes: number;
  whatsapp: string | null;
  addressText: string | null;
  openingHoursText: string | null;
  catalogLogoUrl: string | null;
  catalogBannerUrl: string | null;
  cityText: string | null;
}

export type UpdateStoreSettingsRequest = Partial<StoreSettings>;

// Item exposto no cardápio público — nunca inclui custo nem quantidade.
export interface CatalogProduct {
  id: number;
  name: string;
  category: ProductCategory;
  brand: string | null;
  volumeMl: number | null;
  salePriceCents: number;
  /** Se preenchido e maior que salePriceCents, aparece nas Promoções. */
  compareAtPriceCents: number | null;
  available: boolean;
  imageUrl: string | null;
  catalogSubtitle: string | null;
}

export interface PublicStoreInfo {
  storeName: string;
  settings: StoreSettings;
}

export type OrderStatus =
  | 'pendente'
  | 'aceito'
  | 'pronto'
  | 'saiu_entrega'
  | 'concluido'
  | 'recusado'
  | 'cancelado'
  | 'expirado';
export type OrderFulfillment = 'entrega' | 'retirada';

export interface Order {
  id: number;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  customerName: string;
  customerPhone: string;
  address: string | null;
  notes: string | null;
  paymentMethodIntent: PaymentMethod;
  changeForCents: number | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  customerId: number | null;
  saleId: number | null;
  rejectReason: string | null;
  createdAt: string;
  acceptedAt: string | null;
  concludedAt: string | null;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productNameSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
}

export interface CreatePublicOrderRequest {
  fulfillment: OrderFulfillment;
  customerName: string;
  customerPhone: string;
  address?: string;
  notes?: string;
  paymentMethodIntent: PaymentMethod;
  changeForCents?: number;
  publicKey: string;
  items: { productId: number; quantity: number }[];
}

export interface PublicOrderStatus {
  id: number;
  status: OrderStatus;
  fulfillment: OrderFulfillment;
  totalCents: number;
  createdAt: string;
}

export type ManualStockMovementType = Extract<
  StockMovementType,
  'entrada_manual' | 'saida_manual' | 'ajuste' | 'devolucao' | 'perda' | 'avaria' | 'consumo_interno'
>;

export interface CreateStockMovementRequest {
  productId: number;
  type: ManualStockMovementType;
  quantity: number;
  reason: string;
  unitCostCents?: number;
}
