'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePipeline } from '@/lib/pipeline-context';
import { useToast } from '@/lib/toast-context';
import FocusContactCard from '@/components/focus/focus-contact-card';
import FocusActionBar from '@/components/focus/focus-action-bar';
import FocusCallScript from '@/components/focus/focus-call-script';
import FocusSessionStats from '@/components/focus/focus-session-stats';
import MeetingModal from '@/components/meetings/meeting-modal';

export default function FocusPage() {
  const toast = useToast();
  const { selectedPipelineId, currentPipeline } = usePipeline();
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, { name: string; avatar_url?: string | null }>>({});
  const [interactions, setInteractions] = useState<any[]>([]);
  const [script, setScript] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [sessionStart] = useState(() => new Date());
  const [contactsCalled, setContactsCalled] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [meetingsBooked, setMeetingsBooked] = useState(0);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingLoading, setMeetingLoading] = useState(false);

  const currentContact = queue[currentIndex] || null;

  const fetchQueue = useCallback(async () => {
    if (!selectedPipelineId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/focus/queue?pipeline_id=${selectedPipelineId}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data.contacts || []);
        setCurrentIndex(0);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [selectedPipelineId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, { name: string; avatar_url?: string | null }> = {};
        for (const u of data.users || []) {
          map[u.user_id] = { name: u.name, avatar_url: u.avatar_url || null };
        }
        setUserMap(map);
      }
    } catch { /* silent */ }
  }, []);

  const fetchInteractions = useCallback(async (contactId: string) => {
    try {
      const res = await fetch(`/api/interactions?contact_id=${contactId}&limit=3`);
      if (res.ok) {
        const data = await res.json();
        setInteractions(data.interactions || []);
      }
    } catch {
      setInteractions([]);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (currentContact) {
      fetchInteractions(currentContact.id);
      setScript(null);
    }
  }, [currentContact?.id, fetchInteractions]);

  const advanceToNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      toast.success('Fim da fila! Todos os contatos foram processados.');
    }
  };

  const handleAction = async (action: 'answered' | 'no_answer' | 'meeting' | 'not_interested' | 'skip') => {
    if (!currentContact) return;

    if (action === 'skip') {
      advanceToNext();
      return;
    }

    if (action === 'meeting') {
      setShowMeetingModal(true);
      return;
    }

    setActionLoading(true);
    setContactsCalled(prev => prev + 1);

    try {
      // Map action to interaction type/outcome
      const interactionMap: Record<string, { type: string; outcome: string }> = {
        answered: { type: 'LIGACAO', outcome: 'RESPONDEU' },
        no_answer: { type: 'LIGACAO', outcome: 'SEM_RESPOSTA' },
        not_interested: { type: 'LIGACAO', outcome: 'NAO_INTERESSADO' },
      };

      const { type, outcome } = interactionMap[action];

      // Create interaction
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: currentContact.id,
          type,
          outcome,
          note: `Registrado via Modo Foco`,
        }),
      });

      if (action === 'answered') {
        setAnsweredCount(prev => prev + 1);
      }

      if (action === 'not_interested') {
        // Find lost terminal stage and move contact
        const lostStage = currentPipeline?.stages.find(s => s.terminal_type === 'lost');
        if (lostStage) {
          await fetch(`/api/contacts/${currentContact.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage_id: lostStage.id, motivo_ganho_perdido: 'SEM_INTERESSE' }),
          });
        }
      }

      toast.success(action === 'answered' ? 'Atendeu!' : action === 'no_answer' ? 'Nao atendeu' : 'Nao interessado');
      advanceToNext();
    } catch {
      toast.error('Erro ao registrar acao');
    }
    setActionLoading(false);
  };

  const handleMeetingConfirm = async (data: { title: string; meeting_at: string; duration_minutes: number; location: string; notes: string; meeting_type: string }) => {
    if (!currentContact) return;
    setMeetingLoading(true);
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: currentContact.id, ...data }),
      });
      if (!res.ok) throw new Error();
      setMeetingsBooked(prev => prev + 1);
      setContactsCalled(prev => prev + 1);
      toast.success('Reuniao agendada!');
      setShowMeetingModal(false);
      advanceToNext();
    } catch {
      toast.error('Erro ao agendar reuniao');
    }
    setMeetingLoading(false);
  };

  const handleGenerateScript = async () => {
    if (!currentContact) return;
    setScriptLoading(true);
    try {
      const res = await fetch('/api/ai/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: currentContact.name,
          company: currentContact.company,
          temperatura: currentContact.temperatura,
          type: 'call_script',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScript(data.message || data.content || 'Script gerado com sucesso.');
      } else {
        toast.error('Erro ao gerar script');
      }
    } catch {
      toast.error('Erro ao gerar script');
    }
    setScriptLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-4" />
          <p className="text-sm text-purple-300/60">Carregando fila de contatos...</p>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <svg className="mx-auto w-16 h-16 text-purple-500/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <h2 className="text-lg font-bold text-white mb-2">Nenhum contato na fila</h2>
          <p className="text-sm text-purple-300/60">Nao ha contatos com telefone em estagios ativos neste pipeline.</p>
        </div>
      </div>
    );
  }

  const isFinished = currentIndex >= queue.length;

  if (isFinished) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <svg className="mx-auto w-16 h-16 text-emerald-500/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-bold text-emerald-400 mb-2">Sessao Concluida!</h2>
          <p className="text-sm text-purple-300/60 mb-4">Voce processou {contactsCalled} contatos nesta sessao.</p>
          <FocusSessionStats
            contactsCalled={contactsCalled}
            answeredCount={answeredCount}
            meetingsBooked={meetingsBooked}
            sessionStartTime={sessionStart}
          />
          <button
            onClick={() => { setCurrentIndex(0); setContactsCalled(0); setAnsweredCount(0); setMeetingsBooked(0); fetchQueue(); }}
            className="mt-6 px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 transition-colors"
          >
            Nova Sessao
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-10 lg:-my-10 min-h-screen flex flex-col pb-24">
      {/* Header */}
      <div className="bg-[#120826]/80 backdrop-blur-sm border-b border-purple-500/10 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Modo Foco</h1>
              <p className="text-[10px] text-purple-300/40">
                Contato {currentIndex + 1} de {queue.length}
              </p>
            </div>
          </div>
          <FocusSessionStats
            contactsCalled={contactsCalled}
            answeredCount={answeredCount}
            meetingsBooked={meetingsBooked}
            sessionStartTime={sessionStart}
          />
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-purple-800/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-orange-400 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main content: Contact + Script */}
      <div className="flex-1 px-4 lg:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contact Card — 2 columns */}
          <div className="lg:col-span-2">
            <FocusContactCard
              contact={currentContact}
              userMap={userMap}
              lastInteractions={interactions}
            />
          </div>

          {/* Call Script — 1 column */}
          <div>
            <FocusCallScript
              contactName={currentContact.name}
              company={currentContact.company}
              temperatura={currentContact.temperatura}
              script={script}
              loading={scriptLoading}
              onGenerate={handleGenerateScript}
            />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <FocusActionBar onAction={handleAction} loading={actionLoading} />

      {/* Meeting Modal */}
      {currentContact && (
        <MeetingModal
          isOpen={showMeetingModal}
          onClose={() => setShowMeetingModal(false)}
          onConfirm={handleMeetingConfirm}
          contactName={currentContact.name}
          loading={meetingLoading}
        />
      )}
    </div>
  );
}
