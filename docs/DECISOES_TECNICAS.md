# DECISÕES TÉCNICAS — Controlei CRM

> Por que as coisas foram feitas dessa forma, o que foi descartado, e o plano pra resolver as dívidas.

---

## ✅ Decisões adotadas

### D1. Next.js App Router (não Pages Router)
**Por quê:** Server Components reduzem bundle no cliente, route groups organizam o projeto por audiência (`(auth)`, `(dashboard)`, `(public)`), Server Actions simplificam mutations sem precisar escrever API routes para tudo.
**Alternativa descartada:** Pages Router (legado, menos performance), ou framework separado (Remix, SvelteKit).

### D2. Supabase como single source of truth
**Por quê:** auth, banco, storage e realtime em uma plataforma só. Não precisa juntar Auth0 + Postgres + S3 + Pusher. Barato, rápido de prototipar, PostgreSQL real (não é NoSQL).
**Alternativa descartada:** Firebase (NoSQL limita queries), self-hosted Postgres + Auth0 (mais infra, mais custo).

### D3. RLS multi-tenant por `organization_id`
**Por quê:** isolamento de dados garantido no banco, não no código. Se alguém esquecer um filtro em uma query, o Postgres bloqueia. Confiabilidade muito maior que validação em aplicação.
**Alternativa descartada:** multi-tenancy por schema separado (complexo), por banco separado (caro, sem shared infra).

### D4. Padrão `auth → ensureProfile → adminClient` nas APIs
**Por quê:** validar sessão rápido (RLS), obter `organization_id` confiável, e depois usar admin client para queries complexas com filtro manual. Combina segurança (RLS valida) com performance (admin bypassa overhead de policy).
**Alternativa descartada:** só usar client com RLS (queries complexas ficam lentas), só usar admin client (perde proteção).

### D5. PWA com `@ducanh2912/next-pwa` e IndexedDB offline
**Por quê:** feiras têm Wi-Fi ruim. Sistema **precisa** funcionar offline. PWA é mais barato que app nativo (React Native/Flutter = 2 codebases). IndexedDB é a única opção séria pra persistir dados localmente no browser.
**Alternativa descartada:** app nativo (custo de manter iOS + Android + web), localStorage (limite baixo, sem transações).

### D6. TailwindCSS 3 sem tema customizado
**Por quê:** velocidade de desenvolvimento. Classes arbitrárias (`bg-[#1a0a2e]`) evitam editar `tailwind.config` toda hora.
**Alternativa descartada:** Design tokens em CSS variables (mais trabalho para ganho baixo num projeto pequeno), Styled Components (runtime overhead).
**Débito:** não ter tokens centralizados. Se quiser mudar a paleta, precisa buscar/substituir em vários arquivos.

### D7. Dark-only (sem toggle light/dark)
**Por quê:** decisão estética — produto é dark. Evita a complexidade de manter 2 paletas sincronizadas.
**Consequência:** se algum dia precisar de light mode, é refatoração grande.

### D8. Dedupe por campo `*_normalized` em vez de função
**Por quê:** query por índice em coluna normalizada é O(log n), enquanto aplicar função em cada linha é O(n) full scan. Escala.
**Alternativa descartada:** functional indexes no Postgres (menos portável, harder to debug).
**Débito:** precisa backfill quando a fórmula de normalização mudar.

### D9. `zod` para validação
**Por quê:** schema é compartilhável client+server, gera tipos TypeScript automaticamente, API bem desenhada.
**Alternativa descartada:** Yup (menos tipagem), Joi (sem TypeScript nativo), validação manual (propenso a erros).

### D10. dnd-kit para drag-and-drop do kanban
**Por quê:** mais acessível que react-beautiful-dnd (descontinuado), API moderna, suporta touch mobile.
**Alternativa descartada:** react-beautiful-dnd (morto), HTML5 DnD nativo (péssimo UX).

