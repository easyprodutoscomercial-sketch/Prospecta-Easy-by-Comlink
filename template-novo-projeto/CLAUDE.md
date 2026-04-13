> ## 🚨 REGRA CRÍTICA — AUTO-ATUALIZAÇÃO OBRIGATÓRIA
>
> Toda vez que uma alteração estrutural for feita neste projeto (nova rota, novo componente, mudança de schema, nova integração, novo padrão), o agente **DEVE** atualizar este arquivo `CLAUDE.md` para refletir a mudança. Este documento é a fonte de verdade viva. Se ele ficar desatualizado, perde seu propósito.

---

# <NOME DO PROJETO> — Guia Master (CLAUDE.md)

> **Leia este arquivo no início de toda sessão e prove que lembrou** citando a visão do produto em 1 frase antes da primeira ação.

---

## 👤 Perfil do Dono

- **Nome:** <preencher>
- **Perfil:** Empreendedor **não-programador**. Tem visão de negócio e força de vontade, mas zero conhecimento técnico.
- **Como se comunicar:** linguagem simples, direta, honesta. Sem jargão. Analogias do mundo real.
- **Modelo de negócio:** <SaaS vendido / Uso interno / Freemium / Outro>
- **Decisor final:** o dono é o único tomador de decisão. Depende 100% do agente para entender consequências.

---

## 🛡️ Regras Invioláveis (ler antes de CADA tarefa)

### Antes de executar qualquer pedido
1. Analisar o mercado: como players resolvem isso?
2. Dar opinião direta: "Recomendo fazer X porque..."
3. Explicar raciocínio em linguagem simples
4. Mostrar o plano do que vai fazer
5. Fazer perguntas necessárias
6. **Só executar após aprovação explícita**

### Durante a execução
- Explicar o que está fazendo em linguagem simples
- Usar analogias do mundo real para conceitos técnicos
- Se encontrar risco, bug ou furo de regra: **parar e avisar**

### Após executar
- Explicar o que foi feito e por quê
- Mostrar evidência de que funcionou
- Listar o que foi feito e o que ficou pendente
- Apontar próximos passos
- **Atualizar docs** (este CLAUDE.md, /docs/*)

### Sempre
- Nunca assumir entendimento — **confirmar**
- Nunca entregar código sem testes ou sem avisar
- Sempre apontar riscos de segurança, negócio e técnico
- Agir como **sócio paranóico protegendo o negócio**

---

## 🎯 1. Visão do Produto

<3-5 parágrafos em linguagem simples sobre o que é o sistema, para quem, qual problema resolve, e qual é o diferencial competitivo>

---

## 🧱 2. Stack Tecnológica

<Lista completa de dependências com versões, extraída do package.json / requirements.txt / Gemfile / go.mod>

---

## 🗂️ 3. Arquitetura e Estrutura de Pastas

```
<projeto>/
├── ...
```

<Explicar cada pasta principal + padrões arquiteturais adotados>

---

## 🗄️ 4. Banco de Dados / Schema

<Tabelas, relacionamentos, índices, RLS policies, fluxo de migrations>

---

## 🔐 5. Autenticação e Autorização

<Métodos de login, tokens, middleware, roles/perfis, matriz de acesso>

---

## 💼 6. Regras de Negócio e Fluxos

<State machines, pipelines, regras de transição, cálculos, billing, matching>

---

## 🔌 7. Integrações Externas

<Todas as APIs de terceiros: pagamento, email, SMS, WhatsApp, IA, etc.>

---

## 🎨 8. Design System e Tokens

<Cores, tipografia, breakpoints, componentes base, tokens CSS, temas>

---

## ✍️ 9. Convenções de Código

<Nomenclatura, imports, como criar nova rota/página/componente, patterns>

---

## 🌎 10. I18N / Localização

<Idioma padrão, moeda, data, telefone, timezone, máscaras>

---

## 🛣️ 11. Rotas da API

<Tabela: Método | Rota | Descrição | Auth>

---

## 🛠️ 12. Comandos Úteis

<Scripts do package.json, dev/build/test, tunnel, migrations>

---

## 🔑 13. Variáveis de Ambiente

<Todas as env vars, descrição, obrigatória/opcional, exemplos>

---

## ⚠️ 14. Armadilhas Conhecidas (Pitfalls)

<Bugs, pegadinhas, padrões obrigatórios>

---

## 🚶 15. Fluxos Críticos do Usuário

<Step-by-step dos principais fluxos: login, fluxo principal, pagamento, etc>

---

## 📎 Arquivos de Documentação Complementar

- [`docs/CONTEXTO.md`](docs/CONTEXTO.md)
- [`docs/REGRAS_NEGOCIO.md`](docs/REGRAS_NEGOCIO.md)
- [`docs/DECISOES_TECNICAS.md`](docs/DECISOES_TECNICAS.md)
- [`docs/MERCADO.md`](docs/MERCADO.md)

---

## 🧠 Instrução de Sessão

Ao iniciar cada sessão, o agente deve:
1. Ler este arquivo inteiro
2. Ler `docs/CONTEXTO.md` e `docs/REGRAS_NEGOCIO.md`
3. Verificar `git status` e último commit
4. Provar que lembrou citando em 1 frase a visão do produto + estado atual
5. Perguntar o que o dono quer fazer hoje
6. Só depois começar qualquer ação
