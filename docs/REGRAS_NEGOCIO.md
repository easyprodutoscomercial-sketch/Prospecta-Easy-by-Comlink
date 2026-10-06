# REGRAS DE NEGÓCIO — Controlei CRM

> Regras críticas extraídas do código. Toda mudança que mexer em regra listada aqui **precisa ser discutida antes**.

---

## 🔒 Regras Invioláveis (não pode quebrar)

### R1. Isolamento entre organizações
Todos os dados são escopados por `organization_id`. Um usuário da org A **jamais** pode ver dados da org B.

- **Garantido por:** RLS no Supabase + filtro manual por `organization_id` quando usar `getAdminClient()`
- **Se quebrar:** vazamento grave entre clientes
- **Onde está implementado:** toda rota em `app/api/**` que usa `getAdminClient()` deve adicionar `.eq('organization_id', profile.organization_id)`

### R2. Dedupe obrigatório em contatos
Ao criar contato, o sistema **deve** verificar se já existe um por `phone_normalized` ou `email_normalized` na mesma org.

- **Garantido por:** POST `/api/contacts` chama `normalizePhone()`/`normalizeEmail()` e faz query de busca antes de inserir
- **Se duplicata encontrada:** retornar `409 Conflict` com sugestão (não inserir silenciosamente)
- **Se quebrar:** base de dados infla com duplicatas, vendedores ligam várias vezes pro mesmo contato

### R3. Rotas privadas precisam de `auth → profile → admin client`
Padrão obrigatório em toda rota de API privada:

```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return 401
const profile = await ensureProfile(supabase, user)
const admin = getAdminClient()
await admin.from('x').eq('organization_id', profile.organization_id)
```

- **Se quebrar:** rota pode expor dados sem auth ou de orgs erradas

### R4. Service Role Key nunca no cliente
A variável `SUPABASE_SERVICE_ROLE_KEY` **jamais** pode aparecer em código que roda no navegador, nem em variáveis `NEXT_PUBLIC_*`.

- **⚠️ VIOLAÇÃO ATUAL (2026-04-13):** a chave está em `.claude/settings.local.json` em texto puro. Precisa ser rotacionada.

### R5. Normalização antes de comparar ou indexar
Nunca comparar `phone`, `email`, `cpf`, `cnpj`, `name` crus. Sempre usar `lib/utils/normalize.ts`:

- `normalizePhone(s)` → apenas dígitos
- `normalizeEmail(s)` → lowercase + trim
- `normalizeCPF(s)` → 11 dígitos
- `normalizeCNPJ(s)` → 14 dígitos
- `normalizeSearch(s)` → NFD + sem diacríticos + lowercase

### R6. Pipeline transition executa automações
Ao mover um contato entre stages, chamar `processStageChangeAutomations()` de `lib/automations/engine.ts`. Esquecer isso quebra fluxos automatizados que o usuário configurou.

### R7. Check-in de feira marca booth como VISITADO
POST em `/api/events/[id]/check-in` deve atualizar `event_booths.status = 'VISITADO'` além de criar `booth_visits` e atualizar/criar o contato.

---

## 📋 Fluxos Principais do Sistema

### F1. Criar Contato
1. Validação Zod no frontend
2. POST `/api/contacts` com dados
3. Normalização (phone, email, cpf, cnpj, name)
4. Busca duplicata por `phone_normalized` ou `email_normalized`
5. Se duplicata → `409` com sugestão de merge
6. Se único → insere com pipeline/stage padrão + `assigned_to_user_id` do criador
7. Dispara `processStageChangeAutomations()` se houver regra para stage inicial

### F2. Mover Contato no Kanban
1. Drag-and-drop via dnd-kit
2. PATCH `/api/contacts/[id]` com novo `stage_id`
3. Valida permissão via `pipeline_members`
4. Atualiza e chama `processStageChangeAutomations()`
5. Se offline → IndexedDB queue
6. Toast de confirmação

### F3. Lead Capture Pública
1. Link `/lead-capture/[token]`
2. Usuário preenche form (ou scanner de cartão via OpenAI)
3. POST `/api/lead-capture` com token
4. Valida token → busca `lead_capture_links`
5. Cria contato no pipeline do link com `origem: 'QRCODE'`
6. Se houver `boothId` → associa `event_id` e cria `booth_visit`

