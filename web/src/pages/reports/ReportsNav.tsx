import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/relatorios/vendas', label: 'Vendas por período' },
  { to: '/relatorios/produtos', label: 'Produtos mais vendidos' },
  { to: '/relatorios/margem', label: 'Margem de lucro' },
  { to: '/relatorios/caixa', label: 'Histórico de caixa' },
  { to: '/relatorios/consolidado', label: 'Consolidado do dia' },
];

export function ReportsNav() {
  return (
    <div className="mb-6 flex gap-1 border-b border-neutral-200">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `px-4 py-2 text-sm font-medium ${
              isActive ? 'border-b-2 border-blue-600 text-blue-600' : 'text-neutral-500 hover:text-neutral-800'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
