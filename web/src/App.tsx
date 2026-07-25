import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { getSavedSlug, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { StoreEntryPage } from './auth/StoreEntryPage';
import { Layout } from './components/Layout';
import { AccountDashboardPage } from './pages/account/AccountDashboardPage';
import { AddonGroupsPage } from './pages/addons/AddonGroupsPage';
import { PlatformAdminPage } from './pages/admin/PlatformAdminPage';
import { AuditPage } from './pages/audit/AuditPage';
import { AccountLoginPage } from './pages/account/AccountLoginPage';
import { CashPage } from './pages/cash/CashPage';
import { CatalogAdminPage } from './pages/catalog/CatalogAdminPage';
import { PublicCatalogPage } from './pages/catalog/PublicCatalogPage';
import { CustomerFormPage } from './pages/customers/CustomerFormPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { StoreSettingsPage } from './pages/settings/StoreSettingsPage';
import { CustomerListPage } from './pages/customers/CustomerListPage';
import { CustomerProfilePage } from './pages/customers/CustomerProfilePage';
import { PayablesPage } from './pages/payables/PayablesPage';
import { ProductFormPage } from './pages/products/ProductFormPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { CashHistoryReportPage } from './pages/reports/CashHistoryReportPage';
import { DailyConsolidatedPage } from './pages/reports/DailyConsolidatedPage';
import { ReconciliationReportPage } from './pages/reports/ReconciliationReportPage';
import { MarginReportPage } from './pages/reports/MarginReportPage';
import { SalesReportPage } from './pages/reports/SalesReportPage';
import { TopProductsReportPage } from './pages/reports/TopProductsReportPage';
import { SalePage } from './pages/sale/SalePage';
import { StockMovementsPage } from './pages/stock/StockMovementsPage';
import { UsersPage } from './pages/users/UsersPage';

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
        <Routes>
          <Route path="/admin" element={<PlatformAdminPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Layout>
    );
  }

  return (
    <Layout>
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
    </Layout>
  );
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Carregando...</div>;
  }

  return (
    <Routes>
      {/* Conta do dono da loja — login legado, autoatendimento fechado (ver /cadastro). */}
      <Route path="/conta/login" element={<AccountLoginPage />} />
      <Route path="/conta" element={<AccountDashboardPage />} />
      {/* Cardápio público — cliente final, sem login. */}
      <Route path="/c/:slug" element={<PublicCatalogPage />} />
      <Route path="*" element={<PdvRoutes />} />
    </Routes>
  );
}
