'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'dashboard' | 'participantes' | 'configuracoes';

interface QuizConfig {
  id: string;
  quiz_ativo: boolean;
  valor_exato: number;
  nome_evento: string;
  descricao_desafio: string;
  mensagem_pausa: string;
  token_publico: string;
  pipeline_id: string | null;
  crm_tag: string;
  crm_ativo: boolean;
}

interface Pipeline {
  id: string;
  name: string;
}

interface Participante {
  id: string;
  nome: string;
  empresa: string;
  telefone: string;
  palpite: number;
  evento_nome: string;
  created_at: string;
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
  const [tab, setTab] = useState<Tab>('dashboard');
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
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
  const [saveMsg, setSaveMsg] = useState('');

  // Form state for config
  const [formConfig, setFormConfig] = useState<Partial<QuizConfig>>({});

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/quiz/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setPipelines(data.pipelines || []);
        setFormConfig(data.config);
      }
    } catch { /* silent */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/quiz/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* silent */ }
  }, []);

  const fetchParticipantes = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await fetch(`/api/quiz/participantes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setParticipantes(data.participantes || []);
        setTotalParticipantes(data.total || 0);
      }
    } catch { /* silent */ }
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchStats()]);
      setLoading(false);
    };
    init();
  }, [fetchConfig, fetchStats]);

  useEffect(() => {
    if (tab === 'participantes') {
      fetchParticipantes();
    }
  }, [tab, fetchParticipantes]);

  // Auto-refresh stats every 30s on dashboard tab
  useEffect(() => {
    if (tab !== 'dashboard') return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [tab, fetchStats]);

  const handleSaveConfig = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/quiz/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formConfig),
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
    const res = await fetch('/api/quiz/participantes/export');
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
      const res = await fetch('/api/quiz/participantes/vencedor');
      if (res.ok) {
        const data = await res.json();
        setVencedorData(data);
        setShowVencedor(true);
      }
    } catch { /* silent */ }
    setLoadingVencedor(false);
  };

  const copyPublicLink = () => {
    if (!config?.token_publico) return;
    const url = `${window.location.origin}/quiz/${config.token_publico}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-emerald-400">Quiz Feira</h1>
        {config && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.quiz_ativo ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {config.quiz_ativo ? 'ATIVO' : 'PAUSADO'}
          </span>
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

      {/* Dashboard Tab */}
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
          </div>

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
                  <th className="p-4 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {participantes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-purple-300/40">Nenhum participante encontrado.</td>
                  </tr>
                ) : (
                  participantes.map((p) => (
                    <tr key={p.id} className="border-t border-purple-700/20 hover:bg-purple-500/5">
                      <td className="p-4 text-white">{p.nome}</td>
                      <td className="p-4 text-purple-200/70">{p.empresa}</td>
                      <td className="p-4 text-purple-200/70 font-mono">{p.telefone}</td>
                      <td className="p-4 text-emerald-400 font-mono font-bold">{p.palpite}</td>
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
      {tab === 'configuracoes' && config && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-[#1e0f35] rounded-xl p-6 border border-purple-700/30 space-y-5">
            <h3 className="text-lg font-medium text-white">Configurações do Quiz</h3>

            {/* Quiz ativo toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-white font-medium">Quiz Ativo</label>
                <p className="text-xs text-purple-300/50">Habilita ou pausa o quiz para novos participantes</p>
              </div>
              <button
                onClick={() => setFormConfig({ ...formConfig, quiz_ativo: !formConfig.quiz_ativo })}
                className={`w-12 h-6 rounded-full transition-colors relative ${formConfig.quiz_ativo ? 'bg-emerald-500' : 'bg-purple-700/50'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${formConfig.quiz_ativo ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Valor exato */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Valor Exato (Resposta)</label>
              <input
                type="number"
                value={formConfig.valor_exato || ''}
                onChange={(e) => setFormConfig({ ...formConfig, valor_exato: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-purple-300/40 mt-1">O número correto que os participantes devem adivinhar</p>
            </div>

            {/* Nome evento */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Nome do Evento</label>
              <input
                type="text"
                value={formConfig.nome_evento || ''}
                onChange={(e) => setFormConfig({ ...formConfig, nome_evento: e.target.value })}
                className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Descrição desafio */}
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

            {/* Mensagem pausa */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Mensagem de Pausa</label>
              <input
                type="text"
                value={formConfig.mensagem_pausa || ''}
                onChange={(e) => setFormConfig({ ...formConfig, mensagem_pausa: e.target.value })}
                className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
              <p className="text-xs text-purple-300/40 mt-1">Texto exibido quando o quiz está pausado</p>
            </div>

            <hr className="border-purple-700/20" />

            <h3 className="text-lg font-medium text-white">Destino dos Contatos</h3>
            <p className="text-xs text-purple-300/50 -mt-2">Cada participante do quiz é criado automaticamente como contato no CRM.</p>

            {/* Pipeline selector */}
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
              <p className="text-xs text-purple-300/40 mt-1">O contato será criado na primeira etapa deste pipeline</p>
            </div>

            {/* Tag CRM */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Tag CRM</label>
              <input
                type="text"
                value={formConfig.crm_tag || ''}
                onChange={(e) => setFormConfig({ ...formConfig, crm_tag: e.target.value })}
                placeholder="ex: feira-2026"
                className="w-full bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-purple-300/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <hr className="border-purple-700/20" />

            {/* Link público */}
            <div>
              <label className="block text-sm text-white font-medium mb-1">Link Público (Totem)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={config.token_publico ? `${typeof window !== 'undefined' ? window.location.origin : ''}/quiz/${config.token_publico}` : ''}
                  className="flex-1 bg-[#120826] border border-purple-700/30 rounded-lg px-3 py-2.5 text-sm text-purple-300/70 focus:outline-none"
                />
                <button
                  onClick={copyPublicLink}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-purple-300/40 mt-1">Coloque este link no tablet/totem da feira</p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
              {saveMsg && (
                <span className="text-sm text-emerald-400">{saveMsg}</span>
              )}
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
