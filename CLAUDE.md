> ## 🚨 REGRA CRÍTICA — AUTO-ATUALIZAÇÃO OBRIGATÓRIA
>
> Toda vez que uma alteração estrutural for feita neste projeto (nova rota, novo componente, mudança de schema, nova integração, novo padrão), o agente **DEVE** atualizar este arquivo `CLAUDE.md` para refletir a mudança.
>
> Este documento é a **fonte de verdade viva** do projeto. Se ele ficar desatualizado, perde seu propósito. Mantenha-o sempre sincronizado com o código real.
>
> **Gatilhos obrigatórios de atualização:**
> - Criou/renomeou/removeu rota em `app/api/**`
> - Criou/renomeou/removeu página em `app/(dashboard)/**` ou `app/(public)/**`
> - Alterou schema do banco (`supabase/migrations/`, `scripts/migration-*.sql`)
> - Adicionou/removeu dependência em `package.json`
> - Adicionou/removeu variável de ambiente
> - Alterou fluxo de autenticação, middleware ou permissões
> - Descobriu nova armadilha ou padrão que vale registrar

---

# Controlei CRM — Guia Master (CLAUDE.md)

> **Leia este arquivo no início de toda sessão e prove que lembrou** citando a visão do produto em 1 frase antes da primeira ação.

---

## 👤 Perfil do Dono

- **Nome:** Josimar (usuário do sistema, dono do negócio)
- **Perfil:** Empreendedor **não-programador**. Tem visão de negócio e força de vontade, mas zero conhecimento técnico.
- **Como se comunicar:** linguagem simples, direta, honesta. Sem jargão. Usar analogias do mundo real quando precisar explicar algo técnico. Nunca assumir que ele entendeu — confirmar.
- **Modelo de negócio:** sistema **interno** de uma única empresa. **Não é SaaS vendido a terceiros.** O sistema roda para uso próprio da operação. Isso simplifica várias decisões (sem rate limiting agressivo externo, sem LGPD de múltiplos clientes, sem plano de preços).
- **Decisor final:** o dono é o único tomador de decisão técnica. Mas ele depende 100% do agente para entender as consequências.

---

## 🛡️ Regras Invioláveis (leitura obrigatória antes de CADA tarefa)

### Antes de executar qualquer pedido
1. **Analisar o mercado:** como players relevantes resolvem isso?
2. **Dar opinião direta:** "Recomendo fazer X porque..."
3. **Explicar o raciocínio** em linguagem simples para o dono decidir
4. **Mostrar o plano** do que vai fazer (passos concretos)
5. **Fazer as perguntas necessárias** para entender bem
6. **Só executar após aprovação explícita**

### Durante a execução
- Explicar o que está fazendo em linguagem simples, sem jargão
- Usar analogias do mundo real para conceitos técnicos
- Se encontrar risco, bug ou furo de regra de negócio: **parar e avisar**

### Após executar
- Explicar o que foi feito e por quê em linguagem simples
- Mostrar **evidência** de que funcionou (não apenas "tá feito")
- Listar o que foi feito e o que ficou pendente
- Apontar próximos passos sugeridos
- **Atualizar os docs do projeto** (este `CLAUDE.md`, `/docs/*`)

### Sempre
- Nunca assumir que o dono entendeu — **confirmar**
- Nunca entregar código sem testes ou sem avisar "não tem teste porque..."
- Sempre apontar riscos de segurança, negócio e técnico
- Agir como **sócio paranóico protegendo o negócio**, não só executor de tarefas

---

## 🎯 1. Visão do Produto

O **Controlei CRM** é um sistema interno de gestão de relacionamento com clientes (CRM) com foco em **operações em feiras de negócios**. É o "caderno digital inteligente" que a empresa usa para capturar, qualificar e acompanhar contatos — antes, durante e depois de eventos presenciais.

O coração do produto é a **combinação CRM + Feiras**: um pipeline visual estilo kanban onde os contatos caminham de "Novo" até "Convertido", integrado a um módulo de **gestão de feiras** que inclui mapa interativo de stands, check-in com foto, OCR de cartão de visita via IA (OpenAI GPT-4o), quiz gamificado para atrair público no estande e sincronização **offline-first** via IndexedDB + Service Worker (essencial porque feira tem Wi-Fi ruim).

Além do núcleo CRM + Feiras, o sistema cresceu com módulos adjacentes: **suporte técnico** (tickets com portal público para clientes), **pedidos e cotações** (controle de compras), **bugs** (bug tracker interno), **work fronts** (frentes de trabalho com sprints), **quiz feira** (gamificação). Todos rodam sobre a mesma infra multi-tenant Supabase, com RLS garantindo isolamento por `organization_id`.

É **PWA instalável** no celular (funciona como app), usa **IA** para sugerir próxima ação com cada cliente, gerar mensagens prontas e análises de saúde de pipeline, e tem sistema de **notificações push** web nativo. Para quem faz feiras de **agronegócio** (segmento visível nos dados — scripts ORPLANA, booths de cooperativa, etc.), é uma ferramenta de diferencial competitivo: transforma contatos de corredor de feira em pipeline rastreável em minutos.

**Problema que resolve:** acabar com a bagunça de cartões perdidos, WhatsApps soltos e planilhas Excel duplicadas. Tudo em um lugar só, com dedupe automático, IA que cobra follow-up e que funciona no celular mesmo sem internet.

---

## 🧱 2. Stack Tecnológica

### Dependências de Produção (`package.json`)

| Categoria | Pacote | Versão | Para que serve (linguagem simples) |
|---|---|---|---|
| **Framework** | `next` | ^15.5.12 | Motor do site (React moderno com SSR) |
| | `react` | ^19.0.0 | Biblioteca base de UI |
| | `react-dom` | ^19.0.0 | Renderização no navegador |
| **Backend/DB** | `@supabase/ssr` | ^0.5.2 | Autenticação Supabase em Server Components |
| | `@supabase/supabase-js` | ^2.45.4 | Cliente Supabase (banco, auth, storage) |
| **Validação** | `zod` | ^3.23.8 | Valida dados de formulários e APIs |
| **Mapa** | `leaflet` | ^1.9.4 | Mapa interativo (Google Maps grátis) |
| | `react-leaflet` | ^5.0.0 | Wrapper React do Leaflet |
| | `react-leaflet-cluster` | ^4.0.0 | Agrupamento de marcadores no mapa |
| **Drag & Drop** | `@dnd-kit/core` | ^6.3.1 | Arrastar cards no kanban |
| | `@dnd-kit/sortable` | ^10.0.0 | Ordenação via drag |
| | `@dnd-kit/utilities` | ^3.2.2 | Utilitários do dnd-kit |
| **QR Code** | `qrcode` | ^1.5.6 | Gerar QR codes |
| | `html5-qrcode` | ^2.3.8 | Ler QR codes pela câmera |
| **OCR** | `tesseract.js` | ^7.0.0 | OCR local (⚠️ instalado mas **não usado** — OCR real vai pra OpenAI) |
| **Planilha** | `xlsx` | ^0.18.5 | Importar/exportar Excel |
| **Gráficos** | `recharts` | ^3.7.0 | Gráficos nos relatórios |
| **PWA** | `@ducanh2912/next-pwa` | ^10.2.9 | Transforma o site em app instalável |

### Dependências de Desenvolvimento

