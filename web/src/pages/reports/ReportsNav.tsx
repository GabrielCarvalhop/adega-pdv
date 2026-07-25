import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/relatorios/vendas', label: 'Vendas por período' },
  { to: '/relatorios/produtos', label: 'Produtos mais vendidos' },
  { to: '/relatorios/margem', label: 'Margem de lucro' },
  { to: '/relatorios/caixa', label: 'Histórico de caixa' },
  { to: '/relatorios/consolidado', label: 'Consolidado do dia' },
  { to: '/relatorios/conferencia', label: 'Conferência financeira' },
];

export function ReportsNav() {
  return (
    <div className="mb-6 flex gap-1 border-b border-gray-300">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `px-4 py-2 text-sm font-medium ${
              isActive ? 'border-b-2 border-amber-600 text-amber-600' : 'text-slate-500 hover:text-gray-900'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