### F4. Check-in de Feira
1. Vendedor em `/eventos/[id]/checkin`
2. Seleciona stand, tira 2 fotos + preenche campos
3. POST `/api/events/[id]/check-in` multipart
4. OpenAI Vision extrai dados do cartão
5. Upload fotos pra Supabase Storage
6. Cria/atualiza `contacts` + `booth_visits`
7. Marca booth `VISITADO`
8. Contatos extras → inserir com marker `<!--EVENT:id-->` em notes (legacy)
9. Se offline → enfileira IndexedDB

### F5. Quiz Feira → Contato
1. Admin configura quiz: pipeline destino, `valor_exato`, `crm_ativo`
2. Visitante acessa `/quiz/[token]`, preenche + palpite
3. POST `/api/quiz/route`
4. Se `crm_ativo = true` → cria contato automaticamente
5. Insere `quiz_participantes`
6. Vencedor = menor diferença do `valor_exato`

---

## 🎰 State Machines

### Status de Contato
```
NOVO → EM_PROSPECCAO → CONTATADO → REUNIAO_MARCADA → CONVERTIDO
                                                    ↘ PERDIDO
```
Stages dinâmicos em `pipeline_stages`. Terminal via `is_terminal = true` + `terminal_type = 'won' | 'lost'`.

### Temperatura
```
FRIO ↔ MORNO ↔ QUENTE
```
Transições para baixo disparam alerta `COOLING_DOWN`.

### Evento
```
RASCUNHO → ATIVO → ENCERRADO
```

### Booth
```
PENDENTE → VISITADO
```

### Suporte Ticket
```
OPEN → IN_PROGRESS → RESOLVED → CLOSED
```
(ou via stage customizado em `pipeline_stages` do pipeline de suporte)

### Pedido/Cotação
- **Cotação:** `NAO_RESPONDEU` → `RESPONDEU`
- **Pedido:** `PENDENTE` → `ACEITO | RECUSADO | EM_ANDAMENTO`
- **Cliente SAC:** `PRE_CADASTRO` → `AGUARDANDO_ACEITE` → `SIM | NAO`

---

## 🧮 Cálculos e Scores

### Lead Score (0–100)
Função: `computeLeadScore` em `lib/utils/lead-score.ts`

**Temperatura:** QUENTE=25, MORNO=15, FRIO=5
**Valor:** ≥R$50k=20, ≥R$10k=15, ≥R$1k=10, >0=5
**Status:** CONVERTIDO=20, REUNIAO_MARCADA=18, CONTATADO=12, EM_PROSPECCAO=8, NOVO=4, PERDIDO=0
**Recência:** ≤1d=15, ≤3d=12, ≤7d=8, ≤14d=4
**Dados completos:** phone/wpp=3, email=3, company=2, assigned=2
**Próxima ação:** agendada=10, vencida=3

**Faixas:** Quente (80+), Bom (60–79), Médio (40–59), Baixo (20–39), Frio (<20)

---

## 🚨 Alertas de Risco (Rules Engine)

Em `lib/ai/rules-engine.ts`:

| Alerta | Condição | Severidade |
|---|---|---|
| `STALE_DEAL` | Contato sem update > SLA do stage (warn 5d, crit 10d) | Média/Alta |
| `NO_NEXT_ACTION` | Contato ativo sem próxima ação definida | Média |
| `TASK_OVERDUE` | Próxima ação vencida | Alta |
| `NO_OWNER` | Contato sem `assigned_to_user_id` | Média |
| `NEVER_CONTACTED` | Contato novo há muito tempo sem interação | Média |
| `HIGH_VALUE_AT_RISK` | Valor alto + temperatura caindo | **Crítica** |
| `COOLING_DOWN` | Temperatura desceu recentemente | Média |

---

## 🤖 Automações

- **Trigger:** `STAGE_CHANGE`
- **Ações:** `MOVE_STAGE`, `SEND_NOTIFICATION`, `CHANGE_TEMPERATURE`, `ASSIGN_USER`
- **Engine:** `lib/automations/engine.ts`

