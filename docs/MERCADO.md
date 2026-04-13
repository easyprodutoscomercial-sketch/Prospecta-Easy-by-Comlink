# MERCADO — Controlei CRM

> Como os outros fazem, onde estamos, o que copiar, o que evitar.

---

## 🎯 Categoria do produto

O Controlei é um **CRM B2B** com diferencial forte em **gestão de feiras e eventos**. No mercado, ele se posiciona na interseção entre:

1. **CRM tradicional** (gestão de funil, contatos, follow-up)
2. **Sales engagement tools** (automação, cadência, coaching por IA)
3. **Event management software** (gestão de feiras presenciais)
4. **Lead capture tools** (QR code, formulário público, OCR)

---

## 🏢 Concorrentes / Referências

### CRMs brasileiros (B2B SMB)

#### 🇧🇷 **Pipedrive** (líder internacional, forte no Brasil)
- **O que faz bem:** kanban visual limpo, relatórios de funil, automações fáceis
- **O que cobra:** R$ 39–99/usuário/mês
- **O que eles NÃO têm:** módulo sério de feiras presenciais. Integrações com scanner de cartão são via plugin de terceiro.
- **O que copiar:** UX do kanban, simplicidade da curva de aprendizado
- **O que evitar:** cobrar por usuário (modelo exclui equipes pequenas)

#### 🇧🇷 **RD Station CRM**
- **O que faz bem:** integração nativa com RD Station Marketing (funil end-to-end), lead scoring robusto
- **O que cobra:** R$ 50–150/usuário/mês
- **Alvo:** SMBs que já são clientes RD Marketing
- **O que copiar:** lead scoring com histórico e visualização do "porquê" do score
- **O que evitar:** lock-in com ecossistema RD

#### 🇧🇷 **Moskit CRM**
- **O que faz bem:** simplicidade, foco brasileiro, preço acessível
- **O que cobra:** R$ 35–120/usuário/mês
- **Diferencial:** WhatsApp integrado no ticket
- **O que copiar:** foco pt-BR, CPF/CNPJ nativo, endereços brasileiros
- **O que evitar:** UI datada

#### 🇧🇷 **Agendor**
- **O que faz bem:** foco em vendas consultivas B2B, campos customizáveis, dashboard acionável
- **O que cobra:** R$ 53–89/usuário/mês
- **Diferencial:** relatórios de atividade de vendedor
- **O que copiar:** foco em **atividades** (o que vendedor fez), não só em resultado
- **O que evitar:** pouca automação sem planos altos

#### 🇧🇷 **Ploomes**
- **O que faz bem:** customização pesada, integração com ERPs brasileiros (Omie, Bling)
- **O que cobra:** R$ 75–200/usuário/mês
- **Diferencial:** CPQ (quote generation)
- **O que copiar:** integração com módulo de pedidos/cotações (bate com o nosso `pedidos-cotacoes`)
- **O que evitar:** complexidade excessiva na configuração inicial

---

### Event/Trade Show tools

#### 🌎 **Cvent** (líder mundial)
- Foco: organização de eventos corporativos grandes
- Muito caro (enterprise), overkill pra operação SMB
- **O que copiar:** check-in por QR, gestão de participantes com dashboards live
- **O que NÃO copiar:** complexidade, preço

#### 🌎 **Eventbrite**
- Foco: venda de ingressos + gestão de público
- Pouco relevante para B2B em feiras profissionais
- **Não é concorrente direto**

#### 🇧🇷 **Brella / Swapcard**
- Networking em feiras B2B
- App mobile para participantes encontrarem contatos
- **O que copiar:** UX mobile simples, QR badge
- **O que NÃO copiar:** foco é no participante, não no expositor

---

### Lead Capture / Scanner

#### 🌎 **iCapture** (event lead capture profissional)
- Scanner de cartão de visita + formulários dinâmicos
- Integração direta com CRMs (Salesforce, HubSpot)
- Preço: $300+/mês
- **O que copiar:** formulários de captura com campos dinâmicos por feira, score imediato pós-captura
- **O que temos de vantagem:** OCR via GPT-4o é provavelmente mais barato e mais preciso que o deles

