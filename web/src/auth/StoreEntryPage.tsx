import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function StoreEntryPage() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = slug.trim().toLowerCase();
    if (clean) navigate(`/t/${clean}/login`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-center text-2xl font-bold text-neutral-800">Adega PDV</h1>
        <p className="mb-6 text-center text-sm text-neutral-500">
          Digite o endereço da sua loja para entrar
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ex: minha-adega"
            autoFocus
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-center"
          />
          <Button type="submit" className="w-full" disabled={!slug.trim()}>
            Continuar
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Ainda não tem loja?{' '}
          <Link to="/cadastro" className="text-blue-600 hover:underline">
            Criar grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
