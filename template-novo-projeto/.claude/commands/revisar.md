---
description: Auditoria completa — bugs, segurança, performance, testes, regras de negócio
---

# /revisar

Faça uma auditoria completa do projeto em 6 dimensões:

1. **🐛 Bugs potenciais** — filtros faltando, await ausente, useEffect sem deps, promises não awaited, null safety
2. **🔒 Segurança** — auth faltando em rotas privadas, segredos em NEXT_PUBLIC_*, credentials hardcoded, XSS, SQL injection
3. **⚡ Performance** — queries sem limit, select *, useEffect disparando fetch a cada render, bundles grandes
4. **🧪 Testes** — cobertura das funções críticas; se zero, nota 0 e plano de Vitest
5. **📋 Regras de negócio** — cada regra em docs/REGRAS_NEGOCIO.md verificada ✅/❌ com arquivo:linha
6. **💰 Impacto no negócio** — priorizar por crítico/alto/médio/baixo

## Formato
```
# 🔍 Auditoria — <data>
## Nota Geral: X/10

## Problemas (🚨 críticos | ⚠️ altos | 🟡 médios | 🟢 baixos)
[arquivo:linha] — descrição simples | por que importa | como corrigir

## Regras de Negócio
| Regra | Status | Detalhe |

## Testes
Cobertura X% | Total Y

## Recomendações Priorizadas
1. 🚨 ...
2. ⚠️ ...
3. 🟡 ...
```

**NÃO corrigir nada automaticamente.** Apenas reportar. Linguagem simples, sem jargão.
