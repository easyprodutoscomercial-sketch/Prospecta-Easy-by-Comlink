# Subagentes do RACHEI

Subagentes especializados do Claude Code que operam no contexto do
projeto RACHEI. Cada um e um arquivo `.md` neste diretorio com
frontmatter YAML (`name`, `description`, `tools`, `model`, `color`) +
corpo de instrucoes.

**Total ativo: 19 subagentes** (3 originais + 14 adaptados do Anfitriao
+ 1 novo + 1 meta-orquestrador).

## Como invocar

No terminal do Claude Code, mencione pelo `@nome`:

```
@agente-analista-dados quantos premium converteram esse mes?
@agente-roadmap qual feature priorizar agora?
@agente-criativos cria copy pra anuncio Instagram persona casal
@meta-orquestrador audita o produto inteiro e me da plano 30d
```

Ou natural language — o Claude detecta sozinho:
- "quantos users novos?" → `agente-analista-dados`
- "ta dando erro 500" → `agente-sre`
- "tem influencer pra contratar?" → `agente-influencer`
- "audita compliance LGPD" → `agente-lgpd`

## Catalogo completo (19)

### Originais do RACHEI (3)

- **[furos-auditor](furos-auditor.md)** 🔴 — Audita regras de negocio (NAO corrige). Use antes de mexer em pagamentos/auth/RLS.
- **[deploy-doctor](deploy-doctor.md)** 🟠 — Diagnostica problemas de build/deploy/CI no Vercel.
- **[prompt-engineer](prompt-engineer.md)** — Refina pedidos brutos do Josimar em prompt tecnico estruturado.

### Produto & Dados (3)

- **[agente-analista-dados](agente-analista-dados.md)** 🔵 — Text-to-SQL READ-ONLY no banco do RACHEI. Responde "quantos premium?", "MRR atual?", "conversao trial-paid?".
- **[agente-roadmap](agente-roadmap.md)** 🟡 — Priorizacao data-driven RICE. Cruza feature_suggestions + reactions + churn + MRR + esforco.
- **[agente-pesquisa-usuario](agente-pesquisa-usuario.md)** 🔵 — Sintese de feedback (sugestoes, conversas Mariano, dislikes, Concierge ignorado). Temas com volume + sentimento + acao.

### Operacoes (4)

- **[agente-sre](agente-sre.md)** 🟠 — Triagem de incidentes em PRODUCAO (diferente do deploy-doctor que e build). Logs + git log recente + armadilhas. Sugere rollback/patch.
- **[agente-financeiro](agente-financeiro.md)** 🟢 — Concilia MercadoPago + calcula MRR/ARR + detecta trial expirado ainda premium + failed payments.
- **[agente-juridico](agente-juridico.md)** ⚪ — Revisa termos/contratos/feature nova com risco. NAO substitui advogado (faz primeira leitura).
- **[agente-lgpd](agente-lgpd.md)** 🔴 — Auditoria compliance LGPD. Direitos do titular (acesso, portabilidade, esquecimento). Base legal documentada.

### Vendas & Atendimento (4)

- **[agente-sdr](agente-sdr.md)** 🟡 — Qualifica leads novos (signups recentes). Score 0-100. Top 5 pra abordar.
- **[agente-whatsapp](agente-whatsapp.md)** 🔴 — Analisa conversas WhatsApp (mariano_messages source=whatsapp). NUNCA envia. Sprint A em modo blindado.
- **[agente-upsell](agente-upsell.md)** 🟢 — Free no limite (3/2) e premium engajado pra upsell. Texto sugerido por caso.
- **[agente-retencao](agente-retencao.md)** 🟣 — Detecta sinais de churn 1-pra-1. Sugere mensagem personalizada, NAO envia.

### Marketing & Growth (6)

