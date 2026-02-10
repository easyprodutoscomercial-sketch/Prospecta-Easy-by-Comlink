# Mini CRM - Identificador de Contatos Comerciais

Sistema completo de gestão de contatos com deduplicação inteligente, importação CSV e registro de interações.

## 🚀 Funcionalidades

- ✅ Autenticação via Supabase (multi-tenant)
- ✅ CRUD de contatos com deduplicação automática
- ✅ Importação CSV em lote (até 2.000 linhas)
- ✅ Registro de interações/apontamentos
- ✅ Pipeline de status (NOVO → CONVERTIDO/PERDIDO)
- ✅ Atribuição de contatos por usuário
- ✅ Dashboard com métricas
- ✅ Row Level Security (RLS) por organização

## 📋 Pré-requisitos

- Node.js 18+ e npm
- Conta no Supabase (gratuita)
- Conta na Vercel (gratuita, opcional para deploy)

## 🛠️ Configuração

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em "New Project"
3. Escolha um nome, senha do banco e região
4. Aguarde ~2 minutos até o projeto estar pronto

### 2. Executar SQL do Schema

1. No Supabase, vá em "SQL Editor"
2. Clique em "New Query"
3. Cole o SQL completo do arquivo `schema.sql` (fornecido abaixo)
4. Clique em "Run" (botão verde)
5. Aguarde confirmação "Success. No rows returned"

### 3. Configurar Autenticação

1. No Supabase, vá em "Authentication" → "Providers"
2. Certifique-se que "Email" está habilitado
3. Em "Email Auth", marque:
   - ✅ Enable email provider
   - ✅ Confirm email (opcional, mas recomendado)

### 4. Pegar Credenciais

1. No Supabase, vá em "Settings" → "API"
2. Copie:
   - `Project URL` (NEXT_PUBLIC_SUPABASE_URL)
   - `anon public` key (NEXT_PUBLIC_SUPABASE_ANON_KEY)

### 5. Configurar Projeto

```bash
# Navegar para a pasta do projeto
cd mini-crm

# Instalar dependências
npm install

# Criar .env.local
cp .env.example .env.local
```

Edite `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica-aqui
```

### 6. Rodar Localmente

```bash
npm run dev
```

Acesse: `http://localhost:3000`

### 7. Primeiro Acesso

1. Clique em "Criar Conta"
2. Preencha nome, email e senha
3. Confirme email (se habilitou confirmação)
4. Faça login
5. Uma organização será criada automaticamente!

## 📤 Deploy na Vercel

### Opção 1: Via GitHub (recomendado)

1. Suba o código para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Clique em "Import Project"
4. Selecione o repositório
5. Em "Environment Variables", adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Clique em "Deploy"

### Opção 2: Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Adicionar variáveis (quando solicitado)
# Em seguida:
vercel --prod
```

## 🗄️ Schema SQL

Arquivo completo que deve ser executado no Supabase SQL Editor:

```sql
-- Ver arquivo schema.sql na raiz do projeto
```

## 🧪 Checklist de Testes Manuais

### ✅ Autenticação
- [ ] Criar conta nova
- [ ] Fazer login
- [ ] Fazer logout

### ✅ Contatos - Criação
- [ ] Criar contato com todos os campos
- [ ] Criar contato só com nome
- [ ] Tentar criar duplicado por email → deve avisar
- [ ] Tentar criar duplicado por telefone → deve avisar
- [ ] Tentar criar duplicado por CPF → deve avisar

### ✅ Contatos - Listagem
- [ ] Ver lista de contatos
- [ ] Buscar por nome
- [ ] Filtrar por status
- [ ] Filtrar "Meus contatos"
- [ ] Filtrar "Sem responsável"

### ✅ Importação CSV
- [ ] Importar arquivo válido (10 linhas)
- [ ] Ver relatório: criados/duplicados/inválidos
- [ ] Importar arquivo com duplicados → deve pular
- [ ] Importar arquivo com linhas inválidas → deve reportar

### ✅ Interações
- [ ] Criar ligação SEM_RESPOSTA
- [ ] Criar email RESPONDEU → status muda para CONTATADO
- [ ] Criar reunião REUNIAO_MARCADA → status muda
- [ ] Ver timeline de interações no contato

### ✅ Status e Atribuição
- [ ] Mudar status manualmente
- [ ] Atribuir contato para mim
- [ ] Ver contato atribuído em "Meus contatos"

### ✅ Dashboard
- [ ] Ver métricas atualizadas
- [ ] Clicar em contato recente

## 📁 Estrutura do Projeto

```
mini-crm/
├── app/
│   ├── (auth)/login/              # Tela de login/cadastro
│   ├── (dashboard)/
│   │   ├── dashboard/             # Dashboard com métricas
│   │   ├── contacts/              # Lista, novo, detalhe
│   │   └── import/                # Importação CSV
│   └── api/
│       ├── contacts/              # CRUD de contatos
│       ├── import/                # Processamento CSV
│       └── interactions/          # CRUD de interações
├── lib/
│   ├── supabase/                  # Cliente Supabase
│   └── utils/                     # Normalização e validação
└── components/                    # Componentes reutilizáveis
```

## 🎯 Exemplo de CSV para Importação

Crie um arquivo `contatos.csv`:

```csv
name,phone,email,cpf,cnpj,company,notes
João Silva,(11) 98765-4321,joao@exemplo.com,123.456.789-00,,Empresa X,Cliente em potencial
Maria Santos,(11) 99999-1234,maria@exemplo.com,,,Empresa Y,Indicação do João
Pedro Oliveira,(21) 91234-5678,pedro@teste.com,,,FreeLancer,Aguardando proposta
```

## 🔒 Segurança

- ✅ Row Level Security (RLS) ativo
- ✅ Isolamento por `organization_id`
- ✅ Validação de entrada com Zod
- ✅ Queries parametrizadas (sem SQL injection)

## 📊 Normalização e Deduplicação

O sistema normaliza automaticamente:

- **Email**: `lowercase` + `trim`
- **Telefone**: apenas dígitos
- **CPF/CNPJ**: apenas dígitos
- **Nome**: `trim` + espaços colapsados

Detecção de duplicados por:
1. Email normalizado (prioritário)
2. Telefone normalizado
3. CPF
4. CNPJ

## 🐛 Troubleshooting

### "Não autorizado" ao fazer requisições
- Verifique se está logado
- Limpe cookies e faça login novamente
- Verifique RLS policies no Supabase

### Erro ao criar contato
- Veja console do navegador (F12)
- Veja logs da API: Vercel → Functions → Logs

### Import não funciona
- Arquivo CSV deve ter cabeçalho
- Máximo 2.000 linhas
- Coluna `name` é obrigatória

### Duplicados não sendo detectados
- Verifique se os dados estão normalizados
- Cheque índices únicos no Supabase

## 🚀 Próximos Passos (Fase 2)

- [ ] Componentes shadcn/ui para melhor UX
- [ ] Paginação real (backend)
- [ ] Exports (CSV, Excel)
- [ ] Integração Google Calendar (OAuth)
- [ ] Integração Outlook/Microsoft 365
- [ ] Webhooks para automações
- [ ] Notificações por email
- [ ] Relatórios avançados

## 📞 Suporte

- Documentação Supabase: https://supabase.com/docs
- Documentação Next.js: https://nextjs.org/docs

## 📝 Licença

MIT

---

## 🎉 Pronto para Começar!

```bash
# 1. Instalar dependências
npm install

# 2. Configurar .env.local com credenciais do Supabase

# 3. Rodar local
npm run dev

# 4. Acessar http://localhost:3000
```
