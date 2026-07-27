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
  /** Ordem de exibição no cardápio público (menor primeiro). */
  sortOrder: number;
  /** Quando true, o estoque próprio não é usado — baixa vem dos combo_items. */
  isCombo: boolean;
  /** Reservado por pedidos online pendentes (stock_reservations não expiradas). */
  reservedQuantity: number;
  /** stockQuantity - reservedQuantity — o que ainda pode ser vendido agora. */
  availableQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderProductsRequest {
  ids: number[];
}

export type QuantityDiscountType = 'percent' | 'fixed';

export interface QuantityDiscountTier {
  id: number;
  productId: number;
  minQuantity: number;
  discountType: QuantityDiscountType;
  /** Percentual inteiro (1-100) se discountType='percent'; centavos por
   * unidade se discountType='fixed'. */
  discountValue: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
}

export interface CreateQuantityDiscountRequest {
  minQuantity: number;
  discountType: QuantityDiscountType;
  discountValue: number;
  startsAt?: string;
  endsAt?: string;
}

export type UpdateQuantityDiscountRequest = Partial<CreateQuantityDiscountRequest> & {
  active?: boolean;
};

// ---- Complementos reutilizáveis (addon groups) ----

export type AddonSelectionType = 'single' | 'multiple';

export interface AddonOption {
  id: number;
  addonGroupId: number;
  label: string;
  /** Quando preenchido, escolher esta opção baixa estoque desse produto. */
  productId: number | null;
  extraPriceCents: number;
  quantityPerSelection: number;
  active: boolean;
  sortOrder: number;
}

export interface AddonGroup {
  id: number;
  name: string;
  description: string | null;
  selectionType: AddonSelectionType;
  /** min_select/max_select são a fonte única de verdade — "obrigatório" na UI
   * é só um atalho que ajusta minSelect (1 = obrigatório, 0 = opcional). */
  minSelect: number;
  maxSelect: number;
  active: boolean;
}

export interface AddonGroupWithOptions extends AddonGroup {
  options: AddonOption[];
}

export interface CreateAddonGroupRequest {
  name: string;
  description?: string;
  selectionType: AddonSelectionType;
  minSelect: number;
  maxSelect: number;
}

export type UpdateAddonGroupRequest = Partial<CreateAddonGroupRequest> & { active?: boolean };

export interface CreateAddonOptionRequest {
  label: string;
  productId?: number;
  extraPriceCents?: number;
  quantityPerSelection?: number;
}

export type UpdateAddonOptionRequest = Partial<CreateAddonOptionRequest> & {
  active?: boolean;
  sortOrder?: number;
};

export interface ProductAddonGroupLink {
  id: number;
  productId: number;
  addonGroupId: number;
  sortOrder: number;
}

/** Seleção de complemento enviada ao criar um item de venda/pedido. */
export interface CreateItemAddonSelection {
  addonOptionId: number;
}

export interface SaleItemAddon {
  id: number;
  saleItemId: number;
  addonOptionId: number | null;
  labelSnapshot: string;
  extraPriceCentsSnapshot: number;
  productIdSnapshot: number | null;
  quantity: number;
}

export interface OrderItemAddon {
  id: number;
  orderItemId: number;
  addonOptionId: number | null;
  labelSnapshot: string;
  extraPriceCentsSnapshot: number;
  productIdSnapshot: number | null;
  quantity: number;
}

// ---- Combos (esqueleto) ----

export interface ComboItem {
  id: number;
  comboProductId: number;
  componentProductId: number;
  /** Nome atual do componente — join de conveniência para a UI, não é snapshot. */
  componentProductName: string;
  quantity: number;
}

export interface CreateComboItemRequest {
  componentProductId: number;
  quantity: number;
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
  /** Nome do produto no momento da consulta (via JOIN) — evita o frontend
   * ter que buscar o catálogo inteiro só pra resolver o nome pelo id. */
  productName: string | null;
  type: StockMovementType;
  quantity: number;
  prevQuantity: number | null;
  nextQuantity: number | null;
  reason: string | null;
  unitCostCents: number | null;
  saleId: number | null;
  orderId: number | null;
  userId: number | null;
  /** Caixa/terminal aberto no momento do movimento manual — nulo em vendas/pedidos (rastreados via saleId/orderId). */
  cashSessionId: number | null;
  registerLabel: string | null;
  createdAt: string;
}

export type SaleStatus = 'aberta' | 'concluida' | 'cancelada';

export type FiscalStatus =
  | 'nao_emitida'
  | 'pendente'
  | 'emitida'
  | 'erro'
  | 'cancelada';

export type SaleType = 'varejo' | 'atacado';

