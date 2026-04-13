# CONTEXTO — Controlei CRM

> Contexto vivo do produto. Atualizar sempre que algo grande mudar.

## 🎯 O que é o produto

**Controlei CRM** é um sistema interno de gestão de contatos e oportunidades de venda com foco em **operações de feira**. É o "caderno digital inteligente" que a empresa usa para capturar, qualificar e acompanhar leads — antes, durante e depois de eventos presenciais.

**Tipo de produto:** aplicação web Next.js + banco Supabase (PostgreSQL), instalável como PWA no celular, com suporte offline-first.

## 👥 Para quem

- **Usuário primário:** a empresa do próprio dono (uso interno, não vendido a terceiros)
- **Perfis que usam:** vendedores em feiras, gerentes de pipeline, admin, suporte, equipe de pedidos/cotações
- **Não é SaaS multi-cliente** — o modelo multi-tenant (`organization_id`) existe tecnicamente, mas na prática hoje há apenas uma organização ativa

## 🩺 Problema que resolve

Antes do sistema, a realidade era:
- Cartões de visita de feira perdidos em gavetas
- Contatos duplicados em planilhas Excel diferentes
- Follow-up esquecido porque "ninguém lembrou"
- Zero visibilidade do pipeline de vendas
- Sem histórico do que foi falado com cada cliente
- Dados de feira dispersos (planilhas, WhatsApp, e-mails)

O Controlei resolve isso centralizando:
1. **Um lugar só** para todos os contatos, com dedupe automático por telefone/e-mail/CPF/CNPJ
2. **Pipeline visual** (kanban) onde cada contato caminha por estágios
3. **Captura rápida em feira** via mobile: scan de cartão com IA, check-in por stand, mapa visual, modo offline
4. **Lembretes automáticos** de follow-up com IA sugerindo próxima ação
5. **Histórico completo** de cada interação (ligações, WhatsApp, e-mails, reuniões)

## 🧱 Stack tecnológica

- **Frontend/Backend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Banco de dados:** Supabase (PostgreSQL) com RLS multi-tenant
- **Auth:** Supabase Auth via cookies HTTP-only
- **Storage:** Supabase Storage (buckets `attachments`, `avatars`)
- **IA:** OpenAI GPT-4o (OCR de cartão, análises, geração de mensagem)
- **Estilo:** TailwindCSS 3 (tema dark roxo + accent esmeralda)
- **Mapa:** Leaflet + react-leaflet (planta de feira com stands)
- **Offline:** IndexedDB + Service Worker (Workbox via `@ducanh2912/next-pwa`)
- **Drag & Drop:** dnd-kit (kanban)
- **Validação:** Zod
- **Planilhas:** xlsx (import/export)
- **QR Code:** qrcode (gerar) + html5-qrcode (ler)
- **Push:** Web Push API via VAPID

Ver `CLAUDE.md` seção 2 para o `package.json` detalhado com versões.

## 🏗️ Decisões de arquitetura

1. **Next.js App Router** (não Pages Router): aproveita Server Components, route groups (`(auth)`, `(dashboard)`, `(public)`) e cache automático
2. **Supabase como single source of truth**: auth, banco, storage e realtime em uma só plataforma — evita acoplar bibliotecas separadas
3. **Multi-tenancy por `organization_id` + RLS**: cada organização só vê seus próprios dados, garantido pelo banco (não pelo código)
4. **Padrão auth → profile → admin client**: toda rota privada valida sessão com `createClient()`, obtém `profile` via `ensureProfile()`, e só depois usa `getAdminClient()` (service_role) para queries complexas, sempre filtrando manualmente por `organization_id`
5. **PWA first**: o sistema foi desenhado para funcionar como app mobile instalável com modo offline — crítico porque feira tem Wi-Fi ruim
6. **Dark-only**: não tem toggle light/dark. Paleta fixa com `#120826` (root), `#1a0a2e` (dashboard), `#1e0f35` (cards), `emerald-400/600` (accent)
7. **Sem testes automatizados** (dívida técnica): o projeto não tem `*.test.ts` — decisão histórica, todas as validações hoje são manuais

