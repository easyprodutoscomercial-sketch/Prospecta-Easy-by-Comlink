---
description: Wizard para planejar novo produto ou feature grande com análise de esforço e riscos
---

# /novo-produto

Wizard para planejar algo grande. Siga estas etapas:

## Etapa 1 — Perguntas iniciais
1. O que é? (1 frase)
2. Para quem?
3. Qual problema resolve?
4. Como o usuário vive isso hoje?
5. Como medirá sucesso?
6. Qual a urgência?
7. Alguma restrição dura?

**Aguardar respostas.**

## Etapa 2 — Fit com o projeto
- Alinha com o coração do produto? (ler `docs/CONTEXTO.md`)
- Stack atual suporta?
- Impacta módulos existentes?

## Etapa 3 — Análise de mercado (resumida do /mercado)
3 concorrentes + padrão + diferencial + armadilhas.

## Etapa 4 — MVP mínimo
- O que entra
- O que fica pra v2
- Tempo estimado
- Esforço (baixo/médio/alto/muito alto)

## Etapa 5 — Arquitetura (em linguagem simples)
- Dados (tabelas novas?)
- Rotas API
- Telas novas
- Fluxo do usuário em 5 passos
- IA e offline (se aplicável)

## Etapa 6 — 5 maiores riscos
Sempre incluir: segurança, custo, complexidade, regras de negócio, mercado.

## Etapa 7 — Próximos passos (só após aprovação)
- Atualizar docs / copiar template
- Migrations
- Rotas esqueleto
- Componentes base
- Testar
- Commit em branch

Linguagem simples. Opinião direta. Nunca codar sem aprovação.

**COMECE pela Etapa 1.**
