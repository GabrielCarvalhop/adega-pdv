import type { Product } from '@adega/shared';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../api/products.api';
import { ApiError } from '../api/client';
import { formatBRL } from '../utils/money';

interface ProductSearchInputProps {
  onSelect: (product: Product) => void;
}

export function ProductSearchInput({ onSelect }: ProductSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Evita dupla submissão quando o leitor de código de barras envia Enter
  // duas vezes ou o operador tecla Enter durante a busca em andamento.
  const searchingRef = useRef(false);

  function reset() {
    setQuery('');
    setResults([]);
    setHighlighted(0);
    setNotFoundBarcode(null);
    inputRef.current?.focus();
  }

  function selectProduct(product: Product) {
    onSelect(product);
    reset();
  }

  // Sugestões conforme digita (busca avançada por nome/código/descrição) —
  // só depois de Enter é que tentamos o match exato de código de barras
  // (leitores de código de barras enviam Enter ao final da leitura).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await productsApi.list({ search: term, active: true });
        setResults(onlyAvailable ? found.filter((p) => p.availableQuantity > 0) : found);
        setHighlighted(0);
        setNotFoundBarcode(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, onlyAvailable]);

  async function handleSearch() {
    const term = query.trim();
    if (!term || searchingRef.current) return;
    searchingRef.current = true;
    setLoading(true);
    setNotFoundBarcode(null);
    try {
      // Leitores de código de barras enviam Enter ao final da leitura — tenta
      // sempre o match exato primeiro antes de cair para busca por nome.
      try {
        const product = await productsApi.getByBarcode(term);
        selectProduct(product);
        return;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) return;
      }

      const found = await productsApi.list({ search: term, active: true });
      const filtered = onlyAvailable ? found.filter((p) => p.availableQuantity > 0) : found;
      if (filtered.length === 1) {
        selectProduct(filtered[0]);
      } else if (filtered.length === 0) {
        setResults([]);
        setNotFoundBarcode(term);
      } else {
        setResults(filtered);
        setHighlighted(0);
      }
    } finally {
      searchingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        id="product-search-input"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setNotFoundBarcode(null);
          setResults([]);
        }}
        onKeyDown={(e) => {
          // Setas navegam a lista de resultados sem sair do campo — o
          // operador nunca precisa do mouse para escolher o produto.
          if (e.key === 'ArrowDown' && results.length > 0) {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, results.length - 1));
            return;
          }
          if (e.key === 'ArrowUp' && results.length > 0) {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
            return;
          }
          if (e.key === 'Escape' && (results.length > 0 || query)) {
            e.stopPropagation();
            reset();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results.length > 0) {
              selectProduct(results[highlighted] ?? results[0]);
            } else {
              handleSearch();
            }
          }
        }}
        placeholder="Bipe o código de barras ou digite o nome do produto (F2)"
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
        autoFocus
      />

      <label className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={onlyAvailable}
          onChange={(e) => setOnlyAvailable(e.target.checked)}
        />
        Somente produtos disponíveis
      </label>

      {loading && <p className="mt-1 text-sm text-slate-400">Buscando...</p>}

      {notFoundBarcode && (
        <p className="mt-1 text-sm text-red-600">
          Produto não encontrado.{' '}
          <Link to={`/estoque/novo?barcode=${encodeURIComponent(notFoundBarcode)}`} className="underline">
            Cadastrar novo produto
          </Link>
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-sm">
          {results.map((product, index) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => selectProduct(product)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                  index === highlighted ? 'bg-amber-50' : 'hover:bg-gray-100'
                }`}
              >
                <span>
                  {product.name}
                  <span className="ml-2 font-medium text-gray-900">{formatBRL(product.salePriceCents)}</span>
                </span>
                <span className={product.availableQuantity <= 0 ? 'text-red-500' : 'text-slate-400'}>
                  {product.availableQuantity} disponível
                  {product.reservedQuantity > 0 && ` (${product.reservedQuantity} reservado)`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