---

## 🛡️ Controle de Acesso por Role

Roles: `admin | user | gerente | sdr | closer | suporte`

- **admin** — vê tudo, gerencia users, audit, automações
- **gerente** — vê todos os contatos dos seus pipelines + audit
- **closer | sdr | user** — vê apenas contatos atribuídos ou dos pipelines em que é membro
- **suporte** — restrito ao módulo de suporte

Filtro de visibilidade em `lib/utils/visibility-filter.ts` + `lib/utils/roles.ts`.

Pipeline membership controlada por `pipeline_members` (user_id, pipeline_id).

---

## 📅 Próximo passo obrigatório (regra do dono, 06/10/2026)

- Toda atividade registrada (ligação, e-mail, WhatsApp...) que **não encerra o negócio** exige o próximo passo: **o que** vai fazer e **quando** (data no futuro). Encerram: convertido, proposta aceita, fechado parcial, sem interesse (estes limpam o próximo passo).
- Dispensado se o contato já tem um próximo passo marcado no futuro.
- Modo Foco: "Não atendeu" agenda sozinho "Ligar" no próximo dia útil 9h (se não houver nada marcado). Follow-up de feira nasce com retorno no próximo dia útil 9h.
- Motivo: na conferência de 05/10, nenhuma das 12 empresas do Mario tinha próximo passo no CRM — a cobrança automática não tinha o que cobrar.

## ✈️ Indicações com IA (regras do dono, 06/10/2026)

- **Só busca quem o admin liberar**, em Admin → Gerenciar Usuários (seletor "IA: N/dia"). Sem liberação = bloqueado, **inclusive o admin**. A trava é no servidor (`lib/indicacoes/permissao.ts`), não só o botão escondido.
- Hoje: **Daniel Lima = 8 buscas/dia**; todos os outros bloqueados. Cada busca custa ~R$1 (OpenAI).
- Vendedor só busca em contato apontado para ele; admin/gerente em qualquer contato apontado.
- **Antes de buscar, o cadastro do cliente é completado pela Receita** (só campos vazios; nada digitado pelo vendedor é sobrescrito). Sem CNPJ, a IA acha pelo nome. Sem cidade, **o vendedor confirma a empresa achada** antes de qualquer gravação (nome parecido engana; cidade errada no cadastro é pior que vazia).
- Cargo do sócio só entra junto com o nome do sócio. CNPJ já usado em outro contato = provável cliente duplicado: não grava e avisa.
- **A IA não traz empresa que já está no CRM** (CNPJ, telefone, site ou nome) — nem rascunho de busca anterior.
- Indicação jogada pro funil ganha a tarefa **"Ligar" no próximo dia útil às 9h** (só se não tiver próxima ação), no nome do dono do contato. "Marcar todas" leva todas de uma vez.
- Mensagem de WhatsApp das indicações **nunca cita o cliente de referência** (é cliente nosso; não se expõe a prospect).
- **Só empresa de médio/grande porte.** Com CNPJ: conferida na Receita; Microempresa, Pequeno Porte, MEI ou CNPJ não ativo é descartada. Sem CNPJ: entra marcada "porte não confirmado" (a IA diz o indício de porte).

## 📋 Conferência de relatórios diários (regras do dono, 06/10/2026)

Tela `/admin/conferencia`: o dono arrasta os e-mails diários dos vendedores (.eml) e vê o que foi dito contra o que foi registrado no CRM.

- **Só admin e gerente.** A trava fica no servidor (`canViewAuditLog` em `app/api/conferencia/route.ts`).
- **Só mostra, não registra nada no CRM.** A cobrança fica com o dono.
- **A IA só extrai** a lista de empresas do e-mail (`lib/conferencia/extrair.ts`). Quem decide "registrou ou não" é uma regra fixa (`lib/conferencia/casar.ts`).
- **Nunca acusar sem certeza.**
  - Nome que bate com várias fichas e sem lançamento vira "Várias fichas", nunca "Não registrou".
  - Nome parecido vira "Provável".
  - A palavra mais rara do nome (a marca) precisa bater: "Aços Continental" não vira "Aços Puma".
