---
description: Resumir a sessão, atualizar docs, listar pendências e sugerir próximos passos
---

# /fim-sessao

Estou encerrando a sessão de trabalho. Faça o seguinte, **nesta ordem**:

## 1. Resumir o que foi feito hoje (em linguagem simples)
Em formato de bullet points, **máximo 8 itens**. Cada item:
- Começa com emoji (✅ feito, 🔧 corrigido, ➕ adicionado, 🗑️ removido, 📝 documentado)
- Frase curta em linguagem simples (sem jargão técnico)
- Opcionalmente, citar arquivo principal entre parênteses

Exemplo:
- ✅ Criei a estrutura de documentação do projeto (CLAUDE.md, /docs/)
- 🔧 Arrumei o bug do sidebar que não persistia (lib/toast-context.tsx)
- ➕ Adicionei cache de OCR para reduzir custo da OpenAI

## 2. Atualizar docs relevantes
Verificar se alguma mudança feita hoje afeta:
- **`CLAUDE.md`** — rotas novas, componentes novos, env vars novas, padrões novos, dívidas novas, armadilhas novas
- **`docs/CONTEXTO.md`** — estado atual do desenvolvimento, histórico de versões
- **`docs/REGRAS_NEGOCIO.md`** — nova regra, novo fluxo, novo caso extremo
- **`docs/DECISOES_TECNICAS.md`** — nova decisão arquitetural, nova dívida técnica, dívida resolvida

Fazer os edits necessários (não reescrever os arquivos — apenas adicionar/modificar as seções afetadas).

## 3. Listar o que ficou pendente
Itens que começamos mas não terminamos. Formato:
- ⏳ [pendente] ...
- 🚧 [em progresso] ...

Incluir também arquivos modificados sem commit:
- 📦 [não commitado] X arquivos (listar os principais)

## 4. Sugerir os próximos 3 passos mais importantes
Priorizados por impacto no negócio, com raciocínio curto pra cada:

```
1. [AÇÃO] — POR QUÊ: ...
2. [AÇÃO] — POR QUÊ: ...
3. [AÇÃO] — POR QUÊ: ...
```

Não todos precisam ser técnicos — pode ser "tome uma decisão sobre X", "teste manualmente Y", "discuta com fulano Z".

## 5. Apontar riscos que surgiram durante a sessão
Coisas que você **percebeu** enquanto trabalhávamos mas talvez o dono não tenha notado:
- 🚨 Risco de segurança
- ⚠️ Bug potencial
- 💸 Risco de custo
- 🐛 Algo frágil que pode quebrar

Se nenhum risco novo surgiu, dizer explicitamente "nenhum risco novo identificado nesta sessão".

## 6. Lembrete final
Se houver **código não commitado**, lembrar:
> ⚠️ Você tem X arquivos não commitados. Quer que eu ajude a fazer commit seguro antes de fechar?

Se tudo estiver commitado:
> ✅ Tudo commitado. Boa pausa!

---

**Formato da resposta:** linguagem simples, direto ao ponto. Sem enrolação. O dono quer parar de trabalhar — respeite o tempo dele.
