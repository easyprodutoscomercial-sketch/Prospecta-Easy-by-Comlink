// Leitor de e-mail salvo do Outlook (.eml) para a Conferencia de relatorios.
//
// Roda NO NAVEGADOR: o dono arrasta o arquivo e so o texto vai pro servidor.
// Assim a imagem da assinatura (o e-mail do Daniel tem 1 MB) nao estoura o
// limite de upload da Vercel e o e-mail bruto nunca e guardado.
//
// Sem import em tempo de execucao de proposito: o teste roda direto no Node
// (tests/conferencia.test.mjs) sem o apelido "@/".
//
// Os relatorios reais (05/10/2026) vem do Outlook em Windows-1252 ou
// iso-8859-1 com quoted-printable, assunto quebrado em varias linhas e
// "[cid:...]" no lugar da imagem da assinatura.

export interface EmailLido {
  deNome: string | null;
  deEmail: string | null;
  enviadoEm: string | null; // ISO
  assunto: string;
  texto: string;
}

// "binario" = string em que cada caractere e um byte (FileReader/latin1)
function bytes(binario: string): Uint8Array {
  const b = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) b[i] = binario.charCodeAt(i) & 255;
  return b;
}

function decodificar(b: Uint8Array, charset: string | null): string {
  const cs = (charset || 'utf-8').trim().toLowerCase().replace(/^"|"$/g, '');
  try {
    return new TextDecoder(cs).decode(b);
  } catch {
    return new TextDecoder('windows-1252').decode(b);
  }
}

function deQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function deBase64(s: string): string {
  const limpo = s.replace(/[^A-Za-z0-9+/=]/g, '');
  try {
    return atob(limpo);
  } catch {
    return '';
  }
}

// =?Windows-1252?Q?M=E1rio_S=E9rgio?=  ->  Mário Sérgio
export function decodificarCabecalho(valor: string): string {
  return valor
    .replace(/\?=\s+=\?/g, '?==?') // palavras codificadas seguidas: o espaco entre elas some
    .replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, cs, modo, txt) => {
      const bin = modo.toUpperCase() === 'B' ? deBase64(txt) : deQuotedPrintable(txt.replace(/_/g, ' '));
      return decodificar(bytes(bin), cs);
    })
    .replace(/\s+/g, ' ')
    .trim();
}

interface Parte {
  cabecalhos: Record<string, string>;
  corpo: string; // ainda binario e codificado
}

function separar(bruto: string): Parte {
  const m = bruto.match(/\r?\n\r?\n/);
  const fimCab = m && m.index !== undefined ? m.index : bruto.length;
  const cab = bruto.slice(0, fimCab).replace(/\r?\n[ \t]+/g, ' '); // desdobra linhas continuadas
  const cabecalhos: Record<string, string> = {};
  for (const linha of cab.split(/\r?\n/)) {
    const i = linha.indexOf(':');
    if (i <= 0) continue;
    const nome = linha.slice(0, i).trim().toLowerCase();
    if (!(nome in cabecalhos)) cabecalhos[nome] = linha.slice(i + 1).trim();
  }
  return { cabecalhos, corpo: m && m.index !== undefined ? bruto.slice(fimCab + m[0].length) : '' };
}

function parametro(valor: string | undefined, nome: string): string | null {
  if (!valor) return null;
  const m = valor.match(new RegExp(`${nome}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i'));
  return m ? (m[2] !== undefined ? m[2] : m[1]) : null;
}

// percorre as partes e devolve as de texto, ja decodificadas
function textos(parte: Parte, saida: { tipo: string; texto: string }[]) {
  const tipo = (parte.cabecalhos['content-type'] || 'text/plain').split(';')[0].trim().toLowerCase();
  if (tipo.startsWith('multipart/')) {
    const fronteira = parametro(parte.cabecalhos['content-type'], 'boundary');
    if (!fronteira) return;
    const pedacos = parte.corpo.split(`--${fronteira}`);
    for (const p of pedacos.slice(1)) {
      if (p.startsWith('--')) break; // fim do multipart
      textos(separar(p.replace(/^\r?\n/, '')), saida);
    }
    return;
  }
  if (tipo !== 'text/plain' && tipo !== 'text/html') return;
  const cte = (parte.cabecalhos['content-transfer-encoding'] || '').toLowerCase();
  const bin = cte === 'quoted-printable' ? deQuotedPrintable(parte.corpo) : cte === 'base64' ? deBase64(parte.corpo) : parte.corpo;
  saida.push({ tipo, texto: decodificar(bytes(bin), parametro(parte.cabecalhos['content-type'], 'charset')) });
}

export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n* ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function limparTexto(t: string): string {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/\[cid:[^\]]*\]/gi, '') // imagem da assinatura
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// bruto = conteudo do .eml lido como binario (cada caractere = 1 byte)
export function lerEml(bruto: string): EmailLido {
  const raiz = separar(bruto);
  const partes: { tipo: string; texto: string }[] = [];
  textos(raiz, partes);
  const plano = partes.find((p) => p.tipo === 'text/plain');
  const html = partes.find((p) => p.tipo === 'text/html');
  const texto = limparTexto(plano && plano.texto.trim() ? plano.texto : html ? htmlParaTexto(html.texto) : '');

  const de = decodificarCabecalho(raiz.cabecalhos['from'] || '');
  const email = de.match(/<([^>]+)>/) || de.match(/([^\s<>"]+@[^\s<>"]+)/);
  const nome = de.replace(/<[^>]*>/, '').replace(/"/g, '').trim();
  const data = raiz.cabecalhos['date'] ? new Date(raiz.cabecalhos['date']) : null;

  return {
    deNome: nome && !nome.includes('@') ? nome : null,
    deEmail: email ? email[1].trim().toLowerCase() : null,
    enviadoEm: data && !isNaN(data.getTime()) ? data.toISOString() : null,
    assunto: decodificarCabecalho(raiz.cabecalhos['subject'] || ''),
    texto,
  };
}

// Dia de que o relatorio fala (AAAA-MM-DD). O Mario mandou o de 05/10 na manha
// de 06/10, entao a data do envio so vale quando o texto nao diz o dia.
export function dataDoRelatorio(assunto: string, texto: string, enviadoEm: string | null): string | null {
  const envio = enviadoEm ? new Date(new Date(enviadoEm).getTime() - 3 * 36e5) : null; // horario de Sao Paulo
  const procurar = (s: string) => s.match(/\b(\d{1,2})[/_.-](\d{1,2})(?:[/_.-](\d{2,4}))?\b/);
  const m = procurar(assunto) || procurar(texto.slice(0, 400));
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      let ano = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : envio ? envio.getUTCFullYear() : new Date().getFullYear();
      // relatorio de 30/12 mandado em 02/01: e do ano anterior
      if (!m[3] && envio && mes > envio.getUTCMonth() + 2) ano -= 1;
      return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }
  return envio ? envio.toISOString().slice(0, 10) : null;
}
