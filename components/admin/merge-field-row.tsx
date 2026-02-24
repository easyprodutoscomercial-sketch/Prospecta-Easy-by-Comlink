'use client';

interface MergeFieldRowProps {
  field: string;
  label: string;
  valueA: any;
  valueB: any;
  selected: 'a' | 'b';
  onSelect: (choice: 'a' | 'b') => void;
}

function formatDisplayValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

export default function MergeFieldRow({
  field,
  label,
  valueA,
  valueB,
  selected,
  onSelect,
}: MergeFieldRowProps) {
  const displayA = formatDisplayValue(valueA);
  const displayB = formatDisplayValue(valueB);

  const isEmptyA = !displayA;
  const isEmptyB = !displayB;

  // Se ambos sao vazios, nao renderizar a row
  if (isEmptyA && isEmptyB) return null;

  return (
    <div className="grid grid-cols-[140px_1fr_1fr] gap-3 items-center py-2.5 border-b border-purple-800/15 last:border-b-0">
      {/* Label */}
      <div className="text-xs font-medium text-purple-300/70 truncate pr-2" title={label}>
        {label}
      </div>

      {/* Valor A */}
      <button
        type="button"
        onClick={() => !isEmptyA && onSelect('a')}
        disabled={isEmptyA}
        className={`relative p-2.5 rounded-lg text-left text-xs transition-all min-h-[40px] ${
          isEmptyA
            ? 'bg-purple-300/5 text-purple-300/30 cursor-not-allowed border border-purple-800/10'
            : selected === 'a'
              ? 'bg-emerald-500/10 border-2 border-emerald-500/50 text-neutral-200 shadow-sm shadow-emerald-500/10'
              : 'bg-[#2a1245] border border-purple-800/20 text-neutral-300 hover:border-purple-600/40 cursor-pointer'
        }`}
      >
        {/* Radio indicator */}
        <span
          className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
            isEmptyA
              ? 'border-purple-800/20'
              : selected === 'a'
                ? 'border-emerald-500'
                : 'border-purple-700/40'
          }`}
        >
          {!isEmptyA && selected === 'a' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </span>

        <span className={`block pr-5 break-words ${isEmptyA ? 'italic' : ''}`}>
          {isEmptyA ? 'Vazio' : displayA}
        </span>
      </button>

      {/* Valor B */}
      <button
        type="button"
        onClick={() => !isEmptyB && onSelect('b')}
        disabled={isEmptyB}
        className={`relative p-2.5 rounded-lg text-left text-xs transition-all min-h-[40px] ${
          isEmptyB
            ? 'bg-purple-300/5 text-purple-300/30 cursor-not-allowed border border-purple-800/10'
            : selected === 'b'
              ? 'bg-emerald-500/10 border-2 border-emerald-500/50 text-neutral-200 shadow-sm shadow-emerald-500/10'
              : 'bg-[#2a1245] border border-purple-800/20 text-neutral-300 hover:border-purple-600/40 cursor-pointer'
        }`}
      >
        {/* Radio indicator */}
        <span
          className={`absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
            isEmptyB
              ? 'border-purple-800/20'
              : selected === 'b'
                ? 'border-emerald-500'
                : 'border-purple-700/40'
          }`}
        >
          {!isEmptyB && selected === 'b' && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          )}
        </span>

        <span className={`block pr-5 break-words ${isEmptyB ? 'italic' : ''}`}>
          {isEmptyB ? 'Vazio' : displayB}
        </span>
      </button>
    </div>
  );
}
