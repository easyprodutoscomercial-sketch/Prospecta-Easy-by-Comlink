---
description: Analisar como concorrentes resolvem uma feature/tema e recomendar abordagem
---

# /mercado [feature ou tema]

Quero saber como o mercado resolve **$ARGUMENTS**. Faça uma análise competitiva completa.

## 1. Ler o doc de mercado primeiro
- `docs/MERCADO.md` — contexto competitivo já documentado
- Se o tema já tem análise lá, citar e **complementar**, não repetir

## 2. Pesquisar (usando WebFetch / WebSearch se disponível, ou conhecimento interno)

Para cada concorrente relevante (mínimo 3, máximo 6), responder:
- **Nome do produto**
- **Como eles fazem exatamente** (fluxo passo a passo em linguagem simples)
- **UX/UI** (uma observação principal, idealmente com screenshot mental)
- **Preço** (se for cobrado separadamente) e **qual plano inclui**
- **Limitações** (o que eles NÃO fazem ou fazem mal)

Concorrentes a considerar dependendo do tema:
- **CRM brasileiro:** Pipedrive, RD Station CRM, Moskit, Agendor, Ploomes
- **Sales engagement:** Outreach, Salesloft, Reply.io
- **Event/Feira:** Cvent, iCapture, Lead Liaison, Brella, Swapcard
- **Gigantes:** Salesforce, HubSpot, Zoho
- **Vertical agronegócio** (se aplicável): Nbs CRM, Prospecta AgroSoft

## 3. Responder as 5 perguntas obrigatórias

### ❓ 1. Qual é o padrão mínimo do mercado?
O que **todo mundo** espera encontrar. Se não tiver, é falha óbvia.

### ❓ 2. O que seria diferencial competitivo?
Se fizermos de um jeito diferente/melhor, onde nos destacamos?

### ❓ 3. Quais armadilhas comuns outros já cometeram?
O que deu errado com quem já tentou? UX confusa, complexidade excessiva, custo fora de controle, etc.

### ❓ 4. O que o Controlei já tem e funciona?
Citar o que existe hoje no repo que ataca esse tema (buscar em `app/`, `components/`, `lib/`).

### ❓ 5. Recomendação direta
Em 2 parágrafos:
- **Parágrafo 1:** "Recomendo fazer X porque..." (com raciocínio)
- **Parágrafo 2:** "Alternativa seria Y, mas tem desvantagem Z"

## 4. Formato final da resposta

```markdown
# 📊 Análise de Mercado: <tema>

## Contexto
1 parágrafo situando o tema e por que importa.

## Como os concorrentes fazem

### 1. Pipedrive
**Fluxo:** ...
**UX destaque:** ...
**Preço/plano:** ...
**Limitação:** ...

### 2. RD Station CRM
...

(etc.)

## Padrão de mercado (mínimo esperado)
- [ ] Coisa 1
- [ ] Coisa 2
- [ ] Coisa 3

## Oportunidades de diferencial
1. ...
2. ...

## Armadilhas a evitar
- ...
- ...

## O que o Controlei já tem
- ✅ ...
- ⚠️ ... (parcial)
- ❌ ... (não tem)

## 💡 Recomendação

**Faça X.** Raciocínio em 2 parágrafos...

**Esforço estimado:** 1 dia / 1 semana / 1 mês
**Impacto esperado:** alto / médio / baixo
**Pré-requisito:** (se precisar de algo antes)
```

## 5. Linguagem
- Simples, sem jargão
- Comparações concretas (não "melhor", mas "o Pipedrive deixa arrastar com 2 cliques, o HubSpot exige 5")
- Se eu não especificar um tema, perguntar: "Qual feature você quer analisar? Exemplos: notificações, onboarding, lead capture, preços, power dialer, IA copilot..."

## 6. Atualizar docs
Se a análise gerar uma nova decisão de mercado, adicionar em `docs/MERCADO.md` na seção "Decisões de mercado tomadas".