export interface Sale {
  id: number;
  status: SaleStatus;
  saleType: SaleType;
  subtotalCents: number;
  discountCents: number;
  discountPercent: number | null;
  /** Acréscimo automático aplicado (ex.: taxa de cartão no atacado). */
  surchargeCents: number;
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
  notes: string | null;
  addons: SaleItemAddon[];
}

export type PaymentMethodKind = 'dinheiro' | 'pix' | 'cartao' | 'outro' | 'fiado' | 'link_pagamento';

export interface PaymentMethodConfig {
  id: number;
  code: string;
  label: string;
  kind: PaymentMethodKind;
  active: boolean;
  sortOrder: number;
  icon: string | null;
  /** Se o fluxo de troco (valor recebido/troco) se aplica a este meio. */
  allowsChange: boolean;
  /** Se usar este meio credita saldo na conta-corrente do cliente (oposto do fiado). */
  creditsAccount: boolean;
  /** Percentual retido (ex.: taxa de adquirente) — reduz o valor líquido, não o total cobrado do cliente. */
  retentionPercent: number;
  /** Dias até o valor cair na conta da loja — só informativo por enquanto. */
  settlementDays: number;
}

export interface CreatePaymentMethodRequest {
  code: string;
  label: string;
  kind: PaymentMethodKind;
  icon?: string;
  allowsChange?: boolean;
  creditsAccount?: boolean;
  retentionPercent?: number;
  settlementDays?: number;
}

export type UpdatePaymentMethodRequest = Partial<
  Pick<
    CreatePaymentMethodRequest,
    'label' | 'kind' | 'icon' | 'allowsChange' | 'creditsAccount' | 'retentionPercent' | 'settlementDays'
  >
> & {
  active?: boolean;
};

export interface Payment {
  id: number;
  saleId: number;
  paymentMethodId: number;
  /** Código do meio de pagamento no momento da consulta (join). */
  method: string;
  methodLabel: string;
  amountCents: number;
  amountReceivedCents: number | null;
  changeCents: number;
  /** Valor líquido após a taxa de retenção do meio, snapshotado no pagamento. */
  netAmountCents: number;
  createdAt: string;
}

export interface ReconciliationRow {
  paymentMethodId: number;
  code: string;
  label: string;
  kind: PaymentMethodKind;
  count: number;
  grossCents: number;
  netCents: number;
}

export interface ReconciliationReport {
  rows: ReconciliationRow[];
  totals: {
    count: number;
    grossCents: number;
    netCents: number;
  };
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
  openedByUserName: string | null;
  closedByUserName: string | null;
  notes: string | null;
}

/** Quebra de valores por código de meio de pagamento — chaves dinâmicas,
 * dependem dos payment_methods ativos do tenant. */
export type PaymentBreakdown = Record<string, number>;

export interface CashSessionSummary {
  session: CashSession;
  salesCount: number;
  salesTotalCents: number;
  paymentBreakdown: PaymentBreakdown;
  paymentMethods: PaymentMethodConfig[];
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
  /** Métodos ativos no momento da consulta, na ordem de exibição — usado
   * pela UI para montar as colunas dinâmicas da quebra por pagamento. */
  paymentMethods: PaymentMethodConfig[];
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

export type UserRole = 'SUPER_ADMIN' | 'ADMIN_LOJA' | 'GERENTE' | 'FUNCIONARIO';

/** Papéis atribuíveis a um usuário de loja — SUPER_ADMIN é único, não se cria por aqui. */
export type TenantUserRole = Exclude<UserRole, 'SUPER_ADMIN'>;

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
  /** Nulo = usa o padrão do papel (ver DEFAULT_MAX_DISCOUNT_PERCENT no server). */
  maxDiscountPercent: number | null;
  canSellWithoutStock: boolean;
  /** Precisa trocar o PIN/senha antes de continuar usando o sistema. */
  mustChangePin: boolean;
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
  role: TenantUserRole;
  pin: string;
  maxDiscountPercent?: number | null;
  canSellWithoutStock?: boolean;
  mustChangePin?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  role?: TenantUserRole;
  pin?: string;
  active?: boolean;
  maxDiscountPercent?: number | null;
  canSellWithoutStock?: boolean;
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
  /** Saldo de conta-corrente: negativo = cliente deve à loja (fiado);
   * positivo = crédito a favor do cliente. Não confundir com total gasto
   * histórico (totalSpentCents), que é outra métrica. */
  balanceCents: number;
  /** Total histórico gasto em vendas concluídas — soma bruta, não o saldo. */
  totalSpentCents: number;
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

export type LedgerEntryType = 'fiado_venda' | 'pagamento' | 'credito_adicionado' | 'ajuste';

export interface CustomerLedgerEntry {
  id: number;
  customerId: number;
  type: LedgerEntryType;
  amountCents: number;
  balanceAfterCents: number;
  dueDate: string | null;
  saleId: number | null;
  notes: string | null;
  userId: number | null;
  createdAt: string;
}

export interface AddLedgerPaymentRequest {
  amountCents: number;
  notes?: string;
}

export interface AddLedgerCreditRequest {
  amountCents: number;
  notes?: string;
}

export interface AddLedgerAdjustmentRequest {
  amountCents: number;
  notes: string;
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
  notes?: string;
  addons?: CreateItemAddonSelection[];
}

export interface CreateSalePaymentInput {
  paymentMethodId: number;
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
  saleType?: SaleType;
}

export interface SurchargeRule {
  id: number;
  saleType: SaleType;
  paymentMethodId: number;
  percent: number;
  active: boolean;
}

export interface CreateSurchargeRuleRequest {
  saleType: SaleType;
  paymentMethodId: number;
  percent: number;
}

export type UpdateSurchargeRuleRequest = Partial<Omit<CreateSurchargeRuleRequest, 'saleType' | 'paymentMethodId'>> & {
  active?: boolean;
};

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
  isCombo?: boolean;
};

