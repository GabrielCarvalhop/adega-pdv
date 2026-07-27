import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { getSavedSlug, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { StoreEntryPage } from './auth/StoreEntryPage';
import { Layout } from './components/Layout';

// Carregadas sob demanda: cada rota vira seu próprio chunk. Antes, visitar o
// cardápio público (sem login) baixava o mesmo bundle de ~460KB que inclui
// PDV, relatórios e painel admin inteiros — agora baixa só o necessário pra
// tela visitada.
const AccountDashboardPage = lazy(() =>
  import('./pages/account/AccountDashboardPage').then((m) => ({ default: m.AccountDashboardPage }))
);
const AddonGroupsPage = lazy(() =>
  import('./pages/addons/AddonGroupsPage').then((m) => ({ default: m.AddonGroupsPage }))
);
const PlatformAdminPage = lazy(() =>
  import('./pages/admin/PlatformAdminPage').then((m) => ({ default: m.PlatformAdminPage }))
);
const AuditPage = lazy(() => import('./pages/audit/AuditPage').then((m) => ({ default: m.AuditPage })));
const AccountLoginPage = lazy(() =>
  import('./pages/account/AccountLoginPage').then((m) => ({ default: m.AccountLoginPage }))
);
const CashPage = lazy(() => import('./pages/cash/CashPage').then((m) => ({ default: m.CashPage })));
const CatalogAdminPage = lazy(() =>
  import('./pages/catalog/CatalogAdminPage').then((m) => ({ default: m.CatalogAdminPage }))
);
const PublicCatalogPage = lazy(() =>
  import('./pages/catalog/PublicCatalogPage').then((m) => ({ default: m.PublicCatalogPage }))
);
const CustomerFormPage = lazy(() =>
  import('./pages/customers/CustomerFormPage').then((m) => ({ default: m.CustomerFormPage }))
);
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const StoreSettingsPage = lazy(() =>
  import('./pages/settings/StoreSettingsPage').then((m) => ({ default: m.StoreSettingsPage }))
);
const CustomerListPage = lazy(() =>
  import('./pages/customers/CustomerListPage').then((m) => ({ default: m.CustomerListPage }))
);
const CustomerProfilePage = lazy(() =>
  import('./pages/customers/CustomerProfilePage').then((m) => ({ default: m.CustomerProfilePage }))
);
const PayablesPage = lazy(() =>
  import('./pages/payables/PayablesPage').then((m) => ({ default: m.PayablesPage }))
);
const ProductFormPage = lazy(() =>
  import('./pages/products/ProductFormPage').then((m) => ({ default: m.ProductFormPage }))
);
const ProductListPage = lazy(() =>
  import('./pages/products/ProductListPage').then((m) => ({ default: m.ProductListPage }))
);
const CashHistoryReportPage = lazy(() =>
  import('./pages/reports/CashHistoryReportPage').then((m) => ({ default: m.CashHistoryReportPage }))
);
const DailyConsolidatedPage = lazy(() =>
  import('./pages/reports/DailyConsolidatedPage').then((m) => ({ default: m.DailyConsolidatedPage }))
);
const ReconciliationReportPage = lazy(() =>
  import('./pages/reports/ReconciliationReportPage').then((m) => ({ default: m.ReconciliationReportPage }))
);
const MarginReportPage = lazy(() =>
  import('./pages/reports/MarginReportPage').then((m) => ({ default: m.MarginReportPage }))
);
const SalesReportPage = lazy(() =>
  import('./pages/reports/SalesReportPage').then((m) => ({ default: m.SalesReportPage }))
);
const TopProductsReportPage = lazy(() =>
  import('./pages/reports/TopProductsReportPage').then((m) => ({ default: m.TopProductsReportPage }))
);
const SalePage = lazy(() => import('./pages/sale/SalePage').then((m) => ({ default: m.SalePage })));
const StockMovementsPage = lazy(() =>
  import('./pages/stock/StockMovementsPage').then((m) => ({ default: m.StockMovementsPage }))
);
const UsersPage = lazy(() => import('./pages/users/UsersPage').then((m) => ({ default: m.UsersPage })));

function RouteFallback() {
  return <div className="p-8 text-slate-400">Carregando...</div>;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const allowed = user?.role === 'ADMIN_LOJA' || user?.role === 'SUPER_ADMIN';
  return allowed ? children : <Navigate to="/venda" replace />;
}

function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user?.role === 'SUPER_ADMIN' ? children : <Navigate to="/venda" replace />;
}