| Pacote | Versão | Função |
|---|---|---|
| `typescript` | ^5 | Linguagem (JS com tipos) |
| `@types/node`, `@types/react`, `@types/react-dom` | - | Tipos do TypeScript |
| `tailwindcss` | ^3.4.1 | Estilos CSS utility-first |
| `postcss` | ^8 | Processador CSS |
| `autoprefixer` | - | Adiciona prefixos CSS automáticos |
| `sharp` | ^0.34.5 | Otimização de imagens |
| `pg` | ^8.18.0 | Cliente PostgreSQL (scripts de migração) |

### Configuração Next.js

- **App Router** (não Pages Router)
- **PWA** via `@ducanh2912/next-pwa` com:
  - Service Worker customizado (`worker/` → `public/worker-*.js`)
  - Fallback offline: `/offline`
  - Runtime caching Workbox:
    - Supabase API: `NetworkFirst` (10s timeout)
    - `/api/contacts/*`: `StaleWhileRevalidate` (5min)
    - Imagens: `CacheFirst` (30 dias)
- **Server Actions:** body limit 30MB
- **Desabilitado em dev** (PWA)

### TypeScript

- Target: ES2017
- Path alias: `@/*` → raiz do projeto
- JSX: preserve
- Module resolution: bundler

### TailwindCSS

- Config minimal — sem tema customizado em `tailwind.config.ts`
- Cores customizadas usadas via classes arbitrárias inline (`bg-[#1a0a2e]`, etc.)

---

## 🗂️ 3. Arquitetura e Estrutura de Pastas

```
mini-crm/
├── app/
│   ├── (auth)/              # Login, logout (públicas)
│   ├── (dashboard)/         # Área logada com sidebar
│   │   ├── admin/           # Painel admin (audit, dedup, users)
│   │   ├── contacts/        # CRM de contatos (list, new, [id])
│   │   ├── kanban/          # Pipeline visual drag-and-drop
│   │   ├── calendar/        # Calendário de meetings
│   │   ├── chat/            # Chat AI copilot
│   │   ├── reports/         # Relatórios com gráficos
│   │   ├── settings/        # Configurações do usuário
│   │   ├── pedidos-cotacoes/# Módulo de pedidos e cotações
│   │   ├── suporte/         # Sistema de tickets de suporte
│   │   ├── bugs/            # Bug tracker interno
│   │   ├── work-fronts/     # Frentes de trabalho com sprints
│   │   ├── eventos/         # Feiras: mapa, stands, check-in, timeline
│   │   ├── focus/           # Focus mode / power dialer
│   │   ├── quiz-feira/      # Dashboard de quiz (admin)
│   │   └── layout.tsx       # Layout logado (auth, sidebar, providers)
│   │
│   ├── (public)/            # Rotas públicas sem auth
│   │   ├── lead-capture/[token]/    # Formulário público de captura
│   │   ├── portal/[token]/          # Portal de clientes (suporte)
│   │   ├── quiz/[token]/            # Quiz público de feiras
│   │   └── layout.tsx
│   │
│   ├── api/                 # Route Handlers (122 rotas — ver seção 11)
│   ├── layout.tsx           # Root layout (metadata, PWA, viewport)
│   ├── globals.css          # Tailwind + overrides (Leaflet, range slider)
│   └── offline/             # Fallback PWA offline
│
├── components/
│   ├── ui/                  # Componentes base (tabs, empty-state, modal)
│   ├── contacts/            # Contact list, card, form, details
│   ├── kanban/              # Kanban board e filtros
│   ├── dashboard/           # Pipeline dashboard
│   ├── meetings/            # Meeting UI
│   ├── notifications/       # Bell, dropdown
│   ├── ai/                  # Assistente IA UI
│   ├── reports/             # Relatórios
│   ├── offline/             # Indicador de offline
│   ├── settings/            # Settings UI
│   ├── onboarding/          # Product tour
│   ├── admin/               # Admin tools
│   ├── lead-score/          # Lead score badge
│   ├── focus/               # Focus mode UI
│   ├── pedidos-cotacoes/    # UI PC
│   ├── suporte/             # UI Suporte
│   ├── work-fronts/         # UI Work Fronts
│   ├── portal/              # Portal cliente UI
│   ├── funnel/              # Visualização funil
│   ├── announcements/       # Anúncios
│   ├── sidebar.tsx          # Sidebar principal (navItems)
│   ├── providers.tsx        # Wrapper de Contexts
│   └── command-palette.tsx  # Command palette global
│
├── lib/
│   ├── supabase/            # client.ts, server.ts, admin.ts
│   ├── ai/                  # openai.ts, rules-engine, next-action-engine, prompts
│   ├── hooks/               # useUrlFilters, useSessionState, useIsMobile
│   ├── utils/               # normalize, validation (zod), labels, roles, lead-score
│   ├── data/                # brazil-cities, brazil-ddd, pipeline-templates
│   ├── automations/         # engine.ts (stage-change automations)
│   ├── offline/             # db.ts (IndexedDB), queue.ts, hooks.ts
│   ├── push/                # send-push.ts (VAPID Web Push)
│   ├── types.ts             # Tipos globais (Contact, Interaction, Pipeline...)
│   ├── ensure-profile.ts    # Auto-provisioning de org+profile no login
│   ├── pipeline-context.tsx # Context global do pipeline
│   ├── toast-context.tsx    # Context de toasts
│   └── onboarding-context.tsx
│
├── middleware.ts            # Edge middleware (auth + rate-limit login)
├── next.config.js           # Config Next.js + PWA
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── supabase/
│   └── migrations/          # Migrations oficiais (4 arquivos atuais)
│
├── scripts/                 # Scripts SQL + .mjs de migração/backfill/audit
├── worker/                  # Service Worker custom (PWA)
├── public/                  # Ícones PWA, splash, worker compilado
└── schema-completo-consolidado.sql
```

### Padrões Arquiteturais

- **Route Groups do Next.js**: `(auth)`, `(dashboard)`, `(public)` — não aparecem na URL mas compartilham layout
- **Multi-tenancy** via `organization_id` + RLS no Supabase
- **Server Components por padrão**, Client Components só quando precisa interatividade
- **Route Handlers** para APIs (não `pages/api`)
- **Edge Middleware** para auth (rápido, antes do render)
- **Context Providers** para estado global: Toast, Pipeline, Onboarding, Support Pipeline
- **Custom hooks** em `lib/hooks/` centralizam lógica de state

---

## 🗄️ 4. Banco de Dados / Schema

### Resumo

- **Banco:** PostgreSQL via Supabase
- **44 tabelas** no total
- **Multi-tenancy**: quase toda tabela tem `organization_id` + RLS policy
- **RLS padrão**: `organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid())`

### Tabelas Principais (por módulo)

#### Core
- `organizations` — empresas (multi-tenant)
- `profiles` — usuários (linkado a `auth.users`), tem `role`, `visible_menus[]`
- `access_requests` — pedidos de acesso a contatos de outros vendedores

#### Contatos
- `contacts` — tabela central, 30+ colunas, inclui `name_normalized`, `phone_normalized`, `email_normalized`, `cpf_digits`, `cnpj_digits` para dedupe, `tipo TEXT[]`, `telefones_adicionais JSONB`, `event_id`, `pipeline_id`, `stage_id`
- `interactions` — histórico (LIGACAO, WHATSAPP, EMAIL, REUNIAO, PROPOSTA_ENVIADA, etc.)
- `contact_attachments` — anexos (bucket `attachments`)
- `contact_custom_field_values` — valores de campos customizados