export type DeliveryZoneMode = 'off' | 'bairro' | 'cep';

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
  /** 'off' = taxa única para toda entrega (comportamento padrão). 'bairro'/'cep'
   * exigem informar o campo correspondente no checkout para validar contra
   * delivery_zones (bloqueio ou taxa por zona). */
  deliveryZoneMode: DeliveryZoneMode;
  /** Dias até o vencimento de uma venda fiada — usado para preencher o
   * vencimento (due_date) do lançamento na conta-corrente do cliente. */
  fiadoDueDays: number;
  /** Subtotal mínimo (centavos) para entrega grátis — 0 desativa. */
  freeDeliveryAboveCents: number;
}

export type UpdateStoreSettingsRequest = Partial<StoreSettings>;

export type DeliveryZoneType = 'bairro' | 'cep_prefix';

export interface DeliveryZone {
  id: number;
  type: DeliveryZoneType;
  value: string;
  blocked: boolean;
  feeCents: number | null;
  active: boolean;
}

export interface CreateDeliveryZoneRequest {
  type: DeliveryZoneType;
  value: string;
  blocked: boolean;
  feeCents?: number;
}

export type UpdateDeliveryZoneRequest = Partial<Omit<CreateDeliveryZoneRequest, 'type' | 'value'>> & {
  active?: boolean;
};

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
  /** Faixas de desconto por quantidade ativas no momento — vazio se nenhuma. */
  quantityDiscounts: { minQuantity: number; discountType: QuantityDiscountType; discountValue: number }[];
  /** Grupos de complemento vinculados (ativos) — vazio se nenhum. */
  addonGroups: AddonGroupWithOptions[];
}

export interface PublicStoreInfo {
  storeName: string;
  settings: StoreSettings;
  paymentMethods: PaymentMethodConfig[];
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
  district: string | null;
  notes: string | null;
  paymentMethodIntentId: number;
  /** Código do meio de pagamento pretendido no momento da consulta (join). */
  paymentMethodIntent: string;
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
  addons: OrderItemAddon[];
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
  /** Bairro (ou CEP, conforme deliveryZoneMode) — obrigatório quando a loja
   * usa validação de zona de entrega. */
  district?: string;
  notes?: string;
  paymentMethodIntentId: number;
  changeForCents?: number;
  publicKey: string;
  items: { productId: number; quantity: number; addons?: CreateItemAddonSelection[] }[];
}

export interface DeliveryCheckResult {
  allowed: boolean;
  reason?: string;
  feeCents: number;
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

// ---- Painel do SUPER_ADMIN (dono da plataforma) ----

export type TenantStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface TenantSummary {
  id: number;
  slug: string;
  storeName: string;
  status: TenantStatus;
  trialEndsAt: string;
  createdAt: string;
  /** Nome do usuário ADMIN_LOJA principal da loja, se houver. */
  ownerName: string | null;
}

export interface SuperAdminLoginRequest {
  email: string;
  password: string;
}

export interface CreateTenantRequest {
  storeName: string;
  /** Se omitido, gerado a partir do storeName. */
  slug?: string;
  ownerName: string;
}

export interface CreateTenantResult {
  tenant: TenantSummary;
  /** Credenciais iniciais do ADMIN_LOJA — mostradas uma única vez pro repasse ao cliente. */
  loginUrl: string;
  ownerName: string;
  initialPin: string;
}

export interface UpdateTenantStatusRequest {
  status: TenantStatus;
}

export interface EnterTenantResult {
  token: string;
}
