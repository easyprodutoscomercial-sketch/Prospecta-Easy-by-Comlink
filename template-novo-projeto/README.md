# Template Novo Projeto

Template base para começar um novo produto com o mesmo padrão do Controlei CRM.

## Como usar

1. **Copiar o template inteiro** para a raiz do novo projeto:
   ```bash
   cp -r template-novo-projeto/. /caminho/do/novo-projeto/
   ```

2. **Preencher os placeholders** nos arquivos:
   - `CLAUDE.md` — trocar `<NOME DO PROJETO>` e preencher as 15 seções
   - `docs/CONTEXTO.md` — o que é, para quem, problema que resolve
   - `docs/REGRAS_NEGOCIO.md` — regras críticas do domínio
   - `docs/DECISOES_TECNICAS.md` — decisões e dívidas
   - `docs/MERCADO.md` — análise competitiva

3. **Instalar Claude Code** e abrir o projeto. Os comandos slash já estarão disponíveis:
   - `/inicio-sessao` — começar o dia
   - `/fim-sessao` — terminar o dia
   - `/revisar` — auditoria completa
   - `/furos` — caçar brechas
   - `/mercado [tema]` — análise competitiva
   - `/novo-produto` — wizard de nova feature grande

4. **Hooks automáticos** já estão configurados em `.claude/settings.local.json`:
   - Resumo de sessão ao iniciar/terminar
   - Bloqueio de comandos destrutivos (`rm -rf /`, `git push --force main`, etc.)

## O que esse template entrega

- [x] `CLAUDE.md` master doc template
- [x] `/docs/` 4 documentos base template
- [x] `/.claude/commands/` 6 comandos slash prontos
- [x] `/.claude/settings.local.json` com permissões e hooks configurados
- [x] `/.claude/hooks/block-destructive.sh` proteção contra comandos perigosos

## Próximos passos após copiar

1. Rodar `/inicio-sessao` com o agente
2. Usar `/novo-produto` para planejar a arquitetura
3. Criar os primeiros arquivos de código
4. A cada sessão, terminar com `/fim-sessao` para manter os docs atualizados
