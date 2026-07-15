import type { Product } from '@adega/shared';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsApi } from '../api/products.api';
import { ApiError } from '../api/client';

interface ProductSearchInputProps {
  onSelect: (product: Product) => void;
}

export function ProductSearchInput({ onSelect }: ProductSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setQuery('');
    setResults([]);
    setNotFoundBarcode(null);
    inputRef.current?.focus();
  }

  function selectProduct(product: Product) {
    onSelect(product);
    reset();
  }

  async function handleSearch() {
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    setNotFoundBarcode(null);
    try {
      // Leitores de código de barras enviam Enter ao final da leitura — tenta
      // sempre o match exato primeiro antes de cair para busca por nome.
      const product = await productsApi.getByBarcode(term);
      selectProduct(product);
      return;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setLoading(false);
        return;
      }
    }

    try {
      const found = await productsApi.list({ search: term, active: true });
      if (found.length === 1) {
        selectProduct(found[0]);
      } else if (found.length === 0) {
        setResults([]);
        setNotFoundBarcode(term);
      } else {
        setResults(found);
      }
    } finally {
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
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
          }
        }}
        placeholder="Bipe o código de barras ou digite o nome do produto (F2)"
        className="w-full rounded-md border border-neutral-300 px-4 py-3 text-lg"
        autoFocus
      />

      {loading && <p className="mt-1 text-sm text-neutral-400">Buscando...</p>}

      {notFoundBarcode && (
        <p className="mt-1 text-sm text-red-600">
          Produto não encontrado.{' '}
          <Link to={`/estoque/novo?barcode=${encodeURIComponent(notFoundBarcode)}`} className="underline">
            Cadastrar novo produto
          </Link>
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-sm">
          {results.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => selectProduct(product)}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-neutral-50"
              >
                <span>{product.name}</span>
                <span className="text-neutral-400">{product.stockQuantity} em estoque</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
