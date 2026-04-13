#!/bin/bash
# Hook: bloqueia comandos destrutivos. Exit 2 bloqueia, exit 0 permite.
set -e
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

if [ -z "$CMD" ]; then exit 0; fi

BLOCK=""
if echo "$CMD" | grep -qE 'rm[[:space:]]+-[a-z]*r[a-z]*f[[:space:]]+(/|~|\$HOME|\*|\.\.)' ; then BLOCK="rm -rf em caminho perigoso"; fi
if echo "$CMD" | grep -qE 'git[[:space:]]+push.*(--force|[[:space:]]-f([[:space:]]|$)).*(main|master)' ; then BLOCK="git push --force em main/master"; fi
if echo "$CMD" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard' ; then BLOCK="git reset --hard"; fi
if echo "$CMD" | grep -qiE 'drop[[:space:]]+(table|database|schema)' ; then BLOCK="DROP TABLE/DATABASE"; fi
if echo "$CMD" | grep -qE 'npm[[:space:]]+uninstall' ; then BLOCK="npm uninstall"; fi
if echo "$CMD" | grep -qE 'git[[:space:]]+(checkout|restore)[[:space:]]+\.' ; then BLOCK="git checkout/restore . (descarta alterações)"; fi
if echo "$CMD" | grep -qE 'git[[:space:]]+clean[[:space:]]+-[a-z]*f' ; then BLOCK="git clean -f"; fi
if echo "$CMD" | grep -qE 'git[[:space:]]+branch[[:space:]]+-D' ; then BLOCK="git branch -D"; fi

if [ -n "$BLOCK" ]; then
  echo "🛑 BLOQUEADO: $BLOCK" >&2
  echo "Comando: $CMD" >&2
  echo "Peça confirmação explícita ao dono antes de executar." >&2
  exit 2
fi

exit 0