#### Pipeline
- `pipelines` — múltiplos pipelines (CRM, Suporte, Bugs, PC)
- `pipeline_stages` — colunas do kanban com `is_terminal`, `terminal_type` (won/lost)
- `pipeline_members` — controla quem vê contatos de qual pipeline
- `pipeline_custom_fields` — definição de campos customizados

#### Eventos/Feiras
- `events` — feiras (status: RASCUNHO, ATIVO, ENCERRADO), tem `map_url`, `pipeline_id`, `stage_id`, `cover_image_url`
- `event_booths` — stands com `position_x/y` (% no mapa), status, sector
- `booth_visits` — check-ins com `photo_facade_url`, `photo_contact_url`, `prospect_type`

#### Quiz Feira
- `quiz_configuracoes` — config por org, `valor_exato`, `dias_config JSONB`, `token_publico`, `telefone_vip`
- `quiz_participantes` — participações com `palpite`, `dia_feira`, link a `contact_id`

#### Associações (ORPLANA e outras)
- `associations` — grupos/conglomerados de empresas (ex: SOCICANA, UNICANA, ACAER). **Um nível acima de "empresa"** — uma associação agrega N empresas/fornecedores. Colunas: `sigla`, `nome_completo`, `presidente`, `telefone`, `email`, `website`, `cidade`, `estado`, `endereco`, `cep`, `logo_url`, `grupo` (ex: "ORPLANA"), `notas`. Unique em `(organization_id, sigla)`.
- `contacts.association_id` — FK opcional que liga um contato à associação de origem. Coexiste com o campo legacy `contacts.associacao` (texto livre, usado em check-in de feira com `events.uses_association=true`).
- Seed inicial: 35 associações ORPLANA (fornecedores de cana do agro). Ver `scripts/run-associations-via-api.mjs`.

#### Lead Capture
- `lead_capture_links` — links públicos por `slug` para captura de leads

#### Meetings
- `meetings`, `meeting_participants` — agendamentos

#### Notificações & IA
- `notifications` — alertas (RISK_ALERT, NEXT_ACTION, TASK_OVERDUE, etc.)
- `automation_rules`, `automation_executions` — automações por trigger (STAGE_CHANGE)
- `ai_analysis_cache` — cache de análises IA (mas não usado consistentemente)

#### Suporte
- `support_projects` — projetos (com `token` público)
- `support_tickets`, `support_comments`, `support_attachments`

#### Pedidos/Cotações (Módulo PC)
- `pc_clients`, `pc_cotacoes`, `pc_pedidos`

#### Work Fronts
- `work_fronts`, `work_front_members`, `work_front_sprints`, `work_front_tags`
- `bug_reports`

#### Importação & Auditoria
- `import_runs`, `import_run_items`
- `audit_log`

#### Misc
- `lead_score_history`, `push_subscriptions`, `avatars`, `onboarding_checklist`

### Relacionamentos-Chave

```
organization ─→ profiles, contacts, pipelines, events, ...
contacts ─→ interactions, attachments, meetings, custom_field_values
contacts.pipeline_id ─→ pipelines
contacts.stage_id ─→ pipeline_stages
contacts.event_id ─→ events
events ─→ event_booths ─→ booth_visits ─→ contacts
quiz_configuracoes ─→ quiz_participantes ─→ contacts
support_projects ─→ support_tickets ─→ support_comments, support_attachments
```

### RLS (Row-Level Security)

Todas as tabelas de negócio têm policy padrão:

```sql
CREATE POLICY "..." ON <tabela> FOR <op>
  USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  ));
```

**Exceções:**
- `notifications`: filtrada por `user_id == auth.uid()`
- `events`, `event_booths`, `booth_visits`: usam **service_role** via admin client (RLS bypass)
- `portal/*`: validação por token público
- Quiz público: validação por token público

### Migrations

⚠️ **ESTADO FRÁGIL:** o schema tem três caminhos de atualização:

1. **Oficial (supabase/migrations/):**
   - `20250304_pedidos_cotacoes.sql`
   - `20250305_pc_features_v2.sql`
   - `20260312_quiz_feira.sql`
   - `20260408_quiz_multidia.sql`

2. **Manual por pg (scripts/migration-*.sql via scripts/run-migration-*.mjs):**
   - `migration-events.sql`
   - `migration-cover-image.sql`
   - `migration-event-map.sql`
   - `migration-contact-event.sql`

3. **Raiz do repo (schema-migration-v*.sql):** ~24 arquivos históricos `v1` até `v24`. Rodar via Supabase Management API (`POST /v1/projects/{ref}/database/query` com token `sbp_*`).

**Estado real em produção (auditado em 2026-04-13):** todas as migrations v1-v24 e as 5 oficiais foram conferidas coluna a coluna. Neste dia foram rodadas as que faltavam: v2 (origem + temperatura em contacts — parcial, nunca rodada desde 2024), v21 (lead-scoring), v22 (automations), v23 (onboarding-roles), 20260408 (quiz_multidia) e 20260413 (lead_capture_event_id). Tabelas novas criadas: `lead_score_history`, `automation_rules`, `automation_executions`, `audit_log`, `push_subscriptions`, `onboarding_checklist`. Colunas novas em `contacts`: `origem` (com QRCODE), `temperatura`. Isso destravou: automações do kanban, histórico de lead score, audit log admin, push notifications, onboarding checklist, quiz multi-dia, e principalmente — `origem`/`temperatura` que eram gravadas em fallback silencioso há meses (todo contato de feira ficava sem essas colunas).

**Risco remanescente:** não há tabela `schema_migrations` confiável. Antes de rodar qualquer SQL novo, auditar o estado real via `scripts/db-audit.mjs` ou query direta no `information_schema`. Ver `/docs/DECISOES_TECNICAS.md` para plano de consolidação.

---

## 🔐 5. Autenticação e Autorização

### Método de Login

- **Supabase Auth** (e-mail + senha, possível OAuth)
- Sessão gerenciada via **cookies HTTP-only** (padrão `@supabase/ssr`)
- JWT armazenado em cookies gerenciados automaticamente

### Padrão de Clients (⭐ IMPORTANTE)

```typescript
// 1. Browser (Client Components)
import { createClient } from '@/lib/supabase/client'
// Usa NEXT_PUBLIC_SUPABASE_ANON_KEY — RESPEITA RLS

// 2. Server (Server Components, Route Handlers, Server Actions)
import { createClient } from '@/lib/supabase/server'
// Lê cookies da sessão — RESPEITA RLS

// 3. Admin (bypassa RLS — USE COM CUIDADO)
import { getAdminClient } from '@/lib/supabase/admin'
// Usa SUPABASE_SERVICE_ROLE_KEY — BYPASSA RLS
```

### Padrão Obrigatório de Rota Privada

```typescript
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await ensureProfile(supabase, user)
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('contacts')
    .select('*')
    .eq('organization_id', profile.organization_id)

  // ...
}
```

**Por quê esse padrão:** o `createClient()` valida a sessão respeitando RLS. Depois, o `getAdminClient()` permite queries complexas com bypass do RLS, **mas filtrando manualmente por `organization_id`** do profile já validado. É rápido e seguro.

