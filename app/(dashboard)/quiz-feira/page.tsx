'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'dashboard' | 'participantes' | 'configuracoes';

interface DiaConfig {
  dia: number;
  valor_exato: number;
  descricao?: string;
  telefone_vip?: string;
}

interface QuizConfig {
  id: string;
  quiz_ativo: boolean;
  valor_exato: number;
  nome_evento: string;
  descricao_desafio: string;
  mensagem_pausa: string;
  token_publico: string;
  pipeline_id: string | null;
  event_id: string | null;
  crm_tag: string;
  crm_ativo: boolean;
  telefone_vip: string | null;
  data_inicio: string | null;
  dias_feira: number;
  dias_config: DiaConfig[];
  sorteio_unico: boolean;
}

interface Pipeline {
  id: string;
  name: string;
}

interface EventOption {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  pipeline_id: string | null;
}

interface Participante {
  id: string;
  nome: string;
  empresa: string;
  telefone: string;
  palpite: number;
  evento_nome: string;
  created_at: string;
  dia_feira: number | null;
}

interface Stats {
  total: number;
  hoje: number;
  media_palpite: number;
  menor_palpite: number;
  maior_palpite: number;
  chart_data: { hora: string; participantes: number }[];
  ultimos: Participante[];
}

interface VencedorData {
  vencedor: (Participante & { diferenca: number }) | null;
  valor_exato: number;
  total_participantes: number;
  ranking: (Participante & { diferenca: number })[];
}