#### 🌎 **Lead Liaison**
- Similar ao iCapture, com retargeting
- **Lição:** todos no mercado cobram caro justamente por OCR + integração com CRM. Nós temos os 2 no mesmo produto.

---

## 📊 Benchmarks do mercado (padrão mínimo esperado)

Coisas que um usuário de CRM B2B brasileiro **espera** encontrar:

### ✅ Já temos
- [x] Kanban visual com drag-and-drop
- [x] Lead scoring
- [x] Dedupe por telefone/e-mail/CPF/CNPJ
- [x] Histórico de interações (ligações, WhatsApp, reunião)
- [x] Importação Excel
- [x] Relatórios de funil
- [x] Automação por trigger de stage
- [x] Notificações
- [x] Multi-usuário com roles
- [x] Portal público para suporte
- [x] PWA instalável
- [x] Dark mode
- [x] LGPD-compliant (dados escopados por org)

### ⚠️ Padrão que NÃO temos ainda
- [ ] **Integração direta com WhatsApp Business API** — hoje só registra interação manualmente. Isso é **mesa obrigatória** para CRM brasileiro.
- [ ] **Telefonia embutida (click-to-call)** — comum em Pipedrive, Moskit, Ploomes
- [ ] **Templates de e-mail/WhatsApp** com variáveis — hoje mensagem é escrita à mão
- [ ] **E-mail sequence / cadência automatizada** — básico em sales engagement
- [ ] **Integração com calendário externo** (Google/Outlook) — bidirecional
- [ ] **Assinatura digital de proposta** — Ploomes tem
- [ ] **Integração com ERP brasileiro** (Omie, Bling, Conta Azul)
- [ ] **Relatório de atividade por vendedor** (leaderboard existe, mas detalhe falta)

### 🎯 Padrão onde SOMOS diferentes (bom)
- **Módulo de feiras nativo** — nenhum concorrente brasileiro tem isso integrado ao CRM com mapa, stands, check-in offline
- **OCR de cartão via IA top-tier** — GPT-4o Vision é mais preciso que as soluções dedicadas de mercado
- **Quiz gamificado** — é um hack criativo de captura que ninguém faz de forma nativa
- **Offline-first real** — raríssimo em CRMs web; nós fomos desenhados para isso
- **Lead capture por QR code público** — alguns têm, mas quase ninguém liga ao evento + booth
- **AI Copilot integrado** (próxima ação, análise de pipeline) — começando a ser padrão em 2026, mas ainda não é universal

---

## 💡 Oportunidades identificadas

### O1. WhatsApp Business API nativo (URGENTE no mercado BR)
No Brasil, **90% das conversas B2B passam por WhatsApp**. Sem integração nativa, o Controlei força registro manual de cada interação. **Maior gap funcional vs concorrentes.**

**Custo:** Meta Business + provedor (Twilio, Z-API, WAHA) → ~R$ 100–500/mês
**Benefício:** elimina trabalho manual, histórico automático, templates

### O2. OCR local fallback (Tesseract)
Feiras com Wi-Fi ruim + dependência de OpenAI = risco. Ativar Tesseract.js como fallback offline dá autonomia.

**Custo:** 1 dia de dev (já tá instalado)
**Benefício:** OCR funciona 100% do tempo, mesmo sem internet

### O3. Cache de análises IA
OpenAI sem cache é queima de dinheiro. Implementar cache por hash de imagem / condições de contato reduz custo em 60-80%.

**Custo:** 2 dias de dev
**Benefício:** custo de IA cai drasticamente

### O4. Integração Google Calendar (bidirecional)
Meetings hoje vivem apenas no banco. Sincronizar com Google Calendar do vendedor = UX de primeira linha.

**Custo:** 3-5 dias de dev (Google Calendar API + OAuth)
**Benefício:** vendedor não precisa sair do CRM para marcar reunião