### `ensureProfile()`

No primeiro login, o sistema:
1. Checa se o profile existe
2. Se não existe: cria `organization` + `profile` com `role: 'admin'`
3. Retorna `{ user_id, organization_id, name, email, role, avatar_url, visible_menus[] }`

### Middleware (`middleware.ts`)

- **Rate limit** na rota `POST /login` (10 tentativas/minuto por IP)
- Redireciona para `/login` qualquer rota não autenticada, EXCETO:
  - `/login`, `/lead-capture`, `/quiz`, `/portal`, `/api`, `/_next`, `/offline`
- Adiciona headers de segurança: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- Força `no-cache` em rotas `/api/*`

### Roles / Perfis

```typescript
type UserRole = 'admin' | 'user' | 'gerente' | 'sdr' | 'closer' | 'suporte'
```

Armazenado em `profiles.role`. Lógica de acesso a menus via `profiles.visible_menus[]`.

**Helper em `lib/utils/roles.ts`:**
- `canManageUsers(role)` — admin/gerente
- `hasFullVisibility(role)` — admin

Contatos são filtrados por `pipeline_members` + `assigned_to_user_id` para roles não-admin.

---

## 💼 6. Regras de Negócio e Fluxos

### Status de Contato (State Machine)

```
NOVO → EM_PROSPECCAO → CONTATADO → REUNIAO_MARCADA → CONVERTIDO
                                                    ↘ PERDIDO
```

- Stages são **dinâmicos** (definidos em `pipeline_stages`)
- `is_terminal = true` + `terminal_type: 'won'` = CONVERTIDO
- `is_terminal = true` + `terminal_type: 'lost'` = PERDIDO

### Temperatura

`FRIO` → `MORNO` → `QUENTE` (pode descer: sinaliza esfriamento com alerta)

### Origem

`MANUAL`, `INDICACAO`, `FEIRA`, `LINKEDIN`, `SITE`, `WHATSAPP_INBOUND`, `QRCODE`, `OUTRO`

### Tipo (array)

`FORNECEDOR`, `COMPRADOR` (pode ser ambos, armazenado como array)

### Deduplicação de Contatos

Chave de comparação:
1. **`phone_normalized`** (dígitos apenas) — prioridade 1
2. **`email_normalized`** (lowercase + trim) — prioridade 2

No POST `/api/contacts`:
- Busca contato existente por esses campos na mesma `organization_id`
- Se encontrar: retorna `409 Conflict` com sugestão de merge
- Função helper: `normalizePhone()`, `normalizeEmail()`, `normalizeSearch()`, `normalizeCPF()`, `normalizeCNPJ()` em `lib/utils/normalize.ts`

### Lead Scoring (0–100)

Fórmula em `lib/utils/lead-score.ts` (função `computeLeadScore`):

| Critério | Pontos |
|---|---|
| Temperatura QUENTE | 25 |
| Temperatura MORNO | 15 |
| Temperatura FRIO | 5 |
| Valor ≥ R$ 50k | 20 |
| Valor ≥ R$ 10k | 15 |
| Valor ≥ R$ 1k | 10 |
| Valor > 0 | 5 |
| Status NOVO | 4 |
| Status EM_PROSPECCAO | 8 |
| Status CONTATADO | 12 |
| Status REUNIAO_MARCADA | 18 |
| Status CONVERTIDO | 20 |
| Recência ≤ 1d | 15 |
| Recência ≤ 3d | 12 |
| Recência ≤ 7d | 8 |
| Recência ≤ 14d | 4 |
| Tem phone/whatsapp | 3 |
| Tem email | 3 |
| Tem company | 2 |
| Tem assigned | 2 |
| Next action agendada | 10 |
| Next action vencida | 3 |

**Faixas visuais:** Quente (80+), Bom (60–79), Médio (40–59), Baixo (20–39), Frio (<20)

### Alertas de Risco (Notification Engine)

Em `lib/ai/rules-engine.ts`:

- **STALE_DEAL** — contato > SLA sem atualização (warn 5d, crit 10d)
- **NO_NEXT_ACTION** — contato ativo sem próxima ação definida
- **TASK_OVERDUE** — próxima ação vencida
- **NO_OWNER** — contato sem atribuição
- **NEVER_CONTACTED** — contato novo há muito tempo
- **HIGH_VALUE_AT_RISK** — valor alto + temperatura caindo
- **COOLING_DOWN** — temperatura desceu

### Automações

- **Trigger:** `STAGE_CHANGE` (ao mover contato entre colunas)
- **Ações:** `MOVE_STAGE`, `SEND_NOTIFICATION`, `CHANGE_TEMPERATURE`, `ASSIGN_USER`
- **Engine:** `lib/automations/engine.ts`

### Quiz Feira

- Admin define `valor_exato` (ex: 500 grãos), pipeline destino e dias da feira
- Participante entra no link público `/quiz/[token]`, preenche `nome + empresa + telefone + palpite`
- Se `crm_ativo = true` no config: cria contato automaticamente na pipeline escolhida
- Vencedor = menor diferença do valor exato

### Check-in de Feira

1. Vendedor em `/eventos/[id]/checkin` seleciona stand
2. Tira 2 fotos (fachada + cartão de visita) + preenche `contact_name`, `prospect_type`
3. Envio: POST `/api/events/[id]/check-in` multipart
4. Backend envia foto do cartão pra OpenAI Vision → extrai dados
5. Cria ou atualiza `contacts` + marca booth `VISITADO`
6. Se offline: enfileira na IndexedDB e sincroniza quando voltar
7. Contatos extras vão pra `notes` com marker `<!--EVENT:uuid-->` (legacy) até serem migrados para coluna `event_id` via backfill

---

## 🔌 7. Integrações Externas

### OpenAI (GPT-4o) — **CRÍTICA**

- **Uso:** OCR de cartão de visita (`/api/scan-card`), análise de pipeline, geração de mensagens, próxima ação, coaching tips
- **Auth:** header `Authorization: Bearer ${OPENAI_API_KEY}`
- **Arquivo helper:** `lib/ai/openai.ts` (funções `chatCompletion`, `chatCompletionJSON`, `chatCompletionWithTools`)
- **⚠️ Risco:** sem cache por hash de imagem, sem teto de gasto. **Ver `DECISOES_TECNICAS.md` para plano de controle de custo.**

### Serper API (Web Search) — **Opcional**

- **Uso:** busca web para enriquecimento (em `lib/ai/web-search.ts`)
- **Env:** `SERPER_API_KEY`
- **Status:** opcional, funciona sem

### Supabase

- **Auth:** `@supabase/ssr` (cookies)
- **Database:** `@supabase/supabase-js` (PostgreSQL)
- **Storage:** buckets `attachments` (fotos de check-in, anexos) e `avatars` (foto de perfil)
- **Env obrigatórias:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Web Push (VAPID)

- **Uso:** notificações push no navegador
- **Env:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- **Helper:** `lib/push/send-push.ts`
- **Storage:** tabela `push_subscriptions`

### Google Sign-In (Client-side)

- **Uso:** pre-fill de formulário `/lead-capture/[token]` pelo botão "Entrar com Google"
- **Sem secret backend** — validação via Google API client
- **Status:** opcional, o formulário funciona sem

