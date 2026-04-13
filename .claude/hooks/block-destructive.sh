#!/bin/bash
# Hook: bloqueia comandos destrutivos no Bash tool.
# Lê o JSON do Claude Code via stdin e retorna exit 2 se o comando for perigoso.
# Exit 0 = permite | Exit 2 = bloqueia (mensagem em stderr aparece pro agente).

set -e
INPUT=$(cat)

# Extrai o comando usando node (portável no Windows Git Bash, já vem com Next.js).
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

if [ -z "$CMD" ]; then
  exit 0
fi

# Padrões destrutivos. Se bater em qualquer um, bloqueia com aviso.
BLOCK=""

# rm -rf em caminhos perigosos
if echo "$CMD" | grep -qE 'rm[[:space:]]+-[a-z]*r[a-z]*f[[:space:]]+(/|~|\$HOME|\*|\.\.)' ; then
  BLOCK="rm -rf em caminho perigoso"
fi
if echo "$CMD" | grep -qE 'rm[[:space:]]+-[a-z]*f[a-z]*r[[:space:]]+(/|~|\$HOME|\*|\.\.)' ; then
  BLOCK="rm -rf em caminho perigoso"
fi

# git push --force em main/master
if echo "$CMD" | grep -qE 'git[[:space:]]+push.*(--force|[[:space:]]-f([[:space:]]|$)).*(main|master)' ; then
  BLOCK="git push --force em main/master"
fi

# git reset --hard
if echo "$CMD" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard' ; then
  BLOCK="git reset --hard (pode apagar trabalho)"
fi

# DROP TABLE / DROP DATABASE
if echo "$CMD" | grep -qiE 'drop[[:space:]]+(table|database|schema)' ; then
  BLOCK="DROP TABLE/DATABASE/SCHEMA em SQL"
fi

# npm uninstall
if echo "$CMD" | grep -qE 'npm[[:space:]]+uninstall' ; then
  BLOCK="npm uninstall (pode quebrar dependências)"
fi

# git checkout . / git restore .
if echo "$CMD" | grep -qE 'git[[:space:]]+(checkout|restore)[[:space:]]+\.' ; then
  BLOCK="git checkout/restore . (descarta alterações)"
fi

# git clean -f
if echo "$CMD" | grep -qE 'git[[:space:]]+clean[[:space:]]+-[a-z]*f' ; then
  BLOCK="git clean -f (apaga arquivos não trackeados)"
fi

# git branch -D (delete forçado)
if echo "$CMD" | grep -qE 'git[[:space:]]+branch[[:space:]]+-D' ; then
  BLOCK="git branch -D (delete forçado de branch)"
fi

if [ -n "$BLOCK" ]; then
  echo "🛑 BLOQUEADO: $BLOCK" >&2
  echo "Comando: $CMD" >&2
  echo "Se realmente precisa, peça confirmação explícita ao dono antes de executar." >&2
  exit 2
fi

exit 0