- **[agente-criativos](agente-criativos.md)** 🌸 — Gera copy/imagens/videos pra ads Meta/Google/TikTok. 5 angulos por brief. Compliance Google Ads.
- **[agente-bidding-meta](agente-bidding-meta.md)** 🔵 — Otimizacao Meta Ads (FB+IG). CPM, CTR, ROAS, frequencia. Sugestoes de ajuste.
- **[agente-bidding-google](agente-bidding-google.md)** 🔴 — Otimizacao Google Ads. **ALTO RISCO** (conta banida 2x — armadilha #26 + compliance critico).
- **[agente-seo](agente-seo.md)** 🟢 — Monitor SEO organico + structured data + sugestao de conteudo.
- **[agente-social-listening](agente-social-listening.md)** 🟠 — Mencoes do RACHEI + concorrentes em redes/forums. Sentiment + acao.
- **[agente-influencer](agente-influencer.md)** 🌸 — Discovery micro-influencers BR (5k-100k). Outreach com afiliado.

### Tech & Inovacao (1)

- **[agente-radar-tech](agente-radar-tech.md)** 🔵 — Pesquisa **ATIVA na web** (WebSearch + WebFetch) por novidades Claude/Anthropic, MCP servers, hooks, libraries Next/Supabase/Vercel, extensoes, mercado fintech BR.

### Orquestracao (1)

- **[meta-orquestrador](meta-orquestrador.md)** 🟣 — Coordena multiplos agentes em fluxo composto. Pipeline/fan-out/condicional/reativo. Decide quais invocar + agrega resultados.

## Agentes com Caminho B (cron diario via cron-job.org)

4 dos 19 ja rodam **automaticamente** em cron e salvam outputs em
`agent_outputs`. UI no `/admin > aba Agentes IA`:

| Agente | Cron | Frequencia |
|--------|------|------------|
| `agente-analista-dados` | `/api/cron/agente-analista-dados` | Diario 8h |
| `agente-roadmap` | `/api/cron/agente-roadmap` | Semanal Seg 9h |
| `agente-sre` | `/api/cron/agente-sre` | Diario 10h |
| `agente-retencao` | `/api/cron/agente-retencao` | Diario 10h30 |

Os outros 15 sao **on-demand** via Claude Code (nao tem cron).

## Origem dos 14 agentes adaptados (2026-05-19)

Specs originais em `C:\Users\josim\Desktop\anfitrião\agentes/`.
Adaptacoes principais pra RACHEI:

- Substituido referencias genericas (PostHog, Mixpanel, Sentry, Linear,
  Productboard) por ferramentas reais do RACHEI (Vercel, Supabase,
  banco direto, feature_suggestions)
- Cita tabelas e armadilhas reais (#1-#38 do CLAUDE.md)
- Linguagem alinhada com Josimar (nao-programador, decisor final)
- Guardrails do Sprint A WhatsApp (janela 24h, throttle, kill switch)
- Compliance Google Ads (armadilha #26 — historico de banimento)
- Modelo Netflix (trial 30d com cartao)
- Limites free (3 despesas + 2 receitas)
- Ecossistema de Confianca (diferencial competitivo unico)

## Como criar novo subagente

1. Cria arquivo em `.claude/agents/agente-NOME.md`
2. Frontmatter YAML obrigatorio:
   ```yaml
   ---
   name: agente-NOME
   description: [quando o agente deve ser invocado, em 1-2 frases]
   tools: Read, Grep, Glob, Bash  # so ferramentas que precisa
   model: sonnet  # ou opus pra raciocinio pesado
   color: blue|red|green|yellow|orange|purple|pink|cyan|gray
   ---
   ```
3. Corpo: instrucoes detalhadas (objetivo, contexto RACHEI, inputs,
   outputs com formato fixo, guardrails NUNCA faz, padroes RACHEI
   especificos, self-improvement)
4. Adiciona aqui no README na categoria certa

## Diretrizes universais

Todo subagente DEVE:

- **NUNCA** ser autonomo de verdade (sempre human-in-loop)
- **NUNCA** executar acao que afeta cliente/dinheiro sem aprovacao
- Citar armadilhas do CLAUDE.md quando relevante
- Linguagem simples (Josimar nao-programador)
- Output em formato fixo (titulos, tabelas, "Pergunta de volta")
- Sugerir documentacao apos cada execucao (REGRA CRITICA #1)
- Respeitar Sprint A WhatsApp (kill switch + janela 24h + throttle)
- Verificar conexao direta do banco (NUNCA pooler — armadilha #7)

## Roadmap futuro

### Caminho B (cron) pros 15 restantes
4 ja tem cron. Outros 15 sao on-demand. Quando algum se mostrar
util recorrente, adicionar cron:
- `agente-financeiro` cron diario → MRR/ARR daily report
- `agente-radar-tech` cron semanal → novidades acumuladas (precisa
  resolver: Cloudflare AI nao tem web nativo, alternativas listadas
  em commit a7fd6a3 PR description)
- `agente-pesquisa-usuario` cron semanal → sintese feedback Dom

### Caminho C (autonomo com acoes)
Adiar 1-2 meses. Requer dashboard de aprovacao, kill switches por
agente, budget cap, audit log de tudo.

### Mais agentes possiveis (sob demanda)
- agente-evento-marketing (Black Friday, Dia dos Namorados)
- agente-onboarding (sequencia automatica nos primeiros 7d)
- agente-financeiro-detalhe (split por feature: tributario, investimento)
- agente-conteudo (blog post organico pra SEO)

Cada novo agente: pedir Josimar autorizar antes baseado em ROI.
