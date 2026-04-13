---
description: Auditoria completa do projeto — bugs, segurança, performance, testes, regras de negócio
---

# /revisar

Preciso de uma **auditoria completa** do estado atual do projeto. Faça o seguinte:

## 1. Ler os docs primeiro
- `CLAUDE.md`, `docs/REGRAS_NEGOCIO.md`, `docs/DECISOES_TECNICAS.md`

## 2. Rodar a auditoria em 6 dimensões

### Dimensão 1 — 🐛 Bugs potenciais
Procurar em todo o código por padrões que **costumam** ser bug:
- Uso de `getAdminClient()` sem filtro manual por `organization_id` (vazamento multi-tenant)
- `await` faltando antes de uma chamada async
- `useEffect` sem array de dependências
- Promises não aguardadas (especialmente em queues offline)
- Divisão por zero em cálculos de score/percentual
- Acesso a propriedades de objeto possivelmente nulo (`obj.a.b` sem optional chaining)
- Comparações com `==` em vez de `===`

Usar Grep para procurar esses padrões.

### Dimensão 2 — 🔒 Segurança
Auditar:
- Rotas em `app/api/**/route.ts` que **não** têm `auth → getUser() → ensureProfile()` no topo
- Uso de `NEXT_PUBLIC_*` com qualquer segredo
- Hardcoded credentials em qualquer arquivo do repo
- Rotas públicas sem rate limiting
- Service Role Key em lugares errados (especialmente `.claude/settings.local.json`)
- XSS: uso de `dangerouslySetInnerHTML`
- SQL Injection: uso de `.rpc()` ou queries raw sem parametrização

### Dimensão 3 — ⚡ Performance
- Queries Supabase sem `.limit()` em listas potencialmente grandes
- `select('*')` quando só precisa de colunas específicas
- `useEffect` que dispara fetch em toda re-render
- Imagens sem otimização (`<img>` em vez de `next/image`)
- Bundle imports grandes desnecessários (ex: importar `lodash` inteiro)
- Falta de cache em rotas de API pesadas

### Dimensão 4 — 🧪 Testes
- Listar diretórios `__tests__`, arquivos `*.test.ts`, `*.spec.ts`
- Se não houver: **nota 0 em testes** e recomendar priorização de Vitest + testes de `normalize.ts`, `lead-score.ts`, `rules-engine.ts`
- Se houver: medir cobertura das funções críticas

### Dimensão 5 — 📋 Regras de negócio protegidas
Para cada regra em `docs/REGRAS_NEGOCIO.md` seção "Regras Invioláveis", verificar no código:
- **R1. Isolamento por organization_id:** cada rota em `app/api/**` filtra por `organization_id`?
- **R2. Dedupe:** `POST /api/contacts` chama `normalizePhone/normalizeEmail` antes de inserir?
- **R3. Padrão auth → profile → admin:** todas as rotas privadas seguem?
- **R4. Service Role Key:** está isolada?
- **R5. Normalização:** normaliza antes de comparar?
- **R6. Automações no stage change:** `processStageChangeAutomations()` é chamada?
- **R7. Check-in marca booth VISITADO:** no POST de check-in?

Para cada regra: ✅ protegida ou ❌ furo identificado (com arquivo e linha).

### Dimensão 6 — 💰 Impacto no negócio
Priorizar problemas encontrados pelo impacto real:
- **Crítico:** perda de dados, vazamento, custo descontrolado, cliente bloqueado
- **Alto:** bug em fluxo principal (criar contato, mover kanban, check-in)
- **Médio:** bug em feature secundária, pequeno vazamento de perf
- **Baixo:** inconsistência visual, debt técnico sem impacto imediato

## 3. Retornar o relatório

### Formato obrigatório:

```markdown
# 🔍 Auditoria do Projeto — <data>

## Nota Geral: X/10

> Resumo em 1 parágrafo do estado geral.

---

## Problemas Encontrados

### 🚨 CRÍTICOS
1. [ARQUIVO:LINHA] — descrição em linguagem simples
   **Por que é crítico:** ...
   **Como corrigir:** ...

### ⚠️ ALTOS
...

### 🟡 MÉDIOS
...

### 🟢 BAIXOS
...

---

## Regras de Negócio

| Regra | Status | Detalhe |
|---|---|---|
| R1. Isolamento por org | ✅/❌ | ... |
| R2. Dedupe | ✅/❌ | ... |
| ...

---

## Testes

Cobertura: X% das funções críticas | Total de testes: Y

---

## Recomendações Priorizadas (em ordem)

1. 🚨 [AÇÃO] — impacto: ...
2. ⚠️ [AÇÃO] — impacto: ...
3. 🟡 [AÇÃO] — impacto: ...
```

## 4. Linguagem
- Simples, sem jargão
- Explicar sempre o "por que importa" para um não-programador
- Se for técnico demais, usar analogias

## 5. NÃO corrigir nada automaticamente
Apenas **reportar**. O dono decide o que corrigir e quando.