### O5. Templates de mensagem (WhatsApp + Email)
Biblioteca de templates com variáveis (`{{nome}}`, `{{empresa}}`) economiza horas/semana por vendedor.

**Custo:** 2-3 dias de dev
**Benefício:** produtividade + consistência

### O6. Power Dialer (Focus Mode já existe)
O `/focus` já é uma fila. Adicionar click-to-call (via Twilio, Zenvia) transforma em Power Dialer. Vendedor liga 60 contatos/dia em vez de 15.

**Custo:** 5-7 dias de dev + custo telefonia
**Benefício:** produtividade triplica em equipes de outbound

### O7. Assinatura digital de proposta (ClickSign, DocuSign)
Para o módulo PC. Hoje vendedor manda PDF por e-mail, perde rastro.

**Custo:** 3-5 dias de dev + custo ClickSign
**Benefício:** ciclo de venda mais rápido, rastreamento

### O8. Integração Omie/Bling (ERP nacional)
O módulo PC já existe. Sincronizar pedidos/cotações com ERP evita dupla digitação.

**Custo:** alto (2-3 semanas)
**Benefício:** alto valor para quem usa ERP

---

## 🎯 Decisões de mercado tomadas

### DM1. Foco em **feiras** é o diferencial competitivo
Descoberta: nenhum CRM brasileiro tem módulo de feira nativo, e as ferramentas internacionais de event lead capture são caras e não integradas.
**Ação:** continuar investindo pesado no módulo de eventos + quiz + offline, mesmo que outras features fiquem para trás.

### DM2. Não vamos cobrar por usuário
Como é sistema interno, não se aplica. Mas se um dia virar SaaS: modelo por organização (flat) é mais justo para equipes pequenas.

### DM3. Linguagem sempre em pt-BR
Decisão estratégica: não mexer com i18n agora. Mercado é Brasil first.

### DM4. Priorizar WhatsApp integrado antes de expandir outras features
Próximo grande investimento de roadmap: WhatsApp Business API. É o maior gap funcional vs concorrentes e usaremos diariamente.

---

## 🚨 Armadilhas comuns no mercado (evitar)

1. **CRMs viram ERPs inchados.** Tentação de adicionar todo tipo de módulo (estoque, financeiro, fiscal) e perder foco. **Regra:** se não serve a "captar e converter lead", é distração.
2. **Burnout de automação.** Vendedores odeiam quando o CRM cria 20 tarefas automáticas por dia. **Regra:** automação deve reduzir trabalho, não criar.
3. **UI complexa demais.** Salesforce virou piada por isso. **Regra:** se um vendedor novo não consegue mover um card no kanban em 5 minutos, a UI tá errada.
4. **IA que não agrega.** Chat IA que é só "pergunte o que você já sabe" é marketing. **Regra:** IA deve fazer o que humano não consegue (analisar 1000 contatos ao mesmo tempo).
5. **Mobile como afterthought.** Feira é mobile. Nós fomos desenhados mobile-first. Concorrentes B2B tratam mobile como versão reduzida — isso é nossa vantagem, não reduzir.

---

## 📚 Onde aprender mais (para quando precisar benchmarkar)

- **G2 Crowd** (g2.com): reviews reais de usuários de CRM
- **Capterra**: comparativos com filtros
- **Produto Deal** (site brasileiro): análises de CRM SMB
- **Pipedrive blog**: referência de UX e funil
- **HubSpot Academy**: benchmark de sales engagement
- **Reddit r/sales** e r/sales_operations: o que vendedores reclamam dos CRMs deles

---

## 📝 Template: análise de feature nova vs mercado

Quando for decidir fazer algo novo, responder:

1. **Qual concorrente já faz?** (lista)
2. **Como eles fazem?** (screenshots se possível)
3. **O que é esperado como mínimo?** (padrão de mercado)
4. **O que seria diferencial?** (onde podemos ser melhores)
5. **Qual a armadilha?** (o que deu errado pra quem já tentou)
6. **Recomendação:** sim/não e por quê (em 2 parágrafos)

Esse template é o que o comando `/mercado` vai usar.
