'use client';

import { useState, useEffect } from 'react';
import type { PipelineWithStages, PipelineType, Profile } from '@/lib/types';
import { usePipeline } from '@/lib/pipeline-context';
import StageEditor, { type StageEditorItem } from './stage-editor';

const DEFAULT_STAGES: StageEditorItem[] = [
  { name: 'Novo', slug: 'NOVO', color: '#a3a3a3', position: 0, is_terminal: false, terminal_type: null },
  { name: 'Em Prospecao', slug: 'EM_PROSPECCAO', color: '#f59e0b', position: 1, is_terminal: false, terminal_type: null },
  { name: 'Contatado', slug: 'CONTATADO', color: '#3b82f6', position: 2, is_terminal: false, terminal_type: null },
  { name: 'Convertido', slug: 'CONVERTIDO', color: '#10b981', position: 3, is_terminal: true, terminal_type: 'won' },
  { name: 'Perdido', slug: 'PERDIDO', color: '#ef4444', position: 4, is_terminal: true, terminal_type: 'lost' },
];

const DEFAULT_BUG_STAGES: StageEditorItem[] = [
  { name: 'Aberto', slug: 'ABERTO', color: '#ef4444', position: 0, is_terminal: false, terminal_type: null },
  { name: 'Em Analise', slug: 'EM_ANALISE', color: '#f59e0b', position: 1, is_terminal: false, terminal_type: null },
  { name: 'Corrigindo', slug: 'CORRIGINDO', color: '#3b82f6', position: 2, is_terminal: false, terminal_type: null },
  { name: 'Teste', slug: 'TESTE', color: '#8b5cf6', position: 3, is_terminal: false, terminal_type: null },
  { name: 'Resolvido', slug: 'RESOLVIDO', color: '#10b981', position: 4, is_terminal: true, terminal_type: 'won' },
];

const PIPELINE_TYPE_LABELS: Record<PipelineType, string> = {
  PADRAO: 'Pipeline Padrao',
  BUGS: 'Pipeline de Bugs',
};

const PIPELINE_TYPE_COLORS: Record<PipelineType, string> = {
  PADRAO: 'bg-emerald-500/15 text-emerald-400',
  BUGS: 'bg-red-500/15 text-red-400',
};

interface OrgUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

interface PipelineManagerProps {
  showBugsType?: boolean;
}