- **Conta como registrado** quando há interação do **próprio vendedor** naquela empresa, do dia do relatório até 12h do dia seguinte.
- **"Registrou, mas não citou"** só olha o dia do relatório: o que foi lançado na manhã seguinte é trabalho do outro dia.
- **Alertas:**
  - Reunião prometida que não está em `meetings` (±1 dia da data citada).
  - Próximo passo com dia e sem `proxima_acao_data`.
  - O e-mail afirma um resultado concreto (apresentação, reunião, recusa) e o CRM diz "sem resposta" ou a etapa não andou. "Falou" sozinho não gera alerta.
- **O e-mail bruto não é guardado.** Ele é lido no navegador, só o texto vai ao servidor e só a leitura da IA fica em `ai_analysis_cache` (`CONFERENCIA_EMAIL`).
- **A comparação é refeita a cada vez que a tela abre.** Um lançamento atrasado já aparece sem pagar IA de novo.
- **Custo:** de R$ 0,01 a R$ 0,03 por e-mail (medido em 05/10). Limite de 40 leituras por dia por empresa.

## ❌ O que NUNCA pode acontecer

1. **Contato aparecer em org errada** — vazamento de dados entre organizações
2. **Duplicata inserida sem aviso** — sempre retornar 409 antes
3. **Service Role Key exposta** ao cliente/navegador
4. **RLS desabilitado** em tabela de negócio (organizations, profiles, contacts, interactions, pipelines)
5. **Mover contato sem disparar automações** de stage change
6. **Perder check-in offline** sem feedback visível ao usuário
7. **OpenAI ser chamada sem contexto de quem pediu** (sem rastro em audit)
8. **Deletar migration oficial** de `supabase/migrations/` — só adicionar novas
9. **Usar `*_normalized` sem ter rodado backfill** em contatos antigos
10. **Esquecer de filtrar `organization_id` manualmente** ao usar `getAdminClient()`

---

## 🎯 Casos Extremos Identificados

### CE1. Contato sem telefone E sem email
- Dedupe atual só compara phone ou email
- Se ambos faltam: possível duplicata por nome + CPF/CNPJ (já existe normalização)
- **Decisão:** se não tem phone, email, cpf E cnpj → permitir criar mesmo duplicando (cenário raro)

### CE2. Check-in offline com cartão de visita
- Foto vai pra IndexedDB como base64
- OCR via OpenAI só roda quando voltar online
- **Risco:** usuário pode editar/preencher manualmente antes do OCR rodar → conflito
- **Decisão atual:** se usuário preencheu campo manualmente, OCR não sobrescreve

### CE3. Quiz Feira com múltiplos dias (cheat VIP)
- Config recente (`20260408_quiz_multidia.sql`) adicionou `dias_config` JSONB com valor por dia
- Telefone VIP (`telefone_vip`) pode ter cheat por dia (adivinhar o valor)
- **Regra:** não expor `telefone_vip` em resposta pública — apenas server-side

### CE4. Contato ligado a evento via marker legacy
- Alguns contatos de feira têm `<!--EVENT:uuid-->` em `notes`
- Backfill (`scripts/backfill-contact-event-id.mjs`) migra pra coluna `event_id`
- **Regra:** ao editar `notes` de um contato, **não remover** o marker sem verificar se o backfill já rodou

### CE5. Múltiplas pipelines para um mesmo contato
- Schema atual: contato tem 1 `pipeline_id` e 1 `stage_id` (1-para-1)
- Um contato que é ao mesmo tempo Comprador E Fornecedor fica em 1 pipeline só
- **Decisão atual:** tipo é array (`tipo TEXT[]`), mas pipeline é único. Se precisar de múltiplas: criar outro contato ou mudar schema.

### CE6. Usuário sem `pipeline_members` em role não-admin
- Consulta retorna 0 contatos
- **Decisão atual:** admin sempre vê tudo (`hasFullVisibility`). Non-admin sem membership = sem dados. **Avisar no onboarding.**

### CE7. Importação de CSV com linhas inválidas
- Algumas linhas quebram (data inválida, CPF inválido)
- **Decisão:** `import_runs` marca com status `invalid` e continua o resto. Relatório mostra linhas que falharam.
