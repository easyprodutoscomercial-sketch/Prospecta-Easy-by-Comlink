---
description: Ler todos os docs do projeto, mostrar estado atual e perguntar o que fazer hoje
---

# /inicio-sessao

Estou começando uma nova sessão de trabalho no **Controlei CRM**. Faça o seguinte, **nesta ordem**:

## 1. Ler todos os documentos essenciais
- `CLAUDE.md` (raiz) — guia master
- `docs/CONTEXTO.md` — o que é o produto
- `docs/REGRAS_NEGOCIO.md` — regras que não podem ser quebradas
- `docs/DECISOES_TECNICAS.md` — dívidas técnicas conhecidas
- `docs/MERCADO.md` — contexto competitivo (se for relevante ao que vou pedir)

## 2. Provar que leu e entendeu
Em **2 parágrafos curtos**, me diga:
- **O que é o Controlei CRM** (1 frase citando o coração do produto)
- **Quais são as 3 maiores dívidas técnicas hoje** (1 frase cada, extraídas do `DECISOES_TECNICAS.md`)
- **Qual é o meu perfil como dono** (não-programador, sistema interno, regras invioláveis)

> ⚠️ Se esqueceu algo importante, eu corrijo — esse é o momento de alinhar.

## 3. Mostrar o estado atual do projeto (em 5 linhas)
Rodar em paralelo:
- `git branch --show-current` → branch atual
- `git status --short` → arquivos modificados
- `git log -1 --oneline` → último commit
- `git log --oneline -5` → últimos 5 commits (pra lembrar o que aconteceu)

Formato esperado:
```
Branch: <nome>
Commit atual: <hash> <mensagem>
Arquivos modificados: <quantos> (listar os 5 mais importantes)
Últimos commits:
  - ...
  - ...
```

## 4. Listar o que ficou pendente da última sessão
Baseado em:
- Arquivos não commitados no `git status`
- Seção "Em andamento" do `docs/CONTEXTO.md`
- Últimas linhas de `docs/DECISOES_TECNICAS.md` marcadas como "plano"

Em formato de lista curta: "o que sobrou pra fazer".

## 5. Me perguntar o que quero fazer hoje
Pergunta direta: **"O que vamos trabalhar hoje?"**

E ofereça 3 sugestões baseadas no que está pendente, priorizadas por impacto no negócio. Exemplo:
1. 🚨 Commitar código em risco (eventos, offline)
2. 🛡️ Rotacionar service_role key (segurança)
3. 💰 Implementar cache OpenAI (custo)

## 6. Aguardar confirmação antes de QUALQUER ação
Não começar nada sem eu dizer "pode ir" ou escolher uma opção. Regra inviolável.

---

**Formato da resposta:** linguagem simples, sem jargão. Use analogias se precisar explicar algo técnico. Lembre que sou empreendedor não-programador.