---

## 🎨 8. Design System e Tokens

### Paleta de Cores (Dark Theme)

| Camada | Classe Tailwind | Hex | Uso |
|---|---|---|---|
| Root BG | `bg-[#120826]` | `#120826` | Sidebar, rotas públicas |
| Dashboard BG | `bg-[#1a0a2e]` | `#1a0a2e` | Container logado |
| Card/Panel | `bg-[#1e0f35]` | `#1e0f35` | Cards, painéis |
| Input BG | `bg-[#2a1245]` | `#2a1245` | Inputs, botões secundários |
| Border sutil | `border-purple-800/30` | — | Bordas suaves |
| Border mais sutil | `border-purple-700/20` | — | Sub-bordas |
| Accent primário | `emerald-400` / `emerald-600` | `#34d399` / `#059669` | Botões, active states |
| Texto primário | `text-white` | `#fff` | Títulos, labels |
| Texto secundário | `text-purple-200/70`, `text-neutral-500` | — | Subtítulos |
| Erro | `bg-red-950/50`, `text-red-400` | — | Erros |

### Componentes Base

- `components/ui/tabs.tsx` — Tabs com active em `emerald-400`
- `components/ui/empty-state.tsx` — Empty states com ícones SVG inline
- `components/ui/confirm-modal.tsx` — Modal com focus trap e Escape close
- `components/ui/pagination.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/breadcrumbs.tsx`
- `components/ui/motivo-modal.tsx`

### Tema Dark-Only

- **Sem toggle light/dark** — o sistema é dark-only
- Background é declarado no root `<html lang="pt-BR"><body className="bg-[#120826]">`

### Responsividade

- Breakpoint mobile: `md:` (768px) — detectado via `useIsMobile` hook
- Sidebar: desktop fixa à esquerda (`lg:pl-64`), mobile top bar (`pt-14`)
- Kanban: mobile vira coluna única (via CSS em `globals.css`)

---

## ✍️ 9. Convenções de Código

### Nomenclatura

| Entidade | Padrão | Exemplo |
|---|---|---|
| Componentes React | PascalCase | `ContactCard`, `KanbanBoard` |
| Arquivos de componente | kebab-case | `contact-card.tsx` |
| Hooks customizados | camelCase `use*` | `useUrlFilters`, `useIsMobile` |
| Tipos/Interfaces | PascalCase | `Contact`, `Interaction`, `Pipeline` |
| Enums de API | SCREAMING_SNAKE_CASE | `NOVO`, `EM_PROSPECCAO` |
| API routes | kebab-case / `[slug]` | `/api/lead-capture-links/[id]/route.ts` |
| Contexts | camelCase + `Context` | `PipelineContext` |
| Server Actions | camelCase com verbo | `handleSignOut`, `deleteContact` |

### Imports

- **Path alias `@/`** para imports absolutos (ex: `import { Contact } from '@/lib/types'`)
- Ordem informal: libs externas → `@/lib/*` → `@/components/*` → relativos

### Como criar nova rota de API

1. Arquivo: `app/api/<recurso>/route.ts` (ou `[id]/route.ts`)
2. Exportar funções nomeadas `GET`, `POST`, `PATCH`, `DELETE`
3. Seguir o **padrão obrigatório** da seção 5 (auth → profile → admin client → filtro por `organization_id`)
4. Validar input com Zod quando vier do body
5. Usar `NextResponse.json(...)` para retornar
6. **Atualizar este `CLAUDE.md` na seção 11 (Rotas da API)**

### Como criar nova página

1. Arquivo: `app/(dashboard)/<pasta>/page.tsx` (logada) ou `app/(public)/<pasta>/page.tsx`
2. **Server Component** por padrão (sem `"use client"`)
3. Se precisar de interatividade: extrair UI para um Client Component em `components/`
4. Usar classes Tailwind do design system (seção 8)
5. Adicionar ao sidebar se necessário (`components/sidebar.tsx` → `navItems`)

### Como criar componente

1. Arquivo: `components/<modulo>/<nome>.tsx` em kebab-case
2. Export default apenas se for a única exportação
3. Props tipadas como `interface <Nome>Props { ... }`
4. Tailwind classes inline seguindo o design system
5. Se for reutilizável: considerar `components/ui/`

### Padrão de Hook

```typescript
// lib/hooks/use-algo.ts
export function useAlgo() {
  const [state, setState] = useState(...)
  useEffect(() => { ... }, [...])
  return { state, setState }
}
```

### Padrão de Context

```typescript
// lib/<nome>-context.tsx
'use client'
const Ctx = createContext<...>(null!)
export function XProvider({ children }: { children: ReactNode }) { ... }
export function useX() { return useContext(Ctx) }
```

---

## 🌎 10. I18N / Localização

- **Idioma padrão:** Português do Brasil (`pt-BR` no `<html lang>`)
- **Moeda:** Real brasileiro (R$)
- **Formato de data:** `dd/MM/yyyy` (ex: 13/04/2026)
- **Timezone:** `America/Sao_Paulo` (sistema rodando no Brasil)
- **Formato de telefone:** máscaras baseadas em DDD (`lib/data/brazil-ddd.ts`) — `(11) 98765-4321`
- **CPF:** `000.000.000-00` (normalizado para dígitos no banco)
- **CNPJ:** `00.000.000/0000-00` (normalizado para dígitos no banco)
- **Normalização:** `lib/utils/normalize.ts` para dedupe e busca (NFD, remove diacríticos, lowercase)
- **Sem i18n framework** — strings hardcoded em português no JSX

---

## 🛣️ 11. Rotas da API (122 rotas)

> ✅ = auth via Supabase / 🔓 = pública por token ou slug / 🔒 = cron Vercel

### Contatos (14)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/contacts` | Listar/criar contatos com filtros | ✅ |
| GET/PATCH/DELETE | `/api/contacts/[id]` | CRUD individual | ✅ |
| GET/POST | `/api/contacts/[id]/attachments` | Anexos do contato | ✅ |
| DELETE | `/api/contacts/[id]/attachments/[attachmentId]` | Deletar anexo | ✅ |
| GET/PUT | `/api/contacts/[id]/custom-fields` | Custom fields | ✅ |
| GET | `/api/contacts/[id]/score` | Lead score detalhado | ✅ |
| GET | `/api/contacts/attachment-counts` | Contagem por múltiplos contatos | ✅ |
| PATCH/DELETE | `/api/contacts/batch` | Batch operations | ✅ |
| POST | `/api/contacts/backfill-normalized` | Backfill de campos normalizados | ✅ admin |
| GET | `/api/contacts/duplicates` | Listar duplicatas | ✅ admin |
| POST | `/api/contacts/enrich-location` | Enriquecer cidade/estado | ✅ |
| GET | `/api/contacts/export` | Exportar Excel | ✅ |
| GET | `/api/contacts/facets` | Facetas de filtros | ✅ |
| POST | `/api/contacts/merge` | Merge de duplicatas | ✅ admin |

### Interações (2)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/interactions` | Listar/criar | ✅ |
| GET/PATCH/DELETE | `/api/interactions/[id]` | CRUD individual | ✅ |

