#!/bin/bash
# Hook: lembra o agente de atualizar docs e rodar checks antes de um git commit.
# Lê o JSON do Claude Code via stdin. Sempre retorna 0 (só avisa, não bloqueia).

INPUT=$(cat)

CMD=$(echo "$INPUT" | node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write(j.tool_input && j.tool_input.command ? j.tool_input.command : '');
  } catch (e) {}
});
" 2>/dev/null || true)

if echo "$CMD" | grep -qE 'git[[:space:]]+commit' ; then
  echo "" >&2
  echo "⚠️  CHECKLIST PRÉ-COMMIT (Controlei CRM):" >&2
  echo "   1. Documentação atualizada? (CLAUDE.md, docs/*)" >&2
  echo "   2. Build OK? (npx next build)" >&2
  echo "   3. TypeScript OK? (npx tsc --noEmit)" >&2
  echo "   4. Nenhum segredo no diff? (verificar .env, chaves API)" >&2
  echo "   5. Só arquivos que você quer commitar estão no stage?" >&2
  echo "" >&2
fi

exit 0
