import { buscarDadosReceita, cnpjValido, CnpjNaoEncontrado } from '@/lib/receita/cnpj';
import type { EmpresaIA } from '@/lib/indicacoes/ia';

// Regra do dono (06/10): so empresa de medio ou grande porte. A IA nao serve de juiz disso
// (na busca da Werk-Schott em 02/10 trouxe tornearia e assistencia tecnica), entao quem vem
// com CNPJ e conferido na Receita: Microempresa, Pequeno Porte, MEI ou empresa fechada sai.
// Sem CNPJ, ou com a Receita fora do ar, a empresa fica marcada "porte nao confirmado".
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function filtrarPorPorte(empresas: EmpresaIA[]) {
  const conferidas = await Promise.all(empresas.map(async (e): Promise<{ e: EmpresaIA; fora: string | null }> => {
    if (!e.cnpj || !cnpjValido(e.cnpj)) return { e: { ...e, porteConfirmado: false }, fora: null };
    try {
      const d = await Promise.race([
        buscarDadosReceita(e.cnpj),
        new Promise<null>((r) => setTimeout(() => r(null), 7000)),
      ]);
      if (!d) return { e: { ...e, porteConfirmado: false }, fora: null };
      const porte = semAcento(d.porte || '');
      if (d.mei || porte.includes('micro') || porte.includes('pequeno')) return { e, fora: `porte ${d.porte || 'MEI'}` };
      if (d.situacao && semAcento(d.situacao).trim() !== 'ativa') return { e, fora: `situação ${d.situacao}` };
      return {
        e: { ...e, porte: d.porte, porteConfirmado: !!d.porte, razao_social: e.razao_social || d.razao_social },
        fora: null,
      };
    } catch (err) {
      // CNPJ que nao existe na Receita: a IA errou ou inventou o numero; nao grava ele
      if (err instanceof CnpjNaoEncontrado) return { e: { ...e, cnpj: null, porteConfirmado: false }, fora: null };
      return { e: { ...e, porteConfirmado: false }, fora: null };
    }
  }));
  return {
    empresas: conferidas.filter((c) => !c.fora).map((c) => c.e),
    // a IA tenta devolver a mesma empresa na rodada seguinte sem o CNPJ: estes nomes vao pra lista de "nao repita"
    descartadas: conferidas.filter((c) => c.fora).map((c) => ({ nome: c.e.nome, motivo: c.fora as string })),
  };
}
