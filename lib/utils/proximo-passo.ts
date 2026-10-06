// Proximo passo obrigatorio (regra do dono em 06/10).
// Na conferencia dos e-mails, o Mario tinha 12 empresas e NENHUMA com proxima acao no CRM:
// os 11 proximos passos ficaram so no e-mail, e a cobranca automatica (que depende da data)
// nao tinha o que cobrar. Agora toda atividade que nao encerra o negocio exige o "o que" e o
// "quando" — a menos que o contato ja tenha um proximo passo marcado no futuro.

export const TIPOS_PROXIMO_PASSO = [
  'LIGAR', 'ENVIAR_WHATSAPP', 'ENVIAR_EMAIL', 'ENVIAR_PROPOSTA', 'REUNIAO', 'VISITA', 'FOLLOW_UP', 'OUTRO',
] as const;
export type TipoProximoPasso = (typeof TIPOS_PROXIMO_PASSO)[number];

// resultados que encerram o negocio: nao ha proximo passo a cobrar
export const RESULTADOS_FINAIS = new Set(['CONVERTIDO', 'PROPOSTA_ACEITA', 'FECHADO_PARCIAL', 'NAO_INTERESSADO']);

export const exigeProximoPasso = (outcome: string) => !RESULTADOS_FINAIS.has(outcome);

// proximo dia util as 9h de Sao Paulo (UTC-3, sem horario de verao desde 2019)
export function proximoDiaUtilAs9(dias = 1) {
  const sp = new Date(Date.now() - 3 * 36e5);
  const d = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + dias, 12));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export const CODIGO_PROXIMO_PASSO = 'PROXIMO_PASSO_OBRIGATORIO';
