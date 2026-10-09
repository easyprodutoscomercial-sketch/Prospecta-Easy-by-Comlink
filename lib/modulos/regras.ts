// Modulos do sistema que o admin liga/desliga em Admin -> Modulos do sistema.
// Desligado = some do menu e dos atalhos, a pagina manda pro Dashboard e o link
// publico mostra "indisponivel". Nenhum dado e apagado: religou, volta tudo.
//
// Arquivo sem import de proposito: os testes (node --test) carregam ele direto.

export type ChaveModulo =
  | 'eventos' | 'quiz' | 'suporte' | 'pedidos' | 'associacoes' | 'bugs'
  | 'frentes' | 'foco' | 'automacoes' | 'captura' | 'ai' | 'relatorios';

export interface Modulo {
  chave: ChaveModulo;
  nome: string;
  descricao: string;
  /** Inicio dos enderecos do modulo (paginas logadas e publicas). */
  rotas: string[];
}

export const MODULOS: Modulo[] = [
  { chave: 'eventos', nome: 'Feiras', descricao: 'Mapa de stands, check-in com foto, visitantes avulsos.', rotas: ['/eventos', '/walkin-fill'] },
  { chave: 'quiz', nome: 'Quiz Feira', descricao: 'Quiz de palpite no estande e o link público do quiz.', rotas: ['/quiz-feira', '/quiz'] },
  { chave: 'suporte', nome: 'Suporte', descricao: 'Tickets de suporte e o portal público do cliente.', rotas: ['/suporte', '/portal'] },
  { chave: 'pedidos', nome: 'Pedidos & Cotações', descricao: 'Controle de pedidos, cotações e clientes de compra.', rotas: ['/pedidos-cotacoes'] },
  { chave: 'associacoes', nome: 'Associações', descricao: 'Associações ORPLANA e outras (a tabela não existe no banco hoje).', rotas: ['/associacoes'] },
  { chave: 'bugs', nome: 'Bugs', descricao: 'Registro interno de defeitos.', rotas: ['/bugs'] },
  { chave: 'frentes', nome: 'Frentes de trabalho', descricao: 'Frentes com sprints.', rotas: ['/work-fronts'] },
  { chave: 'foco', nome: 'Modo Foco', descricao: 'Fila de ligações em sequência.', rotas: ['/focus'] },
  { chave: 'automacoes', nome: 'Automações', descricao: 'Regras automáticas ao mover card de coluna.', rotas: ['/admin/automations'] },
  { chave: 'captura', nome: 'Links de captura', descricao: 'QR code / link público para o cliente se cadastrar sozinho.', rotas: ['/lead-capture'] },
  { chave: 'ai', nome: 'Assistente IA', descricao: 'Chat com IA (menu e botão redondo no Pipeline).', rotas: ['/chat'] },
  { chave: 'relatorios', nome: 'Relatórios', descricao: 'Tela de gráficos e relatórios.', rotas: ['/reports'] },
];

// Decisao do dono em 09/10/2026: tudo que nao tinha uso comeca desligado.
// Vale enquanto o admin nao salvar nada na tela; depois manda o que ele salvou.
export const DESLIGADOS_PADRAO: ChaveModulo[] = MODULOS.map((m) => m.chave);

const CHAVES = new Set<string>(MODULOS.map((m) => m.chave));

/** Limpa o que veio do banco/da tela: so chaves conhecidas, sem repetir. */
export function normalizarDesligados(valor: unknown): ChaveModulo[] {
  if (!Array.isArray(valor)) return [...DESLIGADOS_PADRAO];
  return [...new Set(valor.filter((v): v is ChaveModulo => typeof v === 'string' && CHAVES.has(v)))];
}

/** A que modulo pertence um endereco (ignora ?query). null = nao e de modulo desligavel. */
export function moduloDaRota(endereco: string): ChaveModulo | null {
  const caminho = endereco.split(/[?#]/)[0];
  for (const m of MODULOS) {
    if (m.rotas.some((r) => caminho === r || caminho.startsWith(r + '/'))) return m.chave;
  }
  return null;
}

export function rotaBloqueada(endereco: string, desligados: readonly string[]): boolean {
  const modulo = moduloDaRota(endereco);
  return modulo !== null && desligados.includes(modulo);
}