### Meetings (4)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/meetings` | Listar/criar | ✅ |
| GET/PATCH/DELETE | `/api/meetings/[id]` | CRUD individual | ✅ |
| PATCH | `/api/meetings/complete-by-contact` | Completar todas por contato | ✅ |
| GET | `/api/meetings/export` | Exportar Excel | ✅ |

### Pipelines & Kanban (5)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/pipelines` | Listar com stages | ✅ |
| GET/PATCH/DELETE | `/api/pipelines/[id]` | CRUD | ✅ |
| GET/POST | `/api/pipelines/[id]/custom-fields` | Custom fields | ✅ |
| PATCH/DELETE | `/api/pipelines/[id]/custom-fields/[fieldId]` | Editar/deletar | ✅ |
| GET/PUT | `/api/pipeline-settings` | Settings globais | ✅ |

### Eventos & Feiras (11)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/events` | Listar/criar | ✅ |
| GET/PUT/DELETE | `/api/events/[id]` | CRUD | ✅ |
| GET/POST | `/api/events/[id]/booths` | Listar/criar stands | ✅ |
| PATCH/DELETE | `/api/events/[id]/booths/[boothId]` | Editar/deletar | ✅ |
| POST | `/api/events/[id]/booths/[boothId]/qr-link` | Gerar QR | ✅ |
| POST | `/api/events/[id]/booths/import` | Importar bulk CSV | ✅ |
| GET/POST | `/api/events/[id]/check-in` | Check-ins | ✅ |
| DELETE | `/api/events/[id]/check-in/[visitId]` | Deletar visita | ✅ |
| GET | `/api/events/[id]/live` | Dados real-time | ✅ |
| GET | `/api/events/[id]/report-data` | Dados para relatório | ✅ |
| GET | `/api/events/[id]/stats` | Estatísticas | ✅ |

### Associações (2)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/associations` | Listar / criar associação (POST admin/gerente) | ✅ |
| GET/PATCH/DELETE | `/api/associations/[id]` | CRUD individual (PATCH admin/gerente, DELETE admin) | ✅ |

### Quiz Feira (6)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/PUT | `/api/quiz/config` | Config do quiz | ✅ |
| GET/POST | `/api/quiz/route` | Submeter resposta (público) | 🔓 token |
| GET | `/api/quiz/participantes` | Listar | ✅ |
| GET | `/api/quiz/participantes/export` | Exportar | ✅ |
| GET | `/api/quiz/participantes/vencedor` | Vencedor | ✅ |
| GET | `/api/quiz/stats` | Estatísticas | ✅ |

### Lead Capture (3)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/lead-capture-links` | Listar/criar links | ✅ |
| GET/PATCH/DELETE | `/api/lead-capture-links/[id]` | CRUD | ✅ |
| POST | `/api/lead-capture` | Submissão pública | 🔓 slug |

### Notificações (4)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/notifications` | Listar | ✅ |
| PATCH/DELETE | `/api/notifications/[id]` | Marcar lido/deletar | ✅ |
| GET | `/api/notifications/count` | Contar não lidas | ✅ |
| PATCH | `/api/notifications/mark-all-read` | Marcar todas | ✅ |

### Automações (3)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/automations` | Listar/criar | ✅ |
| GET/PATCH/DELETE | `/api/automations/[id]` | CRUD | ✅ |
| GET/POST | `/api/cron/process-automations` | Executar (cron) | 🔒 cron |

### AI Copilot (5)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/api/ai/analyze` | Analisar contato | ✅ |
| POST | `/api/ai/generate-message` | Gerar mensagem | ✅ |
| GET | `/api/ai/next-action/[contactId]` | Sugerir próxima ação | ✅ |
| GET | `/api/ai/pipeline-health` | Saúde do pipeline | ✅ |
| POST | `/api/chat` | Chat com tools | ✅ |

### Pedidos & Cotações (18)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/pedidos-cotacoes/clients` | Clientes | ✅ |
| GET/PATCH/DELETE | `/api/pedidos-cotacoes/clients/[id]` | CRUD cliente | ✅ |
| GET | `/api/pedidos-cotacoes/clients/[id]/detail` | Detalhe completo | ✅ |
| POST | `/api/pedidos-cotacoes/clients/bulk` | Bulk update | ✅ |
| GET | `/api/pedidos-cotacoes/clients/export` | Exportar | ✅ |
| GET/POST | `/api/pedidos-cotacoes/cotacoes` | Cotações | ✅ |
| GET/PATCH/DELETE | `/api/pedidos-cotacoes/cotacoes/[id]` | CRUD | ✅ |
| POST | `/api/pedidos-cotacoes/cotacoes/bulk` | Bulk | ✅ |
| GET | `/api/pedidos-cotacoes/cotacoes/export` | Exportar | ✅ |
| GET/POST | `/api/pedidos-cotacoes/pedidos` | Pedidos | ✅ |
| GET/PATCH/DELETE | `/api/pedidos-cotacoes/pedidos/[id]` | CRUD | ✅ |
| POST | `/api/pedidos-cotacoes/pedidos/bulk` | Bulk | ✅ |
| GET | `/api/pedidos-cotacoes/pedidos/export` | Exportar | ✅ |
| GET | `/api/pedidos-cotacoes/stats` | Stats | ✅ |
| POST | `/api/pedidos-cotacoes/ai-analysis` | Análise IA | ✅ |
| POST | `/api/pedidos-cotacoes/setup` | Setup inicial | ✅ admin |
| POST | `/api/pedidos-cotacoes/seed` | Seed teste | ✅ admin |
| POST | `/api/pedidos-cotacoes/seed-clients` | Seed clientes | ✅ admin |

### Suporte (9)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/suporte` | Tickets | ✅ |
| GET/PATCH/DELETE | `/api/suporte/[id]` | CRUD | ✅ |
| GET/POST | `/api/suporte/[id]/comments` | Comentários | ✅ |
| GET/POST | `/api/suporte/[id]/attachments` | Anexos | ✅ |
| DELETE | `/api/suporte/[id]/attachments/[attachmentId]` | Deletar anexo | ✅ |
| GET/POST | `/api/suporte/projects` | Projetos | ✅ |
| GET/PATCH/DELETE | `/api/suporte/projects/[projectId]` | CRUD projeto | ✅ |
| POST | `/api/suporte/setup-pipeline` | Setup | ✅ admin |
| GET | `/api/suporte/stats` | Stats | ✅ |

### Portal Público (5)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/portal/[token]` | Info projeto | 🔓 token |
| GET/POST | `/api/portal/[token]/tickets` | Listar/criar tickets | 🔓 token |
| GET | `/api/portal/[token]/tickets/[ticketId]` | Ver ticket | 🔓 token |
| GET/POST | `/api/portal/[token]/tickets/[ticketId]/comments` | Comentários | 🔓 token |
| POST | `/api/portal/[token]/tickets/[ticketId]/attachments` | Anexos | 🔓 token |

### Usuários (5)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/me` | Perfil do logado | ✅ |
| GET | `/api/users` | Listar usuários | ✅ |
| GET/PATCH | `/api/users/[id]` | CRUD | ✅ |
| POST | `/api/users/avatar` | Upload avatar | ✅ |
| POST | `/api/users/password` | Alterar senha | ✅ |

### Admin & Auditoria (5)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/audit` | Audit log | ✅ admin |
| GET/POST | `/api/access-requests` | Access requests | ✅ |
| PATCH | `/api/access-requests/[id]` | Aprovar/rejeitar | ✅ |
| GET | `/api/access-requests/count` | Contagem | ✅ |
| GET | `/api/announcements` | Anúncios | ✅ |

