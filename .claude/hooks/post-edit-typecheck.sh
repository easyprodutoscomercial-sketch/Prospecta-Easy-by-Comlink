#!/bin/bash
# Hook: roda typecheck leve após edição em arquivos críticos.
# NÃO roda build completo (pesado). Só 'npx tsc --noEmit' se o arquivo for crítico.
# Lê o JSON do Claude Code via stdin. Retorna 0 mesmo se typecheck falhar (só avisa).

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | node -e "
let d='';
process.stdin.on('data', c => d += c);
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write(j.tool_input && j.tool_input.file_path ? j.tool_input.file_path : '');
  } catch (e) {}
});
" 2>/dev/null || true)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Só roda typecheck para arquivos críticos: lib/, middleware.ts, supabase/, app/api/
if echo "$FILE_PATH" | grep -qE '(lib/|middleware\.ts|app/api/|supabase/)' ; then
  if echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$' ; then
    echo "🔍 Rodando typecheck rápido (arquivo crítico editado)..." >&2
    cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
    if ! npx --no-install tsc --noEmit --skipLibCheck 2>&1 | head -n 20 >&2 ; then
      echo "⚠️  Typecheck reportou erros. Revisar antes de prosseguir." >&2
    fi
  fi
fi

exit 0
