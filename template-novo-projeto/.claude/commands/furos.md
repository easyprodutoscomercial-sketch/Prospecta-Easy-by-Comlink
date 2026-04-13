---
description: Verificar se o código protege todas as regras de negócio e procurar brechas
---

# /furos

Caçe furos nas regras de negócio. Para CADA regra em `docs/REGRAS_NEGOCIO.md`, faça 3 checks:

- **Check A** — O código garante a regra? ✅/⚠️/❌
- **Check B** — Existe teste que falharia se violada? ✅/❌
- **Check C** — Dá pra burlar? (pense como atacante)

## Checklist extra
- [ ] Rotas públicas validam token antes de query?
- [ ] Admin client sempre com filtro de tenant?
- [ ] Upload valida tipo/tamanho/extensão?
- [ ] Middleware protege rotas privadas?
- [ ] RLS ativo em todas as tabelas de negócio?
- [ ] Logs não vazam dados sensíveis?
- [ ] Cookies HttpOnly/Secure/SameSite?
- [ ] Cron com segredo?
- [ ] CORS correto?
- [ ] Rate limiting?

## Formato
```
## 🎯 FURO #N — <título>
**Regra violada:** ...
**Severidade:** 🚨 / ⚠️ / 🟡 / 🟢
**Arquivo:linha**

### Como reproduzir
1. ...

### Por que importa
...

### Como corrigir
...
```

**NÃO corrigir.** Apenas reportar em linguagem simples.