### Relatórios & Misc (16)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET | `/api/reports` | Listar relatórios | ✅ |
| GET | `/api/reports/export` | Exportar | ✅ |
| GET | `/api/lead-scores/snapshot` | Snapshot de scores | ✅ |
| GET | `/api/focus/queue` | Fila focus mode | ✅ |
| GET | `/api/tasks/pending` | Tasks pendentes | ✅ |
| GET | `/api/tasks/count` | Contagem | ✅ |
| GET | `/api/leaderboard` | Ranking | ✅ |
| GET/PUT | `/api/onboarding/checklist` | Checklist | ✅ |
| POST | `/api/import` | Importar CSV | ✅ |
| POST | `/api/scan-card` | OCR de cartão | ✅ |
| POST | `/api/push/subscribe` | Web push subscription | ✅ |
| POST | `/api/push/send` | Enviar push | ✅ |
| POST | `/api/seed` | Seed teste | ✅ admin |
| GET | `/api/cron/daily-notify` | Cron diário | 🔒 cron |

### Work Fronts (9)

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| GET/POST | `/api/work-fronts` | Listar/criar | ✅ |
| GET/PATCH/DELETE | `/api/work-fronts/[id]` | CRUD | ✅ |
| GET/POST | `/api/work-fronts/[id]/members` | Membros | ✅ |
| DELETE | `/api/work-fronts/[id]/members/[userId]` | Remover membro | ✅ |
| GET/POST | `/api/work-fronts/[id]/sprints` | Sprints | ✅ |
| GET/PATCH/DELETE | `/api/work-fronts/[id]/sprints/[sprintId]` | CRUD sprint | ✅ |
| GET | `/api/work-fronts/active` | Ativas | ✅ |
| GET/POST | `/api/work-front-tags` | Tags | ✅ |
| PATCH/DELETE | `/api/work-front-tags/[id]` | CRUD tag | ✅ |

---

## 🛠️ 12. Comandos Úteis

### Desenvolvimento

```bash
# Rodar em dev (porta 3000 padrão)
npm run dev
# ou
npx next dev

# Build de produção
npm run build
# ou
npx next build

# Iniciar produção
npm run start

# Lint
npm run lint
# ou
npx next lint

# Type check (sem build)
npx tsc --noEmit
```

### Banco de Dados

```bash
# Rodar migration oficial (via Supabase CLI, se instalado)
npx supabase db push

# Rodar scripts manuais de migration (usam lib pg direto)
node scripts/run-migration-events.mjs
node scripts/run-migration-cover.mjs
node scripts/run-migration-event-map.mjs
node scripts/run-migration-contact-event.mjs

# Auditar estado do banco
node --no-warnings scripts/db-audit.mjs
```

### Utilidades

```bash
# Backfill de campo normalizado em contatos
node scripts/backfill-contact-event-id.mjs

# Seed de stands ORPLANA
node scripts/seed-orplana-booths.mjs
```

### Git

```bash
git status
git add <arquivos>
git commit -m "mensagem"
git push origin main
```

---

## 🔑 13. Variáveis de Ambiente

Arquivo: `.env.local` (nunca commitar)

| Variável | Obrigatória | Descrição | Exemplo |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Sim | URL do projeto Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Sim | Chave anon pública | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Sim | **Chave admin (bypassa RLS) — SEGREDO** | `eyJhbGci...` |
| `OPENAI_API_KEY` | ✅ Sim | Chave da OpenAI GPT-4o | `sk-...` |
| `SERPER_API_KEY` | ⚪ Não | Web search (Serper) | `...` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⚪ Não | Chave pública Web Push | `...` |
| `VAPID_PRIVATE_KEY` | ⚪ Não | Chave privada Web Push | `...` |
| `VAPID_EMAIL` | ⚪ Não | Email contato VAPID | `admin@exemplo.com` |
| `CRON_SECRET` | ⚪ Não | Auth de cron jobs Vercel | `...` |

### 🚨 ALERTA DE SEGURANÇA ATUAL (2026-04-13)

**`SUPABASE_SERVICE_ROLE_KEY` está em texto puro dentro de `.claude/settings.local.json`** (linhas de permissão de comandos Bash usadas em sessões anteriores). Esse arquivo fica no repositório.

**Ação imediata necessária:**
1. Rotacionar a chave service_role no dashboard do Supabase
2. Remover do `settings.local.json` (reescrever as permissions sem a chave hardcoded)
3. Adicionar `.claude/settings.local.json` ao `.gitignore` se ainda não estiver
4. Verificar se a chave antiga foi commitada em algum commit passado (git log)

Ver `docs/DECISOES_TECNICAS.md` para o plano completo.

---

## ⚠️ 14. Armadilhas Conhecidas (Pitfalls)

### Padrões que NÃO PODE quebrar

1. **RLS + admin client sempre filtrado por `organization_id`**
   Quando usar `getAdminClient()` (bypassa RLS), **sempre** adicione `.eq('organization_id', profile.organization_id)` manualmente. Esquecer isso = vazamento entre empresas.

2. **Dedupe de contatos é por `phone_normalized` E `email_normalized`**
   Nunca comparar por `phone` ou `email` crus. Sempre normalize via `normalizePhone()` / `normalizeEmail()` antes de buscar ou inserir.

3. **Contatos de feira ligam por `event_id` + marker legacy `<!--EVENT:uuid-->`**
   Check-in com contatos extras atualmente insere no campo `notes` com o marker `<!--EVENT:uuid-->`. Um script de backfill depois migra para a coluna `event_id`. **Não remover esse marker sem rodar backfill primeiro.**

### Armadilhas

1. **Schema do banco "fantasma" (parcialmente melhor)**
   Há 3 caminhos de migration (ver seção 4). Em 2026-04-13 auditamos tudo via Management API e rodamos as pendentes (v21/v22/v23/quiz_multidia). Ainda assim, **não há tabela `schema_migrations`** — antes de rodar SQL novo, validar colunas/tabelas esperadas contra o `information_schema`. Ver `DECISOES_TECNICAS.md`.

2. **Custo OpenAI sem teto**
   Cada OCR de cartão e cada análise de pipeline bate na OpenAI sem cache. Uma feira grande pode custar R$ centenas em horas. Implementar cache por hash de imagem / throttle por usuário.

3. **Fila offline pode perder dados**
   IndexedDB é volátil: se o usuário limpar cache antes de sincronizar, check-ins somem. Mostrar badge visível "X visitas pendentes" + forçar sync ao voltar online.

4. **Lead Score não é recalculado em massa**
   Se mudar a fórmula em `lib/utils/lead-score.ts`, contatos antigos ficam desatualizados. Sempre rodar backfill depois.

5. **Cron jobs sem auth robusta**
   `/api/cron/*` aceita qualquer um que souber a URL (não vi validação rígida de `CRON_SECRET`). Baixo risco hoje (sistema interno), mas vale corrigir.

6. **`tsconfig.tsbuildinfo` commitado**
   Esse arquivo é cache de build e não deveria estar no git. Adicionar ao `.gitignore`.

7. **Tesseract.js instalado mas não usado**
   OCR real vai pra OpenAI. Tesseract.js ocupa ~330KB do bundle sem uso. Ou ativar como fallback, ou remover.