## 🔌 Integrações externas

| Integração | Uso | Criticidade |
|---|---|---|
| **Supabase** (DB + Auth + Storage) | Persistência de tudo | **Crítica** — se cair, sistema todo para |
| **OpenAI GPT-4o** | OCR de cartão, análises, coaching, geração de mensagens | **Alta** — sistema funciona sem, mas perde valor |
| **Serper API** (web search) | Enriquecimento de contato opcional | Baixa |
| **Google Sign-In** (client-side) | Pre-fill de lead capture | Baixa |
| **VAPID Web Push** | Notificações do navegador | Opcional |

## 📅 Histórico de versões e mudanças importantes

> Extraído do `git log --oneline` (commits recentes)

- **eae51b7** — Quiz Feira multi-dia com cheat VIP por dia
- **262e10e** — Comentar Modo Foco do sidebar (feature temporariamente escondida)
- **0da18dd** — Fix: `visible_menus` não persistia na UI do admin
- **7a5bc4d** — Melhorias de UI/UX, acessibilidade e funcionalidades do dashboard
- **db5370c** — Quiz Feira com scan de cartão de visita via IA (primeira versão do OCR)

**Tema recente:** foco pesado no módulo de **Quiz Feira** e melhorias de acessibilidade no dashboard. O módulo de **Eventos/Feiras** ainda tem código não commitado em risco (ver estado atual).

## 🚦 Estado atual do desenvolvimento (2026-04-13)

### Em andamento (código não commitado)
- `app/(dashboard)/eventos/` — módulo completo de feiras não commitado
- `app/api/events/` — rotas da API de eventos não commitadas
- `lib/offline/` + `components/offline/` — sistema offline não commitado
- `scripts/migration-*.sql` + `scripts/run-migration-*.mjs` — migrations manuais não commitadas
- Múltiplos scripts de `db-audit*`, `backfill-*`, `import-orplana`, etc.

⚠️ **Esse código está em risco.** Se o disco falhar agora, o trabalho de semanas pode sumir.

### Funcionalidades estáveis
- CRM core (contatos, interações, pipeline, kanban)
- Auth + multi-tenancy
- Notificações + audit log
- Quiz Feira (versão multi-dia recente)
- Suporte (tickets com portal público)
- Pedidos & Cotações (módulo PC)
- Importação de planilhas
- Dedupe automático

### Features conhecidas com dívida técnica
- **Schema "fantasma"** (migrations oficiais + scripts manuais misturados)
- **Módulo Eventos** não commitado + usa marker legacy `<!--EVENT:uuid-->` em notes
- **Custo OpenAI sem controle** (sem cache, sem teto)
- **Lead score não recalculado em massa**
- **Tesseract.js instalado mas não usado**
- **`tsconfig.tsbuildinfo` no git** (deveria estar no `.gitignore`)

## 🎯 Coração do produto (foco estratégico)

Olhando os scripts (ORPLANA, agronegócio), as features mais ricas (Eventos + Quiz Feira), e o investimento recente em Quiz Multi-dia, fica claro que o **coração** é:

> **"Transformar contatos de feira em pipeline de vendas rastreável, com IA e offline-first."**

Tudo que não serve a esse objetivo é adjacente:
- Suporte, Pedidos/Cotações, Bugs, Work Fronts = módulos de bônus operacionais
- CRM clássico (kanban, contatos, pipeline) = infra-base para o coração funcionar
- Feiras + Quiz + Lead Capture via QR + Check-in mobile = **o diferencial**

**Implicação para decisões futuras:** se precisar cortar escopo ou priorizar, proteger primeiro o fluxo Feira → Captura → Pipeline.
