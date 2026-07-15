import { useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { getSavedSlug, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { StoreEntryPage } from './auth/StoreEntryPage';
import { Layout } from './components/Layout';
import { AccountDashboardPage } from './pages/account/AccountDashboardPage';
import { AuditPage } from './pages/audit/AuditPage';
import { AccountLoginPage } from './pages/account/AccountLoginPage';
import { SignupPage } from './pages/account/SignupPage';
import { CashPage } from './pages/cash/CashPage';
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
import { MarginReportPage } from './pages/reports/MarginReportPage';
import { SalesReportPage } from './pages/reports/SalesReportPage';
import { TopProductsReportPage } from './pages/reports/TopProductsReportPage';
import { SalePage } from './pages/sale/SalePage';
import { StockMovementsPage } from './pages/stock/StockMovementsPage';
import { UsersPage } from './pages/users/UsersPage';

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/venda" replace />;
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

// PDV do operador (exige login por PIN).
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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/venda" replace />} />
        <Route path="/t/:slug/login" element={<StoreLoginGate />} />
        <Route path="/venda" element={<SalePage />} />
        <Route path="/estoque" element={<ProductListPage />} />
        <Route path="/estoque/novo" element={<ProductFormPage />} />
        <Route path="/estoque/:id/editar" element={<ProductFormPage />} />
        <Route path="/estoque/movimentacoes" element={<StockMovementsPage />} />
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
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Carregando...</div>;
  }

  return (
    <Routes>
      {/* Conta do dono da loja — independente do login de operador do PDV. */}
      <Route path="/cadastro" element={<SignupPage />} />
      <Route path="/conta/login" element={<AccountLoginPage />} />
      <Route path="/conta" element={<AccountDashboardPage />} />
      {/* Cardápio público — cliente final, sem login. */}
      <Route path="/c/:slug" element={<PublicCatalogPage />} />
      <Route path="*" element={<PdvRoutes />} />
    </Routes>
  );
}