// Operador logado visitando a URL de login de OUTRA loja: desloga para exibir
// o login correto em vez de redirecionar silenciosamente à loja anterior.
function StoreLoginGate() {
  const { slug } = useParams<{ slug: string }>();
  const { logout } = useAuth();
  const saved = getSavedSlug();
  const isOtherStore = Boolean(slug && slug !== saved);

  useEffect(() => {
    if (isOtherStore) logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtherStore]);

  if (isOtherStore) return null;
  return <Navigate to="/venda" replace />;
}

// PDV do operador (exige login por PIN, ou do SUPER_ADMIN por e-mail/senha).
function PdvRoutes() {
  const { user } = useAuth();

  if (!user) {
    const savedSlug = getSavedSlug();
    return (
      <Routes>
        <Route path="/t/:slug/login" element={<LoginPage />} />
        <Route path="/entrar" element={<StoreEntryPage />} />
        <Route
          path="*"
          element={<Navigate to={savedSlug ? `/t/${savedSlug}/login` : '/entrar'} replace />}
        />
      </Routes>
    );
  }

  // SUPER_ADMIN sem loja "aberta" só enxerga o painel de lojas — todo o
  // resto das telas depende de um tenant que ele ainda não escolheu.
  if (user.role === 'SUPER_ADMIN' && user.tenantId == null) {
    return (
      <Layout>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/admin" element={<PlatformAdminPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/venda" replace />} />
          <Route path="/t/:slug/login" element={<StoreLoginGate />} />
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <PlatformAdminPage />
              </SuperAdminRoute>
            }
          />
          <Route path="/venda" element={<SalePage />} />
          <Route path="/estoque" element={<ProductListPage />} />
          <Route path="/estoque/novo" element={<ProductFormPage />} />
          <Route path="/estoque/:id/editar" element={<ProductFormPage />} />
          <Route path="/estoque/movimentacoes" element={<StockMovementsPage />} />
          <Route path="/cardapio" element={<CatalogAdminPage />} />
          <Route path="/complementos" element={<AddonGroupsPage />} />
          <Route path="/clientes" element={<CustomerListPage />} />
          <Route path="/clientes/novo" element={<CustomerFormPage />} />
          <Route path="/clientes/:id" element={<CustomerProfilePage />} />
          <Route path="/clientes/:id/editar" element={<CustomerFormPage />} />
          <Route path="/caixa" element={<CashPage />} />
          <Route path="/pedidos" element={<OrdersPage />} />
          <Route path="/configuracoes" element={<StoreSettingsPage />} />
          <Route path="/contas" element={<PayablesPage />} />
          <Route path="/relatorios" element={<SalesReportPage />} />
          <Route path="/relatorios/vendas" element={<SalesReportPage />} />
          <Route path="/relatorios/produtos" element={<TopProductsReportPage />} />
          <Route path="/relatorios/margem" element={<MarginReportPage />} />
          <Route path="/relatorios/caixa" element={<CashHistoryReportPage />} />
          <Route path="/relatorios/consolidado" element={<DailyConsolidatedPage />} />
          <Route path="/relatorios/conferencia" element={<ReconciliationReportPage />} />
          <Route
            path="/usuarios"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/auditoria"
            element={
              <AdminRoute>
                <AuditPage />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Carregando...</div>;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Conta do dono da loja — login legado, autoatendimento fechado (ver /cadastro). */}
        <Route path="/conta/login" element={<AccountLoginPage />} />
        <Route path="/conta" element={<AccountDashboardPage />} />
        {/* Cardápio público — cliente final, sem login. */}
        <Route path="/c/:slug" element={<PublicCatalogPage />} />
        <Route path="*" element={<PdvRoutes />} />
      </Routes>
    </Suspense>
  );
}