### D11. OpenAI GPT-4o para OCR em vez de Tesseract
**Por quê:** Tesseract é notoriamente ruim com cartões de visita (layout livre, fontes variadas, fundos coloridos). GPT-4o Vision é dramaticamente melhor em extração estruturada.
**Alternativa descartada:** Tesseract.js local (qualidade ruim), Google Vision API (similar ao GPT-4o mas sem o "entendimento" contextual).
**Débito:** custo variável, dependência externa, sem cache.
**Curiosidade:** `tesseract.js` está no `package.json` mas **não é usado**. Resíduo de tentativa anterior. Decidir: ativar como fallback ou remover.

### D12. Sem framework de i18n
**Por quê:** produto é pt-BR only. Adicionar i18n agora seria over-engineering.
**Alternativa descartada:** next-intl, react-i18next.
**Se um dia precisar:** adicionar. Não é caminho sem volta.

---

## 🚧 Dívidas técnicas conhecidas

### DT1. 🚨 Service Role Key exposta em `.claude/settings.local.json`
**Problema:** a chave `SUPABASE_SERVICE_ROLE_KEY` está em texto puro dentro do arquivo de permissões do Claude Code (linhas 28-29 e 32 usam a chave em comandos `Bash(...)` hardcoded). Esse arquivo está no repo.

**Impacto:** se o repositório for público ou compartilhado, qualquer um com a chave tem **bypass total do RLS** — acesso admin ao banco inteiro.

**Plano (URGENTE, hoje):**
1. Ir no dashboard do Supabase (Project Settings → API) e **rotacionar a service_role key**
2. Atualizar `.env.local` com a nova chave
3. Reescrever `.claude/settings.local.json` removendo a chave hardcoded das permissions Bash (manter só os patterns, sem valor)
4. Adicionar `.claude/settings.local.json` ao `.gitignore`
5. Rodar `git log --all -p -- .claude/settings.local.json` para ver se foi commitado em commit anterior — se sim, considerar revogar por completo e limpar histórico (ou aceitar que já vazou)

### DT2. Schema "fantasma" (migrations mistas)
**Problema:** 4 migrations oficiais em `supabase/migrations/` + ~18 scripts manuais em `scripts/` (`migration-events.sql`, `migration-cover-image.sql`, etc.) executados via `scripts/run-migration-*.mjs` usando `pg` direto. Não há tabela `schema_migrations` confiável.

**Impacto:** impossível reproduzir o banco em um ambiente novo de forma confiável. Se precisar de staging, é dias de garimpo.

**Plano (próximas 2 semanas):**
1. Rodar `node --no-warnings scripts/db-audit.mjs` para listar tabelas/colunas reais
2. Comparar com `schema-completo-consolidado.sql` para ver se bate
3. Consolidar todos os scripts manuais em migrations oficiais numeradas (ex: `20260101_events_base.sql`, etc.)
4. Marcar as oficiais em uma tabela `schema_migrations` (criar se não existir)
5. Deletar scripts manuais de `scripts/migration-*.sql` após consolidar
6. Documentar o comando único de setup: `npx supabase db push` (ou equivalente)

### DT3. OpenAI sem cache e sem teto de gasto
**Problema:** cada OCR de cartão, cada análise de pipeline, cada "próxima ação sugerida" bate na OpenAI. Sem cache, sem throttle, sem alerta de gasto.

**Impacto:** uma feira grande pode custar R$ centenas em poucas horas. Feiras paralelas podem escalar para R$ milhares/mês.

**Plano:**
1. **Cache por hash de imagem:** antes de chamar OpenAI, calcular SHA-256 da imagem e consultar `ai_analysis_cache` (tabela já existe mas não é usada consistentemente)
2. **Cache de análise de pipeline:** mesmas condições = mesmo resultado por 1 hora
3. **Alerta de gasto:** cron diário que soma chamadas e avisa se passou de R$ X
4. **Throttle:** limite de N chamadas por minuto por usuário
5. **Fallback grátis:** ativar Tesseract.js como fallback se OpenAI falhar ou se o usuário optar por modo econômico