export default function PipelineManager({ showBugsType = false }: PipelineManagerProps) {
  const { refetch: refetchGlobalPipelines } = usePipeline();
  const [pipelines, setPipelines] = useState<PipelineWithStages[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Org users for member selection
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PipelineType>('PADRAO');
  const [formStages, setFormStages] = useState<StageEditorItem[]>(DEFAULT_STAGES);
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPipelines = async () => {
    try {
      const res = await fetch('/api/pipelines');
      if (res.ok) {
        const data = await res.json();
        setPipelines(data.pipelines || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setOrgUsers(data.users || []);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchPipelines();
    fetchUsers();
  }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormType('PADRAO');
    setFormStages(DEFAULT_STAGES);
    setFormMemberIds([]);
    setResult(null);
  };

  const startCreate = () => {
    resetForm();
    // Por padrao ao criar, selecionar todos os usuarios
    setFormMemberIds(orgUsers.map(u => u.user_id));
    setShowForm(true);
  };

  const startEdit = (pipeline: PipelineWithStages) => {
    setEditingId(pipeline.id);
    setFormName(pipeline.name);
    setFormDescription(pipeline.description || '');
    setFormType(pipeline.pipeline_type || 'PADRAO');
    setFormStages(
      pipeline.stages.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        color: s.color,
        icon: s.icon || null,
        position: s.position,
        is_terminal: s.is_terminal,
        terminal_type: s.terminal_type,
        allow_meeting: s.allow_meeting || false,
      }))
    );
    // Preencher membros atuais
    setFormMemberIds(
      (pipeline.members || []).map(m => m.user_id)
    );
    setShowForm(true);
    setResult(null);
  };

  const toggleMember = (userId: string) => {
    setFormMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllMembers = () => {
    setFormMemberIds(orgUsers.map(u => u.user_id));
  };

  const deselectAllMembers = () => {
    setFormMemberIds([]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setResult({ type: 'error', message: 'Nome do pipeline obrigatorio' });
      return;
    }
    if (formStages.length === 0) {
      setResult({ type: 'error', message: 'Pelo menos 1 etapa obrigatoria' });
      return;
    }
    if (formStages.some(s => !s.name.trim())) {
      setResult({ type: 'error', message: 'Todas as etapas precisam de um nome' });
      return;
    }

    setSaving(true);
    setResult(null);

    try {
      const body = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        pipeline_type: formType,
        stages: formStages.map((s, i) => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name,
          slug: s.slug,
          color: s.color,
          icon: s.icon || null,
          position: i,
          is_terminal: s.is_terminal,
          terminal_type: s.is_terminal ? s.terminal_type : null,
          allow_meeting: s.allow_meeting || false,
        })),
        member_user_ids: formMemberIds,
      };

      const url = editingId ? `/api/pipelines/${editingId}` : '/api/pipelines';
      const method = editingId ? 'PUT' : 'POST';

      console.log('[PIPELINE SAVE] Enviando stages:', body.stages.map((s: any) => ({ id: s.id, name: s.name, icon: s.icon })));

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      console.log('[PIPELINE SAVE] Resposta stages:', (data.stages || []).map((s: any) => ({ id: s.id, name: s.name, icon: s.icon })));

      if (res.ok) {
        setResult({ type: 'success', message: editingId ? 'Pipeline atualizado com sucesso!' : 'Pipeline criado com sucesso!' });
        fetchPipelines();
        refetchGlobalPipelines(); // Atualiza contexto global (Kanban, sidebar, etc)
        setTimeout(resetForm, 1500);
      } else {
        setResult({ type: 'error', message: data.error || 'Erro ao salvar' });
      }
    } catch {
      setResult({ type: 'error', message: 'Erro de conexao' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o pipeline "${name}"?`)) return;

    setDeletingId(id);
    setResult(null);

    try {
      const res = await fetch(`/api/pipelines/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setResult({ type: 'success', message: `Pipeline "${name}" excluido.` });
        fetchPipelines();
        refetchGlobalPipelines(); // Atualiza contexto global
      } else {
        setResult({ type: 'error', message: data.error || 'Erro ao excluir' });
      }
    } catch {
      setResult({ type: 'error', message: 'Erro de conexao' });
    } finally {
      setDeletingId(null);
    }
  };

  const getMemberCount = (pipeline: PipelineWithStages) => {
    return (pipeline.members || []).length;
  };

  const getMemberNames = (pipeline: PipelineWithStages) => {
    const memberIds = (pipeline.members || []).map(m => m.user_id);
    return orgUsers
      .filter(u => memberIds.includes(u.user_id))
      .map(u => u.name)
      .join(', ');
  };

  return (
    <div>
      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          result.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/15 text-red-400 border border-red-500/20'
        }`}>
          {result.message}
        </div>
      )}

      {/* Pipeline list */}
      {!showForm && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-purple-300/60">
              {loading ? 'Carregando...' : `${pipelines.length} pipeline(s) configurado(s)`}
            </p>
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Pipeline
            </button>
          </div>

          {pipelines.map((pipeline) => (
            <div key={pipeline.id} className="p-4 bg-[#2a1245] rounded-lg border border-purple-800/20">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-neutral-100">{pipeline.name}</h3>
                    {pipeline.is_default && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/15 text-emerald-400 uppercase">
                        Padrao
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase ${PIPELINE_TYPE_COLORS[pipeline.pipeline_type || 'PADRAO']}`}>
                      {PIPELINE_TYPE_LABELS[pipeline.pipeline_type || 'PADRAO']}
                    </span>
                  </div>
                  {pipeline.description && (
                    <p className="text-xs text-purple-300/50 mt-0.5">{pipeline.description}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(pipeline)}
                    className="px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-md transition-colors"
                  >
                    Editar
                  </button>
                  {!pipeline.is_default && (
                    <button
                      onClick={() => handleDelete(pipeline.id, pipeline.name)}
                      disabled={deletingId === pipeline.id}
                      className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-40"
                    >
                      {deletingId === pipeline.id ? '...' : 'Excluir'}
                    </button>
                  )}
                </div>
              </div>

              {/* Stage preview */}
              <div className="flex gap-1">
                {pipeline.stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="flex-1 h-7 rounded-md flex items-center justify-center text-[9px] font-medium text-white truncate px-1"
                    style={{ backgroundColor: stage.color || '#a3a3a3' }}
                    title={`${stage.name}${stage.is_terminal ? ` (${stage.terminal_type === 'won' ? 'Ganho' : 'Perdido'})` : ''}`}
                  >
                    {stage.name}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-purple-300/30">{pipeline.stages.length} etapas</p>
                <p className="text-[10px] text-purple-300/30" title={getMemberNames(pipeline)}>
                  <svg className="w-3 h-3 inline-block mr-0.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {getMemberCount(pipeline)} membro(s)
                </p>
              </div>
            </div>
          ))}

          {!loading && pipelines.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-purple-300/40 mb-3">Nenhum pipeline configurado.</p>
              <button
                onClick={startCreate}
                className="px-4 py-2 text-sm text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors"
              >
                Criar primeiro pipeline
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-neutral-100">
              {editingId ? 'Editar Pipeline' : 'Novo Pipeline'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-purple-300/50 hover:text-purple-200 transition-colors"
            >
              Cancelar
            </button>
          </div>

          {/* Explicacao visual */}
          <div className="p-4 bg-purple-900/20 border border-purple-700/20 rounded-lg space-y-3">
            <p className="text-xs font-semibold text-purple-200">O que e um Pipeline?</p>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Pense no pipeline como o <strong className="text-white">quadro Kanban</strong> da sua equipe.
              Voce cria um pipeline para cada tipo de processo. Exemplo:
            </p>
            <div className="space-y-1.5 text-[11px] text-purple-300/60">
              <p>&#8226; Pipeline <strong className="text-emerald-400">&quot;Vendas&quot;</strong> — para acompanhar negocios de venda</p>
              <p>&#8226; Pipeline <strong className="text-blue-400">&quot;Produtos&quot;</strong> — para gerenciar desenvolvimento de produtos</p>
              <p>&#8226; Pipeline <strong className="text-amber-400">&quot;Pos-venda&quot;</strong> — para acompanhar clientes apos a compra</p>
            </div>
            <p className="text-xs text-purple-300/70 leading-relaxed">
              Cada pipeline tem suas proprias <strong className="text-white">etapas</strong> (as colunas do Kanban).
              No Kanban, voce seleciona qual pipeline quer ver e os contatos aparecem nas colunas.
            </p>

            {/* Mini example */}
            <div className="pt-2 border-t border-purple-700/20">
              <p className="text-[10px] text-purple-300/40 mb-1.5">Exemplo de como fica o Kanban com o pipeline &quot;Vendas&quot;:</p>
              <div className="flex gap-1">
                <div className="flex-1 h-7 rounded bg-neutral-500 flex items-center justify-center text-[9px] font-medium text-white">Novo</div>
                <div className="flex-1 h-7 rounded bg-amber-500 flex items-center justify-center text-[9px] font-medium text-white">Prospeccao</div>
                <div className="flex-1 h-7 rounded bg-blue-500 flex items-center justify-center text-[9px] font-medium text-white">Contatado</div>
                <div className="flex-1 h-7 rounded bg-emerald-500 flex items-center justify-center text-[9px] font-medium text-white">Ganho</div>
                <div className="flex-1 h-7 rounded bg-red-500 flex items-center justify-center text-[9px] font-medium text-white">Perdido</div>
              </div>
              <p className="text-[9px] text-purple-300/30 mt-1 text-center">← os contatos vao avancando da esquerda para a direita →</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Nome do Pipeline *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              placeholder="Ex: Vendas, Produtos, Pos-venda..."
              className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-[10px] text-purple-300/40">
              Esse nome aparece no seletor do Kanban. Ex: &quot;Vendas&quot;, &quot;Produtos&quot;, &quot;Parcerias&quot;
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Descricao (opcional)</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Ex: Pipeline para acompanhar vendas B2B"
              className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-[10px] text-purple-300/40">
              Texto curto para sua equipe saber para que serve esse pipeline.
            </p>
          </div>

          {/* Pipeline type selector - only show if bugs type is available or editing a bugs pipeline */}
          {(showBugsType || formType === 'BUGS') && (
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Tipo do Pipeline *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormType('PADRAO');
                  if (!editingId) setFormStages(DEFAULT_STAGES);
                }}
                className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                  formType === 'PADRAO'
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-purple-700/30 bg-[#2a1245] hover:border-purple-600/40'
                }`}
              >
                <p className={`text-sm font-semibold ${formType === 'PADRAO' ? 'text-emerald-400' : 'text-neutral-300'}`}>
                  Pipeline Padrao
                </p>
                <p className="text-[10px] text-purple-300/50 mt-0.5">
                  Vendas, prospecao, parcerias, etc.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormType('BUGS');
                  if (!editingId) setFormStages(DEFAULT_BUG_STAGES);
                }}
                className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                  formType === 'BUGS'
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-purple-700/30 bg-[#2a1245] hover:border-purple-600/40'
                }`}
              >
                <p className={`text-sm font-semibold ${formType === 'BUGS' ? 'text-red-400' : 'text-neutral-300'}`}>
                  Pipeline de Bugs
                </p>
                <p className="text-[10px] text-purple-300/50 mt-0.5">
                  Rastreamento de bugs com campo de anexo nos cards.
                </p>
              </button>
            </div>
          </div>
          )}

          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">Etapas (colunas do Kanban) *</label>
            <StageEditor stages={formStages} onChange={setFormStages} />
          </div>

          {/* Members section */}
          <div>
            <label className="block text-xs font-medium text-purple-300/80 mb-1">
              Membros do Pipeline
            </label>
            <div className="p-3 bg-purple-900/20 border border-purple-700/15 rounded-lg mb-2">
              <p className="text-[11px] text-purple-300/60 leading-relaxed">
                Selecione quais usuarios podem ver e trabalhar neste pipeline.
                <strong className="text-white"> Administradores sempre veem todos os pipelines</strong>, independente desta selecao.
              </p>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={selectAllMembers}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Selecionar todos
              </button>
              <span className="text-purple-300/20">|</span>
              <button
                type="button"
                onClick={deselectAllMembers}
                className="text-[10px] text-purple-300/50 hover:text-purple-300 transition-colors"
              >
                Desmarcar todos
              </button>
              <span className="ml-auto text-[10px] text-purple-300/40">
                {formMemberIds.length}/{orgUsers.length} selecionado(s)
              </span>
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {orgUsers.map((u) => (
                <label
                  key={u.user_id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                    formMemberIds.includes(u.user_id)
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-[#2a1245] border border-purple-800/20 hover:border-purple-700/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formMemberIds.includes(u.user_id)}
                    onChange={() => toggleMember(u.user_id)}
                    className="w-3.5 h-3.5 rounded border-purple-700/30 bg-[#1e0f35] text-emerald-500 focus:ring-emerald-500/50"
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-purple-700/40 flex items-center justify-center text-[10px] font-bold text-purple-200 shrink-0">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-neutral-100 truncate">{u.name}</p>
                      <p className="text-[10px] text-purple-300/40 truncate">{u.email}</p>
                    </div>
                  </div>
                  {u.role === 'admin' && (
                    <span className="ml-auto px-1.5 py-0.5 text-[8px] font-bold rounded bg-amber-500/15 text-amber-400 uppercase shrink-0">
                      Admin
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Salvando...' : (editingId ? 'Salvar Alteracoes' : 'Criar Pipeline')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="px-4 py-2.5 bg-purple-800/30 text-purple-200 text-sm font-medium rounded-lg hover:bg-purple-800/50 disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
