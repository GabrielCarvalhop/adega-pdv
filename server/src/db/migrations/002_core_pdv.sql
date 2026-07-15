CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  name TEXT NOT NULL,
  pin_hash TEXT,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id, active);

CREATE TABLE products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('vinho', 'cerveja', 'destilado', 'espumante', 'licor', 'outro')),
  brand TEXT,
  volume_ml INTEGER,
  barcode TEXT,
  sku TEXT,
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  sale_price_cents INTEGER NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, barcode),
  UNIQUE (tenant_id, sku)
);

CREATE INDEX idx_products_tenant_name ON products(tenant_id, name);
CREATE INDEX idx_products_tenant_active ON products(tenant_id, active);

CREATE TABLE cash_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  status TEXT NOT NULL CHECK (status IN ('aberto', 'fechado')),
  opening_amount_cents INTEGER NOT NULL,
  expected_amount_cents INTEGER,
  counted_amount_cents INTEGER,
  difference_cents INTEGER,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opened_by_user_id BIGINT REFERENCES users(id),
  closed_by_user_id BIGINT REFERENCES users(id),
  notes TEXT
);

CREATE INDEX idx_cash_sessions_tenant_status ON cash_sessions(tenant_id, status);

CREATE TABLE cash_movements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  cash_session_id BIGINT NOT NULL REFERENCES cash_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('sangria', 'suprimento')),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_movements_tenant_session ON cash_movements(tenant_id, cash_session_id);

CREATE TABLE customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  document TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_tenant_name ON customers(tenant_id, name);
CREATE INDEX idx_customers_tenant_active ON customers(tenant_id, active);

CREATE TABLE sales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  status TEXT NOT NULL CHECK (status IN ('aberta', 'concluida', 'cancelada')),
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent REAL,
  total_cents INTEGER NOT NULL,
  cash_session_id BIGINT NOT NULL REFERENCES cash_sessions(id),
  fiscal_status TEXT NOT NULL DEFAULT 'nao_emitida' CHECK (fiscal_status IN ('nao_emitida', 'pendente', 'emitida', 'erro', 'cancelada')),
  fiscal_document_id TEXT,
  user_id BIGINT REFERENCES users(id),
  customer_id BIGINT REFERENCES customers(id),
  notes TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ
);

CREATE INDEX idx_sales_tenant_status ON sales(tenant_id, status);
CREATE INDEX idx_sales_tenant_session ON sales(tenant_id, cash_session_id);
CREATE INDEX idx_sales_tenant_created ON sales(tenant_id, created_at);

CREATE TABLE sale_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  sale_id BIGINT NOT NULL REFERENCES sales(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  canceled BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sale_items_tenant_sale ON sale_items(tenant_id, sale_id);
CREATE INDEX idx_sale_items_tenant_product ON sale_items(tenant_id, product_id);

CREATE TABLE payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  sale_id BIGINT NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('dinheiro', 'debito', 'credito', 'pix')),
  amount_cents INTEGER NOT NULL,
  amount_received_cents INTEGER,
  change_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_tenant_sale ON payments(tenant_id, sale_id);

CREATE TABLE stock_movements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL DEFAULT (current_setting('app.tenant_id')::bigint) REFERENCES tenants(id),
  product_id BIGINT NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('entrada_manual', 'saida_manual', 'ajuste', 'venda', 'cancelamento_venda')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  unit_cost_cents INTEGER,
  sale_id BIGINT REFERENCES sales(id),
  user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_tenant_product ON stock_movements(tenant_id, product_id);
CREATE INDEX idx_stock_movements_tenant_sale ON stock_movements(tenant_id, sale_id);
