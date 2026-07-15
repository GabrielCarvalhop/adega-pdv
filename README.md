# Adega PDV

Sistema de ponto de venda multi-loja (SaaS) para adegas: venda de balcão com
múltiplos caixas, controle de estoque rastreável, clientes, contas a pagar,
relatórios, cardápio online público e pedidos.

## Arquitetura

Monorepo npm workspaces:

- **`server`** — Node.js + Express 5 + TypeScript + `pg` (PostgreSQL).
- **`web`** — React 18 + Vite + Tailwind + React Query.
- **`shared`** — tipos TypeScript compartilhados entre server e web.

**Multi-tenant com isolamento em 3 camadas**: coluna `tenant_id` com
`DEFAULT current_setting('app.tenant_id')`, Row-Level Security (FORCE) em toda
tabela de negócio, e um role de banco não-privilegiado (`adega_app`) que a
aplicação usa em runtime. Todo acesso passa por `withTenantTransaction` /
`withSystemTransaction` ([server/src/db/connection.ts](server/src/db/connection.ts)).

**Autenticação em duas camadas**: JWT de operador (login por PIN, 12h) para o
PDV, e JWT de conta do dono (e-mail/senha, 7d) para o painel de assinatura.
Papéis: `operador` (vende, opera o próprio caixa, atende pedidos), `gerente`
(+ estoque, clientes, relatórios, cancelamentos), `admin` (+ usuários,
configurações, auditoria, reabertura de caixa).

## Desenvolvimento local

Precisa de Node 22+ (usa Postgres embutido — não requer Docker).

```bash
npm install

# 1. Banco Postgres de desenvolvimento (baixa binários na 1ª vez, porta 5433)
npm run db:dev -w server

# 2. Migrations + role de aplicação
npm run migrate -w server

# 3. Dados de exemplo (lojas demo e vinharia, admin PIN 1234 / operadora 5678)
npm run seed -w server

# 4a. API (porta 4173)
npm run dev -w server
# 4b. Interface (porta 5175, com proxy /api → 4173)
npm run dev -w web
```

- PDV: `http://localhost:5175/t/demo/login` (PIN 1234)
- Cardápio público: `http://localhost:5175/c/demo`
- Painel da conta: `http://localhost:5175/conta/login`

Alternativa com Docker: `docker-compose up` sobe um `postgres:16` na 5433.

## Produção (Railway)

1. Suba o código no GitHub e conecte o repositório ao Railway.
2. Adicione um plugin **PostgreSQL**; o Railway injeta `DATABASE_URL`.
3. Configure as variáveis de ambiente (ver [.env.example](.env.example)):
   `JWT_SECRET` (obrigatório), `APP_DB_PASSWORD`, `NODE_ENV=production`,
   `APP_BASE_URL`.
4. Build: `npm run build`. Release command (antes de servir):
   `npm run migrate -w server`. Start: `npm start`.
5. O Express serve o build estático do React no mesmo processo — um único
   serviço web. Cada loja acessa `https://SEU_DOMINIO/t/<slug>/login`.

## Assinatura

A ativação/suspensão de lojas é manual enquanto o gateway de pagamento próprio
não é integrado:

```bash
npm run tenant:status -w server -- <slug>            # consultar
npm run tenant:status -w server -- <slug> active     # ativar
npm run tenant:status -w server -- <slug> past_due   # suspender (bloqueia escrita)
```

Lojas `past_due`/`canceled` ou com trial vencido bloqueiam **escrita** (402);
leitura permanece liberada para o lojista nunca perder acesso aos dados.

## Backup e restauração

Os dados vivem no PostgreSQL. Backup lógico com `pg_dump`:

```bash
# Backup (Railway: use a DATABASE_URL do painel)
pg_dump "$DATABASE_URL" -Fc -f adega-backup-$(date +%Y%m%d).dump

# Restauração para um banco vazio
pg_restore -d "$DATABASE_URL" --clean --if-exists adega-backup-YYYYMMDD.dump
```

Recomendado: backup diário automatizado (Railway oferece snapshots do plugin
Postgres; mantê-los ativos além do pg_dump próprio).

## Migrations e rollback

Migrations são arquivos `.sql` numerados em
[server/src/db/migrations](server/src/db/migrations), aplicados uma única vez
(controle em `schema_migrations`). O runner não tem "down" automático —
rollback é manual e deliberado:

- **Erro durante um deploy**: cada migration roda em transação; se falhar, faz
  rollback sozinha e o deploy não avança. Corrija o `.sql` e refaça.
- **Reverter algo já aplicado**: escreva uma **nova** migration que desfaz a
  anterior (ex: `DROP COLUMN`), nunca edite uma migration já aplicada em
  produção. Para desastres, restaure o backup `pg_dump` anterior à migration.

Antes de aplicar migrations em produção, faça `pg_dump` do estado atual.

## Testes de concorrência

```bash
npm run race-test -w server        # 2 vendas simultâneas da última unidade
npm run close-race-test -w server  # 2 caixas fechando ao mesmo tempo
```