8. **Código não commitado em risco** (2026-04-13)
   Atualmente há 30+ arquivos modificados sem commit, incluindo features inteiras (eventos, offline, scripts de migração). **Trabalho em risco se o disco falhar.**

9. **`easy-quiz-feira/` solta na raiz**
   Parece projeto paralelo/antigo. Não mexer sem entender o que é.

10. **Múltiplas pipelines compartilham o mesmo mecanismo**
    CRM, Suporte, Bugs e PC usam a tabela `pipelines` e `pipeline_stages`. Mudança no kanban CRM pode afetar suporte sem querer. **Testar em todos os contextos.**

11. **Rotas públicas sem rate limiting**
    `/api/lead-capture`, `/api/quiz/route`, `/api/portal/*`. Como é sistema interno, risco menor, mas um bot pode poluir dados.

12. **`NEXT_PUBLIC_*` aparecem no bundle client**
    Tudo que começa com `NEXT_PUBLIC_` vai pro navegador. Nunca colocar segredo nesse prefixo.

---

## 🚶 15. Fluxos Críticos do Usuário

### A. Login e Primeiro Acesso

1. Usuário acessa a raiz `/` → middleware redireciona para `/login`
2. Preenche e-mail + senha → POST para Supabase Auth
3. Middleware rate-limita (10 tentativas/min por IP)
4. Sessão gravada em cookie HTTP-only
5. Redireciona para `/dashboard`
6. `app/(dashboard)/layout.tsx` roda `ensureProfile()` → se primeiro login, cria `organization` + `profile` com role `admin`
7. Sidebar carrega com `navItems` filtradas por `visibleMenus` e `userRole`

### B. Criar Contato Novo

1. Usuário em `/contacts` → clica "Novo contato"
2. Preenche formulário (nome obrigatório, resto opcional)
3. Frontend valida com Zod
4. POST `/api/contacts` com payload
5. Backend normaliza (`normalizePhone`, `normalizeEmail`, `normalizeCPF`, `normalizeCNPJ`)
6. Busca duplicata por `phone_normalized` ou `email_normalized` na mesma org
7. Se duplicata → `409` com sugestão → frontend pergunta "abrir contato existente?"
8. Se único → insere com `pipeline_id`/`stage_id` padrão e `assigned_to_user_id` do criador
9. Dispara `processStageChangeAutomations()` se houver regras para o stage inicial
10. Frontend redireciona para `/contacts/[id]`

### C. Mover Contato no Kanban

1. Usuário em `/kanban` → arrasta card entre colunas (dnd-kit)
2. Frontend otimista atualiza UI
3. PATCH `/api/contacts/[id]` com novo `stage_id`
4. Backend valida permissão de pipeline via `pipeline_members`
5. Atualiza `stage_id` e chama `processStageChangeAutomations()`
6. Se regra configurada para essa transição → executa ação (move, notifica, atribui, muda temperatura)
7. Se offline → enfileira em IndexedDB, sincroniza ao voltar online
8. Toast "Movido com sucesso"

### D. Captura Pública via Lead Capture

1. Alguém recebe link `https://app/lead-capture/[token]`
2. GET interno busca link → obtém `user_name`, `pipeline_id`, `title`, `description`
3. Usuário preenche form: nome, e-mail, phone, company, cargo
4. Opcional: clica "Scan Cartão" → abre câmera (html5-qrcode ou file upload) → POST `/api/scan-card`
5. OpenAI Vision extrai campos → frontend pré-popula form
6. Opcional: usuário faz login Google → preenche nome/email
7. Envia → POST `/api/lead-capture` com `token` + dados
8. Backend valida token → cria contato com `origem: 'QRCODE'` (ou `FEIRA`) no pipeline do link
9. Se `boothId` no query string → associa `event_id` ao contato e cria `booth_visit`
10. Resposta "Obrigado! Dados recebidos"

### E. Evento → Stands → Check-in

**Criar evento:**
1. Admin em `/eventos` → "Novo evento"
2. Preenche name, location, datas, upload de imagem do mapa (map_url)
3. POST `/api/events` com status `RASCUNHO`
4. Ativa → status `ATIVO`

**Adicionar stands:**
1. Aba "Stands" → "Importar CSV" ou "Novo stand"
2. POST `/api/events/[id]/booths/import` com linhas (company_name, booth_number, sector)
3. Aba "Mapa" → arrasta pin de cada stand sobre a imagem do mapa
4. PATCH atualiza `position_x`, `position_y` (% 0-100)

**Check-in de visita (mobile):**
1. Vendedor em `/eventos/[id]/checkin` → seleciona stand na lista
2. Tira foto da fachada do stand
3. Tira foto do cartão de visita
4. Preenche `contact_name`, `prospect_type` (COMPRADOR/FORNECEDOR/AMBOS)
5. Adiciona notes
6. Clica "Registrar visita"
7. Se offline: fila IndexedDB
8. POST `/api/events/[id]/check-in` multipart
9. Backend envia foto do cartão pra OpenAI Vision → extrai nome, email, phone, cargo
10. Upload das fotos pra Supabase Storage (`attachments/<org>/events/<eventId>/<ts>-<tipo>-<rnd>.<ext>`)
11. Cria ou atualiza `contacts` com dados extraídos + `event_id`
12. Insere `booth_visits` + marca booth como `VISITADO`
13. Contatos extras → insere como contatos separados com marker `<!--EVENT:id-->` em notes
14. Toast "Visita registrada"

### F. Quiz Feira

**Setup:**
1. Admin em `/quiz-feira` → config
2. Ativa quiz, define `valor_exato`, `dias_config` (valor por dia), `token_publico`, `pipeline_id`, `crm_ativo`
3. Gera QR code do link público `/quiz/[token]`

**Participação:**
1. Visitante escaneia QR → abre `/quiz/[token]`
2. Preenche `nome`, `empresa`, `telefone`, `palpite`
3. POST `/api/quiz/route` → valida token
4. Se `crm_ativo`: cria contato no pipeline definido
5. Insere `quiz_participantes`
6. Tela "Obrigado pelo palpite"

**Vencedor:**
1. Admin em `/quiz-feira` → "Ver vencedor"
2. GET `/api/quiz/participantes/vencedor`
3. Retorna ranking por menor diferença do `valor_exato`

---

## 📎 Arquivos de Documentação Complementar

- [`docs/CONTEXTO.md`](docs/CONTEXTO.md) — contexto do produto, histórico, integrações
- [`docs/REGRAS_NEGOCIO.md`](docs/REGRAS_NEGOCIO.md) — regras críticas protegidas pelo código
- [`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md) — por que as coisas foram feitas assim, dívidas técnicas, plano
- [`docs/MERCADO.md`](docs/MERCADO.md) — concorrentes, benchmarks, oportunidades

---

## 🧠 Instrução de Sessão

**Ao iniciar cada sessão**, o agente deve:
1. Ler este arquivo inteiro
2. Ler `docs/CONTEXTO.md` e `docs/REGRAS_NEGOCIO.md`
3. Verificar `git status` e último commit
4. **Provar que lembrou** citando em 1 frase a visão do produto + estado atual
5. Perguntar ao dono o que ele quer fazer hoje
6. **Só depois** começar qualquer ação
