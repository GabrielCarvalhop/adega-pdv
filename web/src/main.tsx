import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './index.css';
import './styles/print.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Sem isso o padrão é staleTime: 0 — toda navegação entre telas (ex.:
      // Produtos → Estoque → Produtos) rebusca do zero mesmo com dado ainda
      // fresco. 15s casa com o intervalo de polling já usado no resto do
      // app; mutações continuam invalidando queries explicitamente, então
      // uma escrita nunca fica "escondida" atrás do cache.
      staleTime: 15000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