### DT4. Zero testes automatizados
**Problema:** 122 rotas de API, lógica complexa de dedupe, normalização, lead score, automações. Nenhum teste.

**Impacto:** cada commit é uma aposta. Bugs silenciosos aparecem em produção.

**Plano (progressivo, não precisa fazer tudo de uma vez):**
1. Configurar **Vitest** (rápido, nativo ESM)
2. Começar testando as funções críticas puras:
   - `lib/utils/normalize.ts` (phone, email, cpf, cnpj, search)
   - `lib/utils/lead-score.ts` (computeLeadScore)
   - `lib/utils/roles.ts` (canManageUsers, hasFullVisibility)
   - `lib/ai/rules-engine.ts` (checkStaleDeal, checkTaskOverdue)
3. Testes de regra de negócio (sem banco): mock do Supabase e valida os fluxos
4. Testes de rota (com banco de teste): Supabase local via Docker ou projeto de teste
5. CI: rodar testes a cada push

**Prioridade:** testar **primeiro** dedupe e normalização — são as funções mais críticas e mais simples de testar.

### DT5. Código não commitado em risco (2026-04-13)
**Problema:** 30+ arquivos modificados sem commit, incluindo o módulo inteiro de Eventos. Se o disco falhar, semanas de trabalho viram pó.

**Impacto:** alto — trabalho perdido, retrabalho.