export default function QuizFeiraPage() {
  // List vs detail view
  const [quizzes, setQuizzes] = useState<(QuizConfig & { total_participantes: number })[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState(false);
  const [showDeleteQuizModal, setShowDeleteQuizModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<{ id: string; name: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('user');

  // Detail view state
  const [tab, setTab] = useState<Tab>('configuracoes');
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [totalParticipantes, setTotalParticipantes] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVencedor, setShowVencedor] = useState(false);
  const [vencedorData, setVencedorData] = useState<VencedorData | null>(null);
  const [loadingVencedor, setLoadingVencedor] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [saveMsg, setSaveMsg] = useState('');
  const [togglingAtivo, setTogglingAtivo] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');
  const [diaSelecionado, setDiaSelecionado] = useState<string>('todos');

  // Form state for config
  const [formConfig, setFormConfig] = useState<Partial<QuizConfig>>({});

  // Fetch list of quizzes
  const fetchQuizzes = useCallback(async () => {
    try {
      const res = await fetch('/api/quiz/config');
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.quizzes || []);
        setPipelines(data.pipelines || []);
        setEvents(data.events || []);
        setUserRole(data.quizzes?.[0]?._role || 'user');
      }
    } catch { /* silent */ }
  }, []);

  // Fetch user role
  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.role) setUserRole(data.role);
      else if (data?.profile?.role) setUserRole(data.profile.role);
    }).catch(() => {});
  }, []);

  // Fetch single quiz config for editing
  const fetchConfig = useCallback(async (quizId?: string) => {
    const id = quizId || selectedQuizId;
    if (!id) return;
    try {
      const res = await fetch(`/api/quiz/config?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setPipelines(data.pipelines || []);
        setEvents(data.events || []);
        setFormConfig(data.config);
      }
    } catch { /* silent */ }
  }, [selectedQuizId]);

  const fetchStats = useCallback(async () => {
    if (!selectedQuizId) return;
    try {
      const params = new URLSearchParams({ quiz_id: selectedQuizId });
      if (diaSelecionado !== 'todos') params.set('dia', diaSelecionado);
      const res = await fetch(`/api/quiz/stats?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* silent */ }
  }, [diaSelecionado, selectedQuizId]);

  const fetchParticipantes = useCallback(async () => {
    if (!selectedQuizId) return;
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50', quiz_id: selectedQuizId });
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (diaSelecionado !== 'todos') params.set('dia', diaSelecionado);

      const res = await fetch(`/api/quiz/participantes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setParticipantes(data.participantes || []);
        setTotalParticipantes(data.total || 0);
      }
    } catch { /* silent */ }
  }, [page, search, dateFrom, dateTo, diaSelecionado, selectedQuizId]);

  // Initial load — quiz list
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchQuizzes();
      setLoading(false);
    };
    init();
  }, [fetchQuizzes]);

  // When a quiz is selected, load its config + stats
  useEffect(() => {
    if (selectedQuizId) {
      fetchConfig();
      fetchStats();
    }
  }, [selectedQuizId, fetchConfig, fetchStats]);

  useEffect(() => {
    if (tab === 'participantes') {
      fetchParticipantes();
    }
  }, [tab, fetchParticipantes]);

  // Refetch stats when day selection changes
  useEffect(() => {
    if (tab === 'dashboard') fetchStats();
  }, [diaSelecionado, tab, fetchStats]);

  // Auto-refresh stats every 30s on dashboard tab
  useEffect(() => {
    if (tab !== 'dashboard') return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [tab, fetchStats]);

  const handleCreateQuiz = async () => {
    setCreatingQuiz(true);
    try {
      const res = await fetch('/api/quiz/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_evento: 'Novo Quiz' }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchQuizzes();
        setSelectedQuizId(data.config.id);
        setTab('configuracoes');
      }
    } catch { /* silent */ }
    setCreatingQuiz(false);
  };

  const handleDeleteQuiz = async () => {
    const idToDelete = quizToDelete?.id || selectedQuizId;
    if (!idToDelete) return;
    setDeletingQuiz(true);
    try {
      const res = await fetch(`/api/quiz/config/${idToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setShowDeleteQuizModal(false);
        setQuizToDelete(null);
        if (selectedQuizId === idToDelete) {
          setSelectedQuizId(null);
          setConfig(null);
        }
        await fetchQuizzes();
      }
    } catch { /* silent */ }
    setDeletingQuiz(false);
  };

  const handleDuplicateQuiz = async (sourceQuiz: QuizConfig & { total_participantes: number }) => {
    try {
      const res = await fetch('/api/quiz/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_evento: `${sourceQuiz.nome_evento || 'Quiz'} (cópia)`,
          event_id: sourceQuiz.event_id,
          valor_exato: sourceQuiz.valor_exato,
          descricao_desafio: sourceQuiz.descricao_desafio,
          mensagem_pausa: sourceQuiz.mensagem_pausa,
          pipeline_id: sourceQuiz.pipeline_id,
          crm_tag: sourceQuiz.crm_tag,
          telefone_vip: sourceQuiz.telefone_vip,
          data_inicio: sourceQuiz.data_inicio,
          dias_feira: sourceQuiz.dias_feira,
          dias_config: sourceQuiz.dias_config,
        }),
      });
      if (res.ok) {
        await fetchQuizzes();
      }
    } catch { /* silent */ }
  };

  const handleToggleAtivo = async () => {
    if (!selectedQuizId) return;
    const newValue = !config?.quiz_ativo;
    setTogglingAtivo(true);
    try {
      const res = await fetch('/api/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedQuizId, quiz_ativo: newValue }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setFormConfig(data.config);
      }
    } catch { /* silent */ }
    setTogglingAtivo(false);
  };

  const handleSaveConfig = async () => {
    if (!selectedQuizId) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formConfig, id: selectedQuizId }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setFormConfig(data.config);
        setSaveMsg('Configurações salvas!');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleExportCSV = async () => {
    const params = selectedQuizId ? `?quiz_id=${selectedQuizId}` : '';
    const res = await fetch(`/api/quiz/participantes/export${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-participantes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleRevealVencedor = async () => {
    setLoadingVencedor(true);
    try {
      const params = new URLSearchParams();
      if (selectedQuizId) params.set('quiz_id', selectedQuizId);
      if (diaSelecionado !== 'todos') params.set('dia', diaSelecionado);
      const res = await fetch(`/api/quiz/participantes/vencedor?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVencedorData(data);
        setShowVencedor(true);
      }
    } catch { /* silent */ }
    setLoadingVencedor(false);
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const params = new URLSearchParams();
      if (selectedQuizId) params.set('quiz_id', selectedQuizId);
      if (diaSelecionado !== 'todos') params.set('dia', diaSelecionado);
      const res = await fetch(`/api/quiz/participantes?${params}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setShowDeleteModal(false);
        setDeleteMsg(`${data.deleted} participante(s) removido(s)!`);
        setTimeout(() => setDeleteMsg(''), 4000);
        setParticipantes([]);
        setTotalParticipantes(0);
        setPage(1);
        fetchStats();
      }
    } catch { /* silent */ }
    setDeleting(false);
  };

  const copyPublicLink = () => {
    if (!config?.token_publico) return;
    const url = `${window.location.origin}/quiz/${config.token_publico}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!config?.token_publico || typeof window === 'undefined') {
        setQrDataUrl('');
        return;
      }
      const url = `${window.location.origin}/quiz/${config.token_publico}`;
      try {
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(url, {
          width: 512,
          margin: 2,
          color: { dark: '#120826', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl('');
      }
    };
    run();
    return () => { cancelled = true; };
  }, [config?.token_publico]);

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `quiz-${config?.token_publico || 'link'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── LIST VIEW (no quiz selected) ──
  if (!selectedQuizId) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-emerald-400">Quiz Feira</h1>
          <button
            onClick={handleCreateQuiz}
            disabled={creatingQuiz}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            {creatingQuiz ? 'Criando...' : '+ Novo Quiz'}
          </button>
        </div>

        {quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-purple-700/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            <p className="text-lg text-white font-medium mb-1">Nenhum quiz criado</p>
            <p className="text-sm text-purple-300/50 mb-6">Crie um quiz para usar nas suas feiras</p>
            <button
              onClick={handleCreateQuiz}
              disabled={creatingQuiz}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              {creatingQuiz ? 'Criando...' : 'Criar primeiro quiz'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizzes.map((q) => {
              const linkedEvent = events.find(e => e.id === q.event_id);
              const quizName = q.nome_evento || linkedEvent?.name || 'Quiz sem nome';
              return (
                <div
                  key={q.id}
                  className="bg-[#1e0f35] rounded-xl border border-purple-700/30 hover:border-emerald-500/30 transition-colors group overflow-hidden"
                >
                  {/* Clickable area — opens detail */}
                  <div
                    onClick={() => { setSelectedQuizId(q.id); setTab('configuracoes'); }}
                    className="p-5 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors truncate pr-2">
                        {quizName}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${q.quiz_ativo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {q.quiz_ativo ? 'ATIVO' : 'PAUSADO'}
                      </span>
                    </div>

                    {linkedEvent && (
                      <p className="text-xs text-purple-300/40 mb-2 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        {linkedEvent.name}
                        {linkedEvent.start_date && (
                          <> — {new Date(linkedEvent.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</>
                        )}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-purple-300/50">
                      <span>{q.total_participantes} participante{q.total_participantes !== 1 ? 's' : ''}</span>
                      {q.valor_exato > 0 && <span>Valor: {q.valor_exato}</span>}
                      {(q.dias_feira || 1) > 1 && <span>{q.dias_feira} dias</span>}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="px-5 py-2.5 border-t border-purple-700/15 flex justify-between">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicateQuiz(q); }}
                      className="text-xs text-purple-300/40 hover:text-purple-200 hover:bg-purple-500/10 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
                      Duplicar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuizToDelete({ id: q.id, name: quizName });
                        setShowDeleteQuizModal(true);
                      }}
                      className="text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Quiz Modal (list view) */}
        {showDeleteQuizModal && quizToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!deletingQuiz) { setShowDeleteQuizModal(false); setQuizToDelete(null); } }}>
            <div className="bg-[#1e0f35] rounded-2xl p-8 max-w-md w-full mx-4 border border-purple-700/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-red-400 mb-2">Excluir Quiz</h2>
              <p className="text-sm text-purple-200/70 mb-2">
                Tem certeza que deseja excluir <span className="text-white font-bold">{quizToDelete.name}</span>?
              </p>
              <p className="text-xs text-purple-300/50 mb-6">
                Todos os participantes deste quiz serão removidos. Os contatos no CRM serão mantidos.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteQuizModal(false); setQuizToDelete(null); }}
                  disabled={deletingQuiz}
                  className="flex-1 px-4 py-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteQuiz}
                  disabled={deletingQuiz}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {deletingQuiz ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW (quiz selected) ──
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedQuizId(null); setConfig(null); fetchQuizzes(); }}
            className="p-1.5 rounded-lg hover:bg-purple-700/20 text-purple-300/50 hover:text-white transition-colors"
            title="Voltar para lista"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
          <h1 className="text-2xl font-semibold text-emerald-400">
            {config?.nome_evento || 'Quiz'}
          </h1>
          {config && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.quiz_ativo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {config.quiz_ativo ? 'ATIVO' : 'PAUSADO'}
            </span>
          )}
        </div>
        {(
          <button
            onClick={() => setShowDeleteQuizModal(true)}
            className="px-4 py-2 text-sm text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Excluir quiz
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#1e0f35] p-1 rounded-lg w-fit">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'participantes', label: 'Participantes' },
          { key: 'configuracoes', label: 'Configurações' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-purple-300/60 hover:text-purple-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Day selector (shown on dashboard and participantes tabs when multi-day is configured) */}
      {config && config.dias_feira > 1 && (tab === 'dashboard' || tab === 'participantes') && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-purple-300/50">Dia:</span>
          <div className="flex gap-1 bg-[#1e0f35] p-1 rounded-lg">
            <button
              onClick={() => { setDiaSelecionado('todos'); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${diaSelecionado === 'todos' ? 'bg-emerald-500/20 text-emerald-400' : 'text-purple-300/60 hover:text-purple-200'}`}
            >
              Todos
            </button>
            {Array.from({ length: config.dias_feira }, (_, i) => i + 1).map((dia) => (
              <button
                key={dia}
                onClick={() => { setDiaSelecionado(String(dia)); setPage(1); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${diaSelecionado === String(dia) ? 'bg-emerald-500/20 text-emerald-400' : 'text-purple-300/60 hover:text-purple-200'}`}
              >
                Dia {dia}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Tab */}
      {tab === 'dashboard' && !stats && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-12 h-12 text-purple-700/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          <p className="text-sm text-white font-medium mb-1">Nenhum participante ainda</p>
          <p className="text-xs text-purple-300/40">Quando alguém participar do quiz, os dados aparecem aqui.</p>
        </div>
      )}
      {tab === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Participantes" value={stats.total} />
            <StatCard title="Hoje" value={stats.hoje} />
            <StatCard title="Média Palpite" value={stats.media_palpite} />
            <StatCard title="Faixa" value={`${stats.menor_palpite} - ${stats.maior_palpite}`} />
          </div>

          {/* Chart */}
          {stats.chart_data.length > 0 && (
            <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30">
              <h3 className="text-sm font-medium text-purple-300/60 mb-4">Participações por Hora (últimas 24h)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d1b4e" />
                    <XAxis dataKey="hora" stroke="#a78bfa" fontSize={12} />
                    <YAxis stroke="#a78bfa" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e0f35', border: '1px solid #4c1d95', borderRadius: '8px', color: '#e2e8f0' }}
                    />
                    <Bar dataKey="participantes" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent participants */}
          <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30">
            <h3 className="text-sm font-medium text-purple-300/60 mb-4">Últimos Participantes</h3>
            {stats.ultimos.length === 0 ? (
              <p className="text-purple-300/40 text-sm">Nenhum participante ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-purple-300/50 text-left">
                      <th className="pb-3 font-medium">Nome</th>
                      <th className="pb-3 font-medium">Empresa</th>
                      <th className="pb-3 font-medium">Palpite</th>
                      <th className="pb-3 font-medium">Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.ultimos.map((p) => (
                      <tr key={p.id} className="border-t border-purple-700/20">
                        <td className="py-2.5 text-white">{p.nome}</td>
                        <td className="py-2.5 text-purple-200/70">{p.empresa}</td>
                        <td className="py-2.5 text-emerald-400 font-mono font-bold">{p.palpite}</td>
                        <td className="py-2.5 text-purple-300/50">{formatDate(p.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Participantes Tab */}
      {tab === 'participantes' && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-purple-300/50 mb-1">Buscar</label>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Nome, empresa ou telefone..."
                className="bg-[#1e0f35] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-300/30 focus:outline-none focus:border-emerald-500/50 w-64"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-300/50 mb-1">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="bg-[#1e0f35] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-purple-300/50 mb-1">Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="bg-[#1e0f35] border border-purple-700/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-sm font-medium transition-colors"
            >
              Exportar CSV
            </button>
            <button
              onClick={handleRevealVencedor}
              disabled={loadingVencedor}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-50"
            >
              {loadingVencedor ? 'Calculando...' : 'Revelar Vencedor'}
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={totalParticipantes === 0}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-30"
            >
              Limpar Todos
            </button>
          </div>

          {/* Delete success message */}
          {deleteMsg && (
            <p className="text-sm text-emerald-400">{deleteMsg}</p>
          )}

          {/* Results count */}
          <p className="text-xs text-purple-300/40">{totalParticipantes} participante(s) encontrado(s)</p>

          {/* Table */}
          <div className="bg-[#1e0f35] rounded-xl border border-purple-700/30 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-purple-300/50 text-left border-b border-purple-700/30">
                  <th className="p-4 font-medium">Nome</th>
                  <th className="p-4 font-medium">Empresa</th>
                  <th className="p-4 font-medium">Telefone</th>
                  <th className="p-4 font-medium">Palpite</th>
                  {config && config.dias_feira > 1 && <th className="p-4 font-medium">Dia</th>}
                  <th className="p-4 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {participantes.length === 0 ? (
                  <tr>
                    <td colSpan={config && config.dias_feira > 1 ? 6 : 5} className="p-8 text-center text-purple-300/40">Nenhum participante encontrado.</td>
                  </tr>
                ) : (
                  participantes.map((p) => (
                    <tr key={p.id} className="border-t border-purple-700/20 hover:bg-purple-500/5">
                      <td className="p-4 text-white">{p.nome}</td>
                      <td className="p-4 text-purple-200/70">{p.empresa}</td>
                      <td className="p-4 text-purple-200/70 font-mono">{p.telefone}</td>
                      <td className="p-4 text-emerald-400 font-mono font-bold">{p.palpite}</td>
                      {config && config.dias_feira > 1 && <td className="p-4 text-purple-300/50">{p.dia_feira || '-'}</td>}
                      <td className="p-4 text-purple-300/50">{formatDate(p.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalParticipantes > 50 && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-[#1e0f35] border border-purple-700/30 rounded text-sm text-purple-200/60 hover:text-white disabled:opacity-30"
              >
                Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-purple-300/50">
                Página {page} de {Math.ceil(totalParticipantes / 50)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * 50 >= totalParticipantes}
                className="px-3 py-1.5 bg-[#1e0f35] border border-purple-700/30 rounded text-sm text-purple-200/60 hover:text-white disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* Configurações Tab */}
      {tab === 'configuracoes' && config && (() => {
        // Resolve effective dates: from linked event or manual config
        const linkedEvent = formConfig.event_id ? events.find(e => e.id === formConfig.event_id) : null;
        const effectiveStartDate = linkedEvent?.start_date || formConfig.data_inicio;
        const effectiveEndDate = linkedEvent?.end_date || null;
        let effectiveDias = formConfig.dias_feira || 1;
        if (linkedEvent?.start_date && linkedEvent?.end_date) {
          const s = new Date(linkedEvent.start_date + 'T12:00:00');
          const e = new Date(linkedEvent.end_date + 'T12:00:00');
          effectiveDias = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
        }
        const isMultiDia = effectiveDias > 1;

        // Calculate which fair day is "today" for the status indicator
        let diaAtual: number | null = null;
        let feiraStatus: 'antes' | 'durante' | 'depois' | null = null;
        if (effectiveStartDate && isMultiDia) {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          const inicio = new Date(effectiveStartDate + 'T00:00:00');
          const diff = Math.floor((hoje.getTime() - inicio.getTime()) / 86400000) + 1;
          if (diff < 1) feiraStatus = 'antes';
          else if (diff > effectiveDias) feiraStatus = 'depois';
          else { feiraStatus = 'durante'; diaAtual = diff; }
        }

        return (
        <div className="max-w-3xl space-y-5">

          {/* Banner de status — sempre no topo */}
          <div className={`rounded-xl overflow-hidden border ${config.quiz_ativo ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
            <div className={`px-6 py-4 flex items-center justify-between ${config.quiz_ativo ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${config.quiz_ativo ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                <div>
                  <p className={`text-sm font-bold ${config.quiz_ativo ? 'text-emerald-400' : 'text-red-400'}`}>
                    {config.quiz_ativo ? 'Quiz Ativo' : 'Quiz Pausado'}
                  </p>
                  <p className="text-xs text-purple-300/50">
                    {config.quiz_ativo
                      ? feiraStatus === 'durante'
                        ? `Dia ${diaAtual} de ${effectiveDias} — participantes podem enviar palpites`
                        : feiraStatus === 'antes'
                          ? 'Ativo, mas a feira ainda não começou'
                          : feiraStatus === 'depois'
                            ? 'Ativo, mas a feira já terminou'
                            : 'Participantes podem enviar palpites agora'
                      : 'Ninguém consegue enviar palpites'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleAtivo}
                disabled={togglingAtivo}
                className={`
                  group relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-full
                  transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e0f35]
                  ${config.quiz_ativo
                    ? 'bg-emerald-500 focus-visible:ring-emerald-400'
                    : 'bg-purple-900/60 focus-visible:ring-purple-400'}
                  ${togglingAtivo ? 'opacity-50 cursor-wait' : ''}
                `}
                role="switch"
                aria-checked={config.quiz_ativo}
                aria-label={config.quiz_ativo ? 'Desativar quiz' : 'Ativar quiz'}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0
                    transition-transform duration-200 ease-in-out
                    ${config.quiz_ativo ? 'translate-x-[26px]' : 'translate-x-[3px]'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Card 1: A Feira — selecionar evento ou configurar manualmente */}
          <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30 space-y-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              A Feira
            </h3>
            <p className="text-xs text-purple-300/50 -mt-2">Vincule a uma feira cadastrada. Nome, datas e pipeline vêm dela automaticamente.</p>

            {/* Event selector */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Feira vinculada</label>
              <select
                value={formConfig.event_id || ''}
                onChange={(e) => {
                  const eventId = e.target.value || null;
                  const selectedEvent = events.find(ev => ev.id === eventId);
                  const updates: Partial<QuizConfig> = { ...formConfig, event_id: eventId };

                  if (selectedEvent) {
                    // Sync name from event
                    updates.nome_evento = selectedEvent.name;
                    // Sync pipeline if quiz doesn't have one
                    if (selectedEvent.pipeline_id && !formConfig.pipeline_id) {
                      updates.pipeline_id = selectedEvent.pipeline_id;
                    }
                    // Calculate dias_feira from event dates
                    if (selectedEvent.start_date && selectedEvent.end_date) {
                      const start = new Date(selectedEvent.start_date + 'T12:00:00');
                      const end = new Date(selectedEvent.end_date + 'T12:00:00');
                      const dias = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                      if (dias > 0) {
                        updates.dias_feira = dias;
                        updates.data_inicio = selectedEvent.start_date;
                        // Auto-generate dias_config
                        const currentConfig = formConfig.dias_config || [];
                        updates.dias_config = Array.from({ length: dias }, (_, i) => ({
                          dia: i + 1,
                          valor_exato: currentConfig[i]?.valor_exato || formConfig.valor_exato || 0,
                          descricao: currentConfig[i]?.descricao || '',
                          telefone_vip: currentConfig[i]?.telefone_vip || '',
                        }));
                      }
                    }
                  }
                  setFormConfig(updates);
                }}
                className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">Sem feira vinculada (configuração manual)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                    {ev.start_date ? ` — ${new Date(ev.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                    {ev.status === 'RASCUNHO' ? ' (rascunho)' : ev.status === 'ENCERRADO' ? ' (encerrada)' : ''}
                  </option>
                ))}
              </select>
              {events.length === 0 && (
                <p className="text-xs text-yellow-400/60 mt-1">Nenhuma feira cadastrada. Crie uma em Eventos antes, ou configure manualmente abaixo.</p>
              )}
            </div>

            {/* Linked event summary */}
            {formConfig.event_id && (() => {
              const ev = events.find(e => e.id === formConfig.event_id);
              if (!ev) return null;
              const dias = ev.start_date && ev.end_date
                ? Math.round((new Date(ev.end_date + 'T12:00:00').getTime() - new Date(ev.start_date + 'T12:00:00').getTime()) / 86400000) + 1
                : null;
              return (
                <div className="flex items-start gap-3 px-4 py-3 bg-emerald-500/5 rounded-lg border border-emerald-500/15">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  <div className="text-xs text-purple-300/60 space-y-1">
                    <p><span className="text-white font-medium">{ev.name}</span> <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.status === 'ATIVO' ? 'bg-emerald-500/15 text-emerald-400' : ev.status === 'RASCUNHO' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>{ev.status}</span></p>
                    {ev.start_date && ev.end_date && (
                      <p>
                        {new Date(ev.start_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        {' '}a{' '}
                        {new Date(ev.end_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {dias && <span className="text-white font-medium"> ({dias} dias = {dias} sorteios)</span>}
                      </p>
                    )}
                    {feiraStatus === 'durante' && <p className="text-emerald-400 font-bold">HOJE é dia {diaAtual}</p>}
                    {feiraStatus === 'antes' && <p className="text-yellow-400/70">Feira ainda não começou</p>}
                    {feiraStatus === 'depois' && <p className="text-red-400/70">Feira já encerrou</p>}
                    {ev.pipeline_id && <p>Pipeline da feira será usado para contatos do quiz</p>}
                  </div>
                </div>
              );
            })()}

            {/* Manual config — only show when no event is linked */}
            {!formConfig.event_id && (
              <>
                <div className="pt-2 border-t border-purple-700/15">
                  <p className="text-[10px] text-purple-300/30 uppercase tracking-wider font-bold mb-3">Configuração manual</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-white font-medium mb-1">Nome do Evento</label>
                    <input
                      type="text"
                      value={formConfig.nome_evento || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, nome_evento: e.target.value })}
                      placeholder="Ex: AGRISHOW 2026"
                      className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-300/30 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white font-medium mb-1">Data de Início</label>
                    <input
                      type="date"
                      value={formConfig.data_inicio || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, data_inicio: e.target.value || null })}
                      className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white font-medium mb-1">Quantos dias?</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={formConfig.dias_feira || 1}
                      onChange={(e) => {
                        const dias = Math.max(1, parseInt(e.target.value) || 1);
                        const currentConfig = formConfig.dias_config || [];
                        const newDiasConfig = Array.from({ length: dias }, (_, i) => ({
                          dia: i + 1,
                          valor_exato: currentConfig[i]?.valor_exato || formConfig.valor_exato || 0,
                          descricao: currentConfig[i]?.descricao || '',
                          telefone_vip: currentConfig[i]?.telefone_vip || '',
                        }));
                        setFormConfig({ ...formConfig, dias_feira: dias, dias_config: newDiasConfig });
                      }}
                      className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-xs text-purple-300/40 mt-1">Quantos dias dura a feira</p>
                  </div>
                </div>
              </>
            )}

            {/* Tipo de sorteio (aparece sempre que a feira tem 2+ dias, seja por evento ou manual) */}
            {(isMultiDia || (formConfig.dias_feira || 1) > 1) && (
              <div className="pt-4 border-t border-purple-700/15">
                <label className="block text-sm text-white font-medium mb-2">Tipo de sorteio</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormConfig({ ...formConfig, sorteio_unico: false })}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      !formConfig.sorteio_unico
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-[#120826] border-purple-700/30 text-purple-200 hover:bg-[#2a1245]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">📅</span>
                      <span className="font-bold">Um por dia</span>
                      {!formConfig.sorteio_unico && <span className="ml-auto text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">ATIVO</span>}
                    </div>
                    <p className="text-xs opacity-70">1 vencedor pra cada dia da feira. Cada dia com seu valor exato, descrição e VIP próprios.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormConfig({ ...formConfig, sorteio_unico: true })}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      formConfig.sorteio_unico
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-[#120826] border-purple-700/30 text-purple-200 hover:bg-[#2a1245]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🎯</span>
                      <span className="font-bold">Único</span>
                      {formConfig.sorteio_unico && <span className="ml-auto text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-bold">ATIVO</span>}
                    </div>
                    <p className="text-xs opacity-70">Apenas 1 vencedor considerando TODOS os palpites da feira. Usa valor exato único (não precisa configurar por dia).</p>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: O Desafio — valor, descrição, VIP (adapta conforme 1 ou N dias) */}
          <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30 space-y-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              O Desafio
            </h3>

            {!isMultiDia ? (
              <>
                <p className="text-xs text-purple-300/50 -mt-2">Configure a pergunta e a resposta correta do quiz.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white font-medium mb-1">Valor Exato (Resposta)</label>
                    <input
                      type="number"
                      value={formConfig.valor_exato || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, valor_exato: parseInt(e.target.value) || 0 })}
                      className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-xs text-purple-300/40 mt-1">Numero correto que os participantes tentam adivinhar</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white font-medium mb-1">
                      Telefone VIP
                      <span className="ml-1.5 text-[10px] font-normal text-yellow-400/60 bg-yellow-400/10 px-1.5 py-0.5 rounded">vencedor garantido</span>
                    </label>
                    <input
                      type="tel"
                      value={formConfig.telefone_vip || ''}
                      onChange={(e) => setFormConfig({ ...formConfig, telefone_vip: e.target.value || null })}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-300/30 focus:outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-xs text-purple-300/40 mt-1">Quando esse telefone participar, o palpite dele é trocado pela resposta certa nos bastidores — ele vence automaticamente</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white font-medium mb-1">Descrição do Desafio</label>
                  <textarea
                    value={formConfig.descricao_desafio || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, descricao_desafio: e.target.value })}
                    rows={2}
                    className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                  <p className="text-xs text-purple-300/40 mt-1">Texto exibido para o participante na tela do palpite</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-purple-300/50 -mt-2">
                  Feira com <span className="text-white font-medium">{effectiveDias} dias</span> — configure valor, descrição e VIP de cada dia separadamente.
                </p>

                {/* Descrição padrão (fallback para dias sem descrição própria) */}
                <div>
                  <label className="block text-sm text-white font-medium mb-1">Descrição Padrão do Desafio</label>
                  <textarea
                    value={formConfig.descricao_desafio || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, descricao_desafio: e.target.value })}
                    rows={2}
                    className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                  <p className="text-xs text-purple-300/40 mt-1">Usada nos dias que não tiverem descrição própria</p>
                </div>

                {/* Config por dia */}
                <div className="space-y-2">
                  {(formConfig.dias_config || []).map((dc, i) => {
                    const isToday = diaAtual === i + 1;
                    return (
                      <div key={i} className={`bg-[#120826] rounded-lg border overflow-hidden ${isToday ? 'border-emerald-500/30 ring-1 ring-emerald-500/20' : 'border-purple-700/20'}`}>
                        <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${isToday ? 'bg-emerald-500/10 border-emerald-500/10' : 'bg-purple-900/20 border-purple-700/10'}`}>
                          <span className={`text-xs font-bold ${isToday ? 'text-emerald-400' : 'text-emerald-400/80'}`}>DIA {i + 1}</span>
                          {effectiveStartDate && (
                            <span className="text-xs text-purple-300/40">
                              {new Date(new Date(effectiveStartDate + 'T12:00:00').getTime() + i * 86400000).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                          {isToday && (
                            <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full uppercase tracking-wider">Hoje</span>
                          )}
                        </div>
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] text-purple-300/40 mb-0.5 uppercase tracking-wider">Valor exato</label>
                            <input
                              type="number"
                              value={dc.valor_exato ?? ''}
                              onChange={(e) => {
                                const updated = [...(formConfig.dias_config || [])];
                                updated[i] = { ...updated[i], valor_exato: parseInt(e.target.value) || 0 };
                                setFormConfig({ ...formConfig, dias_config: updated });
                              }}
                              className="w-full bg-[#1e0f35] border border-purple-700/30 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-purple-300/40 mb-0.5 uppercase tracking-wider">Descrição</label>
                            <input
                              type="text"
                              value={dc.descricao || ''}
                              onChange={(e) => {
                                const updated = [...(formConfig.dias_config || [])];
                                updated[i] = { ...updated[i], descricao: e.target.value };
                                setFormConfig({ ...formConfig, dias_config: updated });
                              }}
                              placeholder="Usa a padrão se vazio"
                              className="w-full bg-[#1e0f35] border border-purple-700/30 rounded px-2 py-1.5 text-sm text-white placeholder-purple-300/20 focus:outline-none focus:border-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-purple-300/40 mb-0.5 uppercase tracking-wider">
                              Tel. VIP <span className="text-yellow-400/50 normal-case">(vencedor)</span>
                            </label>
                            <input
                              type="tel"
                              value={dc.telefone_vip || ''}
                              onChange={(e) => {
                                const updated = [...(formConfig.dias_config || [])];
                                updated[i] = { ...updated[i], telefone_vip: e.target.value || undefined };
                                setFormConfig({ ...formConfig, dias_config: updated });
                              }}
                              placeholder="Vence este dia"
                              className="w-full bg-[#1e0f35] border border-purple-700/30 rounded px-2 py-1.5 text-sm text-white placeholder-purple-300/20 focus:outline-none focus:border-emerald-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Mensagem de pausa */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Mensagem de Pausa</label>
              <input
                type="text"
                value={formConfig.mensagem_pausa || ''}
                onChange={(e) => setFormConfig({ ...formConfig, mensagem_pausa: e.target.value })}
                className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-purple-300/40 mt-1">Texto exibido quando o quiz está desligado</p>
            </div>
          </div>

          {/* Card 3: Destino CRM */}
          <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30 space-y-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Destino dos Contatos
            </h3>
            <p className="text-xs text-purple-300/50 -mt-2">Cada participante vira contato no CRM automaticamente.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white font-medium mb-1">Pipeline</label>
                <select
                  value={formConfig.pipeline_id || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, pipeline_id: e.target.value || null })}
                  className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">Selecione um pipeline</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-purple-300/40 mt-1">Contato entra na 1a etapa deste pipeline</p>
              </div>
              <div>
                <label className="block text-sm text-white font-medium mb-1">Tag CRM</label>
                <input
                  type="text"
                  value={formConfig.crm_tag || ''}
                  onChange={(e) => setFormConfig({ ...formConfig, crm_tag: e.target.value })}
                  placeholder="ex: agrishow-2026"
                  className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-300/30 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Link Público + QR */}
          <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              Link Público (Totem)
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={config.token_publico ? `${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/${config.token_publico}` : ''}
                className="flex-1 bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-purple-300/70 focus:outline-none"
              />
              <button
                onClick={copyPublicLink}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-purple-300/40">Coloque este link no tablet/totem da feira</p>
              {config.token_publico && (
                <button
                  onClick={() => window.open(`/quiz/${config.token_publico}`, '_blank')}
                  className="text-xs text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  Ver como participante
                </button>
              )}
            </div>

            {config.token_publico && qrDataUrl && (
              <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-[#120826] border border-purple-700/30 rounded-xl">
                <img
                  src={qrDataUrl}
                  alt="QR code do link público"
                  className="w-36 h-36 bg-white rounded-lg p-2 shadow-lg shadow-black/20"
                />
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm text-white font-medium mb-1">QR Code do Quiz</p>
                  <p className="text-xs text-purple-300/60 mb-3">
                    Imprima e cole no totem. Quem escanear cai direto na tela do quiz.
                  </p>
                  <button
                    onClick={downloadQr}
                    className="px-4 py-2 bg-purple-600/40 hover:bg-purple-600/60 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Baixar PNG
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botão Salvar fixo */}
          <div className="sticky bottom-0 bg-gradient-to-t from-[#1a0a2e] via-[#1a0a2e] to-transparent pt-6 pb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
              {saveMsg && (
                <span className="text-sm text-emerald-400 font-medium">{saveMsg}</span>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="bg-[#1e0f35] rounded-2xl p-8 max-w-md w-full mx-4 border border-purple-700/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-red-400 mb-2">Limpar Participantes</h2>
            <p className="text-sm text-purple-200/70 mb-6">
              Tem certeza? Isso vai deletar <span className="text-white font-bold">{totalParticipantes}</span> participante(s).
              <br />
              <span className="text-purple-300/50">Os contatos no CRM serao mantidos.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deletando...' : 'Sim, Limpar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vencedor Modal */}
      {showVencedor && vencedorData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowVencedor(false)}>
          <div className="bg-[#1e0f35] rounded-2xl p-8 max-w-lg w-full mx-4 border border-purple-700/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-emerald-400 mb-2">Resultado do Quiz</h2>
            <p className="text-sm text-purple-300/50 mb-6">
              Valor exato: <span className="text-white font-bold">{vencedorData.valor_exato}</span> | {vencedorData.total_participantes} participante(s)
            </p>

            {vencedorData.vencedor ? (
              <>
                {/* Winner highlight */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">&#127942;</span>
                    <span className="text-lg font-bold text-emerald-400">VENCEDOR</span>
                  </div>
                  <p className="text-white text-lg font-bold">{vencedorData.vencedor.nome}</p>
                  <p className="text-purple-200/70 text-sm">{vencedorData.vencedor.empresa}</p>
                  <p className="text-purple-200/70 text-sm font-mono">{vencedorData.vencedor.telefone}</p>
                  <div className="mt-3 flex gap-4 text-sm">
                    <span className="text-purple-300/50">Palpite: <span className="text-emerald-400 font-bold font-mono">{vencedorData.vencedor.palpite}</span></span>
                    <span className="text-purple-300/50">Diferença: <span className="text-yellow-400 font-bold font-mono">{vencedorData.vencedor.diferenca}</span></span>
                  </div>
                </div>

                {/* Ranking */}
                {vencedorData.ranking.length > 1 && (
                  <div>
                    <h3 className="text-sm font-medium text-purple-300/50 mb-3">Top 10 mais próximos</h3>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {vencedorData.ranking.map((p, i) => (
                        <div key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${i === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'text-purple-200/70'}`}>
                          <span className="w-6 text-center font-bold text-purple-300/40">{i + 1}</span>
                          <span className="flex-1 truncate">{p.nome}</span>
                          <span className="font-mono text-emerald-400">{p.palpite}</span>
                          <span className="font-mono text-yellow-400/60 text-xs">±{p.diferenca}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-purple-300/50 text-center py-8">Nenhum participante encontrado.</p>
            )}

            <button
              onClick={() => setShowVencedor(false)}
              className="mt-6 w-full px-4 py-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-sm font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {/* Delete Quiz Modal (admin only) */}
      {showDeleteQuizModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!deletingQuiz) { setShowDeleteQuizModal(false); setQuizToDelete(null); } }}>
          <div className="bg-[#1e0f35] rounded-2xl p-8 max-w-md w-full mx-4 border border-purple-700/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-red-400 mb-2">Excluir Quiz</h2>
            <p className="text-sm text-purple-200/70 mb-2">
              Tem certeza que deseja excluir <span className="text-white font-bold">{quizToDelete?.name || config?.nome_evento || 'este quiz'}</span>?
            </p>
            <p className="text-xs text-purple-300/50 mb-6">
              Todos os participantes deste quiz serão removidos. Os contatos no CRM serão mantidos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteQuizModal(false); setQuizToDelete(null); }}
                disabled={deletingQuiz}
                className="flex-1 px-4 py-2.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteQuiz}
                disabled={deletingQuiz}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {deletingQuiz ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="bg-[#1e0f35] rounded-xl p-5 border border-purple-700/30">
      <p className="text-xs text-purple-300/50 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
