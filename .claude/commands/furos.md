---
description: Verificar se o código protege todas as regras de negócio e procurar brechas
---

# /furos

Quero que você caçe **furos** nas regras de negócio do sistema. Faça o seguinte:

## 1. Ler as regras
- `docs/REGRAS_NEGOCIO.md` — todas as regras invioláveis e fluxos

## 2. Para CADA regra listada, fazer 3 checks

### Check A — O código garante essa regra?
Verificar no código-fonte se há implementação que protege a regra. Usar Grep e Read para confirmar.

**Responder:** ✅ protegida / ⚠️ parcialmente / ❌ não protegida

### Check B — Existe teste que falharia se a regra fosse violada?
Procurar por arquivos `*.test.ts`, `*.spec.ts` que testem o cenário.

**Responder:** ✅ tem teste / ❌ sem teste

### Check C — Dá pra burlar a regra?
Pensar como **atacante** ou **usuário criativo**:
- Consigo mandar um payload que bypassa?
- Existe caminho alternativo (outra rota, outro endpoint, import direto)?
- Uma operação admin pode inadvertidamente quebrar essa regra?
- Offline/IndexedDB tem alguma brecha?
- Race condition (2 requests simultâneos)?
- Cache envenenado?

## 3. Listar TODAS as vulnerabilidades encontradas

Formato:

```markdown
## 🎯 FURO #N — <título curto>

**Regra violada:** R1. Isolamento por organization_id (ou a regra correspondente)
**Severidade:** 🚨 Crítica / ⚠️ Alta / 🟡 Média / 🟢 Baixa
**Arquivo:afetado:linha**

### Como reproduzir (em linguagem simples)
Passo a passo que um usuário curioso ou atacante poderia fazer:
1. ...
2. ...
3. Resultado: ...

### Por que importa para o negócio
Em 1 parágrafo: o que acontece se alguém explorar isso? Dados vazam? Dinheiro sai? Sistema trava?

### Como corrigir
Sugestão concreta (arquivo + mudança em linguagem simples + código sugerido se couber).
```

## 4. Checklist extra (procurar ALÉM das regras do doc)

Buscar também por:

- [ ] Rotas públicas (`app/api/lead-capture`, `/api/quiz/route`, `/api/portal/*`) validam o token antes de qualquer query?
- [ ] `getAdminClient()` é usado com `.eq('organization_id', ...)` em TODAS as chamadas?
- [ ] Upload de arquivos valida tipo/tamanho/extensão?
- [ ] O middleware protege todas as rotas `/dashboard/*` e `/admin/*`?
- [ ] RLS está ativo em TODAS as tabelas que contêm dados de negócio? (listar)
- [ ] Senhas/secrets não estão em código-fonte?
- [ ] Logs não vazam dados sensíveis (email, CPF, token)?
- [ ] Cookies de sessão têm flags corretas (`HttpOnly`, `Secure`, `SameSite`)?
- [ ] Cron jobs validam um segredo antes de executar?
- [ ] IDs em URLs não permitem enumeração (UUID ou incremental protegido)?
- [ ] CORS está configurado corretamente?
- [ ] O botão de "Deletar" exige confirmação para operações irreversíveis?
- [ ] Limite de tamanho de body nas APIs?

## 5. Resumo final

```markdown
# 🕵️ Caça aos Furos — <data>

**Total de furos encontrados:** X
**Críticos:** N | **Altos:** N | **Médios:** N | **Baixos:** N

## Top 3 furos mais perigosos
1. ...
2. ...
3. ...

## Ação recomendada AGORA
Se houver crítico: "Pare o que está fazendo e corrija isso primeiro: ..."
Se só houver baixo/médio: "Sem urgência imediata. Priorize em ordem: ..."
```

## 6. Regras
- NÃO corrigir nada automaticamente
- Linguagem SIMPLES, sem jargão
- Se um furo existe mas é "teórico" (só daria problema em cenário raro), explicar a probabilidade
- Se não achou furo em algum check, dizer explicitamente "nenhum furo encontrado em X"