**Plano (AGORA):**
1. Fazer commit em branches temporárias separadas por feature:
   - `feat/eventos` (tudo de `app/(dashboard)/eventos/`, `app/api/events/`, migrations de eventos)
   - `feat/offline` (lib/offline, components/offline)
   - `chore/scripts` (scripts/*.mjs novos)
2. Push de cada uma
3. Criar PRs quando for testar e mergear
4. **Nunca** deixar algo importante apenas em working directory por mais de 1 dia

### DT6. Fila offline pode perder dados silenciosamente
**Problema:** se o usuário limpar cache do navegador antes de sincronizar, check-ins somem sem aviso.

**Plano:**
1. Badge visível no header: "X visitas pendentes de sync"
2. Ao abrir o app com rede, forçar sync imediato
3. Exportar pendências para download local (JSON/CSV) como backup manual
4. Avisar o usuário se houver mais de N pendências há mais de X horas

### DT7. Lead Score não recalculado em massa
**Problema:** se mudar a fórmula em `lib/utils/lead-score.ts`, contatos antigos ficam com score velho. Relatórios ficam inconsistentes.

**Plano:**
1. Criar cron diário que recalcula score dos contatos que mudaram nas últimas 24h (já existe parcialmente?)
2. Criar rota admin `POST /api/admin/recalculate-scores` para rodar manualmente em toda a base quando a fórmula mudar
3. Logar em `lead_score_history` a mudança

### DT8. Marker `<!--EVENT:uuid-->` em `notes` (legacy)
**Problema:** gambiarra para ligar contato a evento antes da coluna `event_id` existir.

**Plano:**
1. Rodar `node scripts/backfill-contact-event-id.mjs` em todos os contatos com o marker
2. Remover o marker da tabela após backfill
3. Alterar fluxo de check-in para sempre usar `event_id` direto, nunca mais o marker
4. Documentar no `REGRAS_NEGOCIO.md` que o marker está deprecated

### DT9. `tsconfig.tsbuildinfo` commitado
**Problema:** arquivo de cache de build está no git. Polui diffs.

**Plano:**
1. Adicionar `tsconfig.tsbuildinfo` ao `.gitignore`
2. `git rm --cached tsconfig.tsbuildinfo`
3. Commit

### DT10. `tesseract.js` não usado
**Problema:** 330KB de bundle sem uso.

**Plano (decisão):**
- **Opção A:** Remover. `npm uninstall tesseract.js`
- **Opção B:** Usar como fallback offline do OCR quando não houver rede ou OpenAI falhar. **Recomendada** — o módulo de feira é offline-first, ter OCR local é diferencial.

### DT11. Rotas públicas sem rate limiting
**Problema:** `/api/lead-capture`, `/api/quiz/route`, `/api/portal/*` não têm proteção contra flood.

**Impacto:** baixo (sistema interno), mas bot pode poluir base com leads falsos.

**Plano:**
1. Adicionar rate limit por IP nas rotas públicas (5 requisições/minuto)
2. Reaproveitar o mecanismo do `middleware.ts` que já faz isso para `/login`
3. CAPTCHA opcional se detectar abuso repetido

### DT12. `easy-quiz-feira/` solta na raiz
**Problema:** parece projeto paralelo antigo. Não sei se é código morto ou em uso externo.

**Plano:**
1. Perguntar ao dono o que é
2. Se morto: arquivar em branch + deletar
3. Se em uso: mover para `packages/` e documentar

### DT13. Múltiplos pipelines compartilham mecanismo
**Problema:** tabelas `pipelines` e `pipeline_stages` são usadas por CRM, Suporte, Bugs e PC. Mudança em um pode afetar outros.

**Plano:**
1. Documentar em `REGRAS_NEGOCIO.md` quais pipelines existem (por `name` ou `type`)
2. Testes de regressão em cada módulo ao mexer no mecanismo de stages
3. Considerar adicionar coluna `pipeline_type` explícita (crm | suporte | bugs | pc)

### DT14. Sem monitoramento/observabilidade
**Problema:** se produção cair, só sabe quando o dono abrir o app e der erro.

**Plano:**
1. Sentry (free tier) para erros de frontend/backend — **5 minutos de setup**
2. Logtail ou Better Stack para logs estruturados
3. Uptime Robot (grátis) para ping no `/api/health` (criar essa rota)

### DT15. Sem backup explícito documentado
**Problema:** Supabase tem backup automático no plano pago, mas não tem política documentada de retention, teste de restore, ou export periódico para lugar externo.

**Plano:**
1. Confirmar qual plano Supabase está ativo e o que oferece de backup
2. Criar script semanal de `pg_dump` para um bucket S3 externo (ou Google Drive)
3. Testar restore ao menos uma vez
4. Documentar no `DECISOES_TECNICAS.md` o RPO/RTO aceito

---

## 🚫 Decisões descartadas (e por quê)

### Desc1. ~~Firebase~~
Descartado porque Firestore é NoSQL, queries relacionais ficam caras/complicadas. Multi-tenancy e RLS são muito mais naturais no Postgres.

### Desc2. ~~App nativo (React Native / Flutter)~~
Descartado porque custo de manter 3 codebases (iOS, Android, web) é alto. PWA + service worker resolve 95% dos casos.

### Desc3. ~~GraphQL~~
Descartado porque REST + Route Handlers do Next.js é suficiente, mais simples de testar, e cache por URL funciona out-of-the-box.

### Desc4. ~~Monorepo (Turborepo/Nx)~~
Descartado porque é um único app. Não justifica a complexidade.

### Desc5. ~~Prisma ORM~~
Descartado porque Supabase SDK já é um ORM leve com tipagem gerada. Prisma adicionaria outra camada de abstração e outro passo de build.

### Desc6. ~~Tailwind config com tokens~~
Descartado inicialmente por velocidade. Débito: pode ser adicionado depois quando a paleta estabilizar.

---

## 🧭 Princípios de Evolução

1. **Não escalar o que não precisa escalar.** Sistema é interno, 1 org, poucos usuários. Não precisa de Redis, não precisa de load balancer, não precisa de microserviços.
2. **Segurança antes de features.** Se tiver uma escolha entre "nova feature" e "fechar uma brecha", brecha vence.
3. **Funcionalidade antes de beleza.** Feature feia funcionando > feature linda quebrada.
4. **Offline-first é regra, não opção.** Qualquer fluxo de feira precisa funcionar sem rede.
5. **IA é ferramenta, não dependência.** Sistema deve funcionar sem OpenAI (com qualidade reduzida, mas funcionar).
6. **Dados antes de código.** Perder dados é catástrofe. Perder código, você reescreve.
