CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin_hash TEXT,
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'operador')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('vinho', 'cerveja', 'destilado', 'espumante', 'licor', 'outro')),
  brand TEXT,
  volume_ml INTEGER,
  barcode TEXT UNIQUE,
  sku TEXT UNIQUE,
  cost_price_cents INTEGER NOT NULL DEFAULT 0,
  sale_price_cents INTEGER NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_active ON products(active);

CREATE TABLE cash_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK (status IN ('aberto', 'fechado')),
  opening_amount_cents INTEGER NOT NULL,
  expected_amount_cents INTEGER,
  counted_amount_cents INTEGER,
  difference_cents INTEGER,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  opened_by_user_id INTEGER REFERENCES users(id),
  closed_by_user_id INTEGER REFERENCES users(id),
  notes TEXT
);

CREATE INDEX idx_cash_sessions_status ON cash_sessions(status);

CREATE TABLE cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
  type TEXT NOT NULL CHECK (type IN ('sangria', 'suprimento')),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_cash_movements_session ON cash_movements(cash_session_id);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL CHECK (status IN ('aberta', 'concluida', 'cancelada')),
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent REAL,
  total_cents INTEGER NOT NULL,
  cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id),
  fiscal_status TEXT NOT NULL DEFAULT 'nao_emitida' CHECK (fiscal_status IN ('nao_emitida', 'pendente', 'emitida', 'erro', 'cancelada')),
  fiscal_document_id TEXT,
  user_id INTEGER REFERENCES users(id),
  notes TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  canceled_at TEXT
);

CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_cash_session ON sales(cash_session_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  unit_cost_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  canceled INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('dinheiro', 'debito', 'credito', 'pix')),
  amount_cents INTEGER NOT NULL,
  amount_received_cents INTEGER,
  change_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_payments_sale ON payments(sale_id);

CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('entrada_manual', 'saida_manual', 'ajuste', 'venda', 'cancelamento_venda')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  unit_cost_cents INTEGER,
  sale_id INTEGER REFERENCES sales(id),
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_sale ON stock_movements(sale_id);
