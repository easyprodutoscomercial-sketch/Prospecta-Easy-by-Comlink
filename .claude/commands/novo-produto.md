---
description: Wizard para planejar um novo produto ou feature grande com análise de esforço e riscos
---

# /novo-produto

Quero planejar um **novo produto ou feature grande**. Conduza um wizard comigo, fazendo perguntas e analisando. Siga **exatamente** estas etapas:

## Etapa 1 — Entendimento inicial

Me faça essas perguntas (uma de cada vez, ou todas juntas se fizer sentido):

1. **O que é?** (1 frase: "um app que...", "uma feature que...")
2. **Para quem é?** (perfil do usuário)
3. **Qual problema resolve?** (dor concreta, não generalidade)
4. **Como o usuário vive esse problema hoje?** (competição atual, incluindo não-fazer-nada)
5. **Como você medirá sucesso?** (métrica clara: X contatos/feira, Y% conversão, Z tempo economizado)
6. **Qual a urgência?** (tem prazo? tem evento marcado? tem custo se não fizer?)
7. **Existe alguma restrição dura?** (orçamento, prazo, tecnologia obrigatória)

**Só prossiga quando eu responder.**

## Etapa 2 — Análise de fit com o projeto atual

Depois de entender, verifique:

### 2A. Faz sentido no projeto atual?
Leia `docs/CONTEXTO.md` para saber o coração do produto e responda:
- Essa feature **alinha** com o coração ("CRM + Feiras")?
- Ou é uma distração que vai inchar o sistema?
- **Opinião direta:** "Recomendo fazer dentro do Controlei porque..." OU "Recomendo ser um projeto separado porque..."

### 2B. A stack atual suporta?
- Next.js + Supabase + OpenAI conseguem cumprir?
- Precisa adicionar algo novo? (ex: Redis, worker server, outro banco)
- Listar dependências novas necessárias (com versão)

### 2C. Impacta algo existente?
- Qual módulo atual essa feature toca? (contacts, events, kanban, suporte...)
- Risco de quebrar o que já funciona?
- Migrations de banco necessárias?

## Etapa 3 — Análise de mercado

Invocar mentalmente o mesmo processo do `/mercado`:
- 3 concorrentes fazendo o que planejamos
- Padrão mínimo esperado
- Diferencial possível
- Armadilhas já cometidas

**Resumo em 1 parágrafo.**

## Etapa 4 — MVP mínimo viável

Propor o **menor** MVP possível que entrega valor:

```markdown
## MVP

### O que ENTRA
- Funcionalidade crítica 1
- Funcionalidade crítica 2
- Funcionalidade crítica 3

### O que FICA PARA DEPOIS (v2)
- ...
- ...

### Tempo estimado para MVP
X dias / X semanas

### Esforço
Baixo / Médio / Alto / Muito Alto
```

## Etapa 5 — Arquitetura proposta (em linguagem simples)

Explicar em linguagem simples, com analogias:

- **Onde os dados vão morar?** (quais tabelas novas, quais existentes usar)
- **Quais rotas de API vão ser criadas?** (lista rápida)
- **Quais telas novas?** (lista)
- **Como o usuário vai usar?** (fluxo de 5 passos)
- **Onde entra IA?** (se entra)
- **Offline funciona?** (se aplicável)

**Não desenhe arquitetura de software pra programador. Desenhe como você explicaria pro dono em um guardanapo.**

## Etapa 6 — Os 5 maiores riscos

```markdown
## 🚨 Riscos

1. **[Risco]** — impacto: ... — mitigação: ...
2. **[Risco]** — ...
3. **[Risco]** — ...
4. **[Risco]** — ...
5. **[Risco]** — ...
```

Incluir SEMPRE:
- Risco de segurança
- Risco de custo (IA, infra, integrações pagas)
- Risco de complexidade (vai travar o time?)
- Risco de regra de negócio (vai quebrar regra existente?)
- Risco de mercado (alguém já faz melhor?)

## Etapa 7 — Próximos passos concretos

Só **depois** que eu aprovar tudo acima:

1. Criar os docs do novo produto:
   - Se for feature no projeto atual: atualizar `CLAUDE.md` + `docs/CONTEXTO.md` + `docs/REGRAS_NEGOCIO.md`
   - Se for projeto separado: copiar `template-novo-projeto/` para nova pasta e preencher
2. Criar migrations necessárias
3. Criar rotas de API esqueleto
4. Criar componentes base
5. Testar fluxo manual
6. Commit em branch dedicada

## Etapa 8 — Linguagem e comportamento

- Sempre em linguagem simples, sem jargão
- Opinião direta e honesta
- Se algo não faz sentido, **fale** em vez de só executar
- Nunca começar a codar sem aprovação explícita
- Usar analogias do mundo real para explicar conceitos técnicos

---

**COMECE pela Etapa 1.** Faça as perguntas. Espere as respostas.
