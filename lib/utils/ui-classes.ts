/**
 * Classes Tailwind compartilhadas pra padronizar UI entre as telas.
 *
 * Antes cada tela tinha sua propria declaracao local de `selectCls`,
 * `inputClass`, etc — 3 backgrounds diferentes pro mesmo input, 2 tamanhos
 * pro mesmo botao. Auditoria do agente design-system flaggou isso.
 *
 * Use:
 *   import { selectBase, inputBase, btnPrimary } from '@/lib/utils/ui-classes';
 *   <select className={selectBase}>...</select>
 *
 * Pra customizar pontualmente, concatene:
 *   <input className={`${inputBase} pl-9`} />
 */

// === BOTOES ===

/** Botao primario — acao principal da tela (Novo Contato, Salvar, Aplicar). */
export const btnPrimary =
  'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold ' +
  'text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 ' +
  'transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed';

/** Botao secundario — acoes auxiliares (Exportar, Cancelar). */
export const btnSecondary =
  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium ' +
  'text-neutral-300 bg-[#2a1245] border border-purple-700/30 rounded-lg ' +
  'hover:bg-purple-800/30 hover:text-white transition-all';

/** Botao perigo (Deletar, Descartar, Limpar filtros). */
export const btnDanger =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ' +
  'bg-red-500/10 text-red-400 border border-red-500/20 ' +
  'hover:bg-red-500/20 hover:border-red-500/30 transition-all';

// === INPUTS ===

/** Input base — mesmo bg/border/focus em toda a app. */
export const inputBase =
  'w-full px-3 py-2 text-sm border border-purple-700/30 rounded-lg ' +
  'bg-[#2a1245] text-neutral-200 placeholder-neutral-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500';

/** Input com icone esquerdo (search). Combine com `relative` no wrapper. */
export const inputWithIcon = `${inputBase} pl-9`;

/** Select — mesma cara do input (sem padding extra de icone). */
export const selectBase =
  'px-2 py-2 text-sm border border-purple-700/30 rounded-lg ' +
  'bg-[#2a1245] text-neutral-200 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500';

// === CONTAINERS ===

/** Card / painel padrao. */
export const cardBase = 'bg-[#1e0f35] rounded-xl border border-purple-800/30';

/** Card com hover state (lista interativa). */
export const cardHover = `${cardBase} card-hover transition-all hover:border-purple-600/40`;

// === LABELS DE CAMPO ===

/** Label pequeno acima do valor (Empresa, Email, etc) — antes era emerald/purple aleatorio. */
export const fieldLabel = 'text-purple-300/60 text-[10px] font-semibold uppercase tracking-wider';
