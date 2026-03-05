'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { PC_COTACAO_RESPOSTA_LABELS } from '@/lib/utils/labels';
import { PcCotacaoResposta } from '@/lib/types';

interface SpreadsheetRow {
  cotacao_numero: string;
  cotacao_nome: string;
  fornecedor: string;
  cnpj: string;
  informe: string;
  resposta: PcCotacaoResposta;
}

const EMPTY_ROW: SpreadsheetRow = {
  cotacao_numero: '',
  cotacao_nome: '',
  fornecedor: '',
  cnpj: '',
  informe: '',
  resposta: 'NAO_RESPONDEU',
};

const COLUMNS = [
  { key: 'cotacao_numero' as const, label: 'Nº Cotação', width: 'w-28', required: true },
  { key: 'cotacao_nome' as const, label: 'Nome Cotação', width: 'w-44' },
  { key: 'fornecedor' as const, label: 'Fornecedor', width: 'w-48', required: true },
  { key: 'cnpj' as const, label: 'CNPJ', width: 'w-40' },
  { key: 'informe' as const, label: 'Informe', width: 'w-52' },
  { key: 'resposta' as const, label: 'Resposta', width: 'w-36', type: 'select' as const },
];

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function PcCotacoesSpreadsheet({ onClose, onSaved }: Props) {
  const [rows, setRows] = useState<SpreadsheetRow[]>(
    Array.from({ length: 10 }, () => ({ ...EMPTY_ROW }))
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const updateCell = (rowIdx: number, key: keyof SpreadsheetRow, value: string) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [key]: value };
      return updated;
    });
  };

  const addRows = (count: number) => {
    setRows(prev => [...prev, ...Array.from({ length: count }, () => ({ ...EMPTY_ROW }))]);
  };

  const removeRow = (idx: number) => {
    setRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, rowIdx: number, colIdx: number) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (colIdx === COLUMNS.length - 1) {
        // Last column - go to first column of next row
        if (rowIdx === rows.length - 1) {
          addRows(1);
        }
        e.preventDefault();
        setTimeout(() => {
          setActiveCell({ row: rowIdx + 1, col: 0 });
        }, 0);
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      if (colIdx === 0 && rowIdx > 0) {
        e.preventDefault();
        setActiveCell({ row: rowIdx - 1, col: COLUMNS.length - 1 });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        addRows(1);
      }
      setTimeout(() => {
        setActiveCell({ row: rowIdx + 1, col: colIdx });
      }, 0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < rows.length - 1) {
        setActiveCell({ row: rowIdx + 1, col: colIdx });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        setActiveCell({ row: rowIdx - 1, col: colIdx });
      }
    }
  };

  // Focus active cell
  useEffect(() => {
    if (activeCell && tableRef.current) {
      const input = tableRef.current.querySelector(
        `[data-row="${activeCell.row}"][data-col="${activeCell.col}"]`
      ) as HTMLInputElement | HTMLSelectElement;
      if (input) {
        input.focus();
        if (input instanceof HTMLInputElement) {
          input.select();
        }
      }
    }
  }, [activeCell]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text');
    if (!text || !activeCell) return;

    const pastedRows = text.split('\n').filter(line => line.trim());
    if (pastedRows.length <= 1 && !text.includes('\t')) return; // Single cell paste, let default handle

    e.preventDefault();

    setRows(prev => {
      const updated = [...prev];
      const neededRows = activeCell.row + pastedRows.length;
      while (updated.length < neededRows) {
        updated.push({ ...EMPTY_ROW });
      }

      pastedRows.forEach((pastedRow, rIdx) => {
        const cells = pastedRow.split('\t');
        cells.forEach((cell, cIdx) => {
          const targetCol = activeCell.col + cIdx;
          if (targetCol < COLUMNS.length) {
            const colKey = COLUMNS[targetCol].key;
            const targetRowIdx = activeCell.row + rIdx;
            if (colKey === 'resposta') {
              const val = cell.trim().toUpperCase();
              updated[targetRowIdx] = {
                ...updated[targetRowIdx],
                [colKey]: val === 'RESPONDEU' ? 'RESPONDEU' : 'NAO_RESPONDEU',
              };
            } else {
              updated[targetRowIdx] = {
                ...updated[targetRowIdx],
                [colKey]: cell.trim(),
              };
            }
          }
        });
      });

      return updated;
    });
  }, [activeCell]);

  useEffect(() => {
    const el = tableRef.current;
    if (el) {
      el.addEventListener('paste', handlePaste as EventListener);
      return () => el.removeEventListener('paste', handlePaste as EventListener);
    }
  }, [handlePaste]);

  const handleSave = async () => {
    const validRows = rows.filter(r => r.cotacao_numero.trim() && r.fornecedor.trim());
    if (validRows.length === 0) {
      setErrors(['Preencha pelo menos uma linha com Nº Cotação e Fornecedor']);
      return;
    }

    setSaving(true);
    setErrors([]);
    setSavedCount(0);
    const newErrors: string[] = [];
    let count = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const res = await fetch('/api/pedidos-cotacoes/cotacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cotacao_numero: row.cotacao_numero.trim(),
            cotacao_nome: row.cotacao_nome.trim() || null,
            fornecedor: row.fornecedor.trim(),
            cnpj: row.cnpj.trim() || null,
            informe: row.informe.trim() || null,
            resposta: row.resposta,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          newErrors.push(`Linha ${i + 1}: ${data.error || 'Erro ao salvar'}`);
        } else {
          count++;
          setSavedCount(count);
        }
      } catch {
        newErrors.push(`Linha ${i + 1}: Erro de conexão`);
      }
    }

    setSaving(false);
    setErrors(newErrors);

    if (newErrors.length === 0) {
      onSaved();
    }
  };

  const filledCount = rows.filter(r => r.cotacao_numero.trim() && r.fornecedor.trim()).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </button>
          <span className="text-neutral-600">|</span>
          <span className="text-sm text-neutral-400">
            {filledCount} linha{filledCount !== 1 ? 's' : ''} preenchida{filledCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => addRows(5)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-300 hover:text-white border border-purple-800/30 rounded-lg hover:border-purple-600/50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            +5 Linhas
          </button>
          <button
            onClick={handleSave}
            disabled={saving || filledCount === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Salvando ({savedCount}/{filledCount})...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Salvar Tudo ({filledCount})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm font-medium mb-1">Erros ao salvar:</p>
          {errors.map((err, i) => (
            <p key={i} className="text-red-300 text-xs">{err}</p>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
        <p className="text-emerald-400/80 text-xs">
          Dica: Use Tab para navegar entre celulas, Enter para proxima linha, ou cole dados do Excel (Ctrl+V).
        </p>
      </div>

      {/* Spreadsheet Table */}
      <div ref={tableRef} className="overflow-x-auto border border-purple-800/30 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#2a1245]">
              <th className="w-10 px-2 py-2.5 text-center text-neutral-500 text-xs font-medium border-r border-purple-800/30">#</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${col.width} px-2 py-2.5 text-left text-neutral-300 text-xs font-medium border-r border-purple-800/30 last:border-r-0`}
                >
                  {col.label}
                  {col.required && <span className="text-red-400 ml-0.5">*</span>}
                </th>
              ))}
              <th className="w-10 px-2 py-2.5 border-l border-purple-800/30" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-t border-purple-800/20 hover:bg-purple-800/5 group"
              >
                <td className="px-2 py-0.5 text-center text-neutral-600 text-xs border-r border-purple-800/20 bg-[#1a0b30]">
                  {rowIdx + 1}
                </td>
                {COLUMNS.map((col, colIdx) => (
                  <td
                    key={col.key}
                    className={`px-0 py-0 border-r border-purple-800/20 last:border-r-0 ${
                      activeCell?.row === rowIdx && activeCell?.col === colIdx
                        ? 'ring-2 ring-emerald-500/50 ring-inset'
                        : ''
                    }`}
                  >
                    {col.type === 'select' ? (
                      <select
                        data-row={rowIdx}
                        data-col={colIdx}
                        value={row[col.key]}
                        onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                        onFocus={() => setActiveCell({ row: rowIdx, col: colIdx })}
                        onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                        className="w-full px-2 py-1.5 bg-transparent text-white text-sm focus:outline-none cursor-pointer"
                      >
                        <option value="NAO_RESPONDEU" className="bg-[#1e0f35]">
                          {PC_COTACAO_RESPOSTA_LABELS['NAO_RESPONDEU']}
                        </option>
                        <option value="RESPONDEU" className="bg-[#1e0f35]">
                          {PC_COTACAO_RESPOSTA_LABELS['RESPONDEU']}
                        </option>
                      </select>
                    ) : (
                      <input
                        data-row={rowIdx}
                        data-col={colIdx}
                        type="text"
                        value={row[col.key]}
                        onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                        onFocus={() => setActiveCell({ row: rowIdx, col: colIdx })}
                        onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                        placeholder={col.required ? 'Obrigatório' : ''}
                        className={`w-full px-2 py-1.5 bg-transparent text-white text-sm focus:outline-none placeholder:text-neutral-700 ${
                          col.required && !row[col.key].trim() ? 'placeholder:text-red-900/50' : ''
                        }`}
                      />
                    )}
                  </td>
                ))}
                <td className="px-1 py-0.5 border-l border-purple-800/20">
                  <button
                    onClick={() => removeRow(rowIdx)}
                    className="p-1 text-neutral-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remover linha"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add rows footer */}
      <div className="flex items-center gap-2 justify-center">
        <button
          onClick={() => addRows(1)}
          className="text-xs text-neutral-500 hover:text-emerald-400"
        >
          +1 linha
        </button>
        <span className="text-neutral-700">|</span>
        <button
          onClick={() => addRows(5)}
          className="text-xs text-neutral-500 hover:text-emerald-400"
        >
          +5 linhas
        </button>
        <span className="text-neutral-700">|</span>
        <button
          onClick={() => addRows(10)}
          className="text-xs text-neutral-500 hover:text-emerald-400"
        >
          +10 linhas
        </button>
        <span className="text-neutral-700">|</span>
        <button
          onClick={() => addRows(20)}
          className="text-xs text-neutral-500 hover:text-emerald-400"
        >
          +20 linhas
        </button>
      </div>
    </div>
  );
}
