'use client';

import { useState, useEffect } from 'react';

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    title: string;
    meeting_at: string;
    duration_minutes: number;
    location: string;
    notes: string;
  }) => void;
  contactName: string;
  loading?: boolean;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2 horas' },
];

export default function MeetingModal({
  isOpen,
  onClose,
  onConfirm,
  contactName,
  loading = false,
}: MeetingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Inicializar campos apenas quando o modal abre
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (isOpen && !initialized) {
      setTitle(`Reuniao com ${contactName}`);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(tomorrow.toISOString().split('T')[0]);
      setTime('10:00');
      setDuration(30);
      setLocation('');
      setNotes('');
      setInitialized(true);
    }
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen, contactName, initialized]);

  // Listener de teclado separado — nao reseta campos
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const canSubmit = title.trim() && date && time;

  function handleSubmit() {
    if (!canSubmit) return;
    const meeting_at = new Date(`${date}T${time}:00`).toISOString();
    onConfirm({
      title: title.trim(),
      meeting_at,
      duration_minutes: duration,
      location: location.trim(),
      notes: notes.trim(),
    });
  }

  const inputClass =
    'w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 rounded-lg text-neutral-100 placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e0f35] border border-purple-800/30 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-cyan-400">Agendar Reuniao</h3>
            <p className="text-sm text-purple-300/60">com {contactName}</p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3">
          {/* Assunto */}
          <div>
            <label className="block text-xs text-purple-300/50 mb-1">Assunto *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Apresentacao comercial"
              className={inputClass}
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-purple-300/50 mb-1">Data *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-purple-300/50 mb-1">Horario *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Duracao */}
          <div>
            <label className="block text-xs text-purple-300/50 mb-1">Duracao</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    duration === opt.value
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-[#2a1245] text-purple-200 border-purple-700/30 hover:bg-purple-800/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Local */}
          <div>
            <label className="block text-xs text-purple-300/50 mb-1">Local</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Sala 3, Google Meet, Escritorio..."
              className={inputClass}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs text-purple-300/50 mb-1">Notas</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pauta, preparacao, observacoes..."
              className={inputClass}
            />
          </div>
        </div>

        {/* Info about notifications */}
        <div className="mt-4 px-3 py-2 bg-cyan-500/5 border border-cyan-500/15 rounded-lg">
          <p className="text-[11px] text-cyan-300/70">
            <span className="font-semibold">Notificacoes automaticas:</span> voce sera lembrado 24h, 8h, 4h, 2h, 1h e 15min antes da reuniao.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-purple-700/30 rounded-lg text-purple-200 hover:bg-purple-800/20 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Agendando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Agendar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
