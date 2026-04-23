'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';

interface Pipeline {
  id: string;
  name: string;
}

interface EventOption {
  id: string;
  name: string;
  status: string;
  pipeline_id: string | null;
}

interface LeadCaptureLink {
  id: string;
  token: string;
  label: string | null;
  pipeline_id: string;
  pipeline_name: string;
  event_id: string | null;
  event_name: string | null;
  is_active: boolean;
  leads_count: number;
  created_at: string;
}

export default function QrCodeSection() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [links, setLinks] = useState<LeadCaptureLink[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [label, setLabel] = useState('');
  const [whatsappVendedor, setWhatsappVendedor] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<LeadCaptureLink | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [copied, setCopied] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/lead-capture-links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
      }
    } catch { /* silent */ } finally {
      setLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    // Fetch pipelines
    const fetchPipelines = async () => {
      try {
        const res = await fetch('/api/pipelines');
        if (res.ok) {
          const data = await res.json();
          const padrao = (data.pipelines || []).filter((p: any) => p.pipeline_type !== 'BUGS');
          setPipelines(padrao.map((p: any) => ({ id: p.id, name: p.name })));
        }
      } catch { /* silent */ }
    };

    // Fetch eventos (pra dropdown de amarrar QR a evento especifico)
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data) ? data : (data.events || []);
          // Mostra ATIVO e RASCUNHO (ENCERRADO nao faz sentido pra QR novo)
          const usable = raw.filter((e: any) => e.status !== 'ENCERRADO');
          setEvents(usable.map((e: any) => ({
            id: e.id,
            name: e.name,
            status: e.status,
            pipeline_id: e.pipeline_id || null,
          })));
        }
      } catch { /* silent */ }
    };

    fetchPipelines();
    fetchEvents();
    fetchLinks();
  }, [fetchLinks]);

  // Quando o usuario escolhe um evento, auto-preenche pipeline e label
  const handleEventChange = (eventId: string) => {
    setSelectedEvent(eventId);
    if (!eventId) return;
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    if (ev.pipeline_id) setSelectedPipeline(ev.pipeline_id);
    if (!label.trim()) setLabel(ev.name);
  };

  const getFullUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/lead-capture/${token}`;
    }
    return `/lead-capture/${token}`;
  };

  const generateQrDataUrl = async (token: string): Promise<string> => {
    const url = getFullUrl(token);
    return QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#120826',
        light: '#ffffff',
      },
    });
  };

  const handleGenerate = async () => {
    if (!selectedPipeline) return;

    setGenerating(true);
    setActionResult(null);

    try {
      const res = await fetch('/api/lead-capture-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: selectedPipeline,
          event_id: selectedEvent || undefined,
          label: label.trim() || undefined,
          whatsapp_vendedor: whatsappVendedor.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setGeneratedLink(data);
        const dataUrl = await generateQrDataUrl(data.token);
        setQrDataUrl(dataUrl);
        setLabel('');
        setSelectedEvent('');
        setWhatsappVendedor('');
        fetchLinks();
        setActionResult({ type: 'success', message: 'QR Code gerado com sucesso!' });
      } else {
        setActionResult({ type: 'error', message: data.error || 'Erro ao gerar QR Code' });
      }
    } catch {
      setActionResult({ type: 'error', message: 'Erro de conexao.' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl || !generatedLink) return;

    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode-${generatedLink.label || generatedLink.token}.png`;
    a.click();
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    const url = getFullUrl(generatedLink.token);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  const handleShowQr = async (link: LeadCaptureLink) => {
    setGeneratedLink(link);
    const dataUrl = await generateQrDataUrl(link.token);
    setQrDataUrl(dataUrl);
    setActionResult(null);
  };

  const handleToggleActive = async (link: LeadCaptureLink) => {
    try {
      const res = await fetch(`/api/lead-capture-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !link.is_active }),
      });

      if (res.ok) {
        setLinks(prev =>
          prev.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l)
        );
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm('Tem certeza que deseja excluir este link? Leads ja capturados nao serao afetados.')) return;

    try {
      const res = await fetch(`/api/lead-capture-links/${linkId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setLinks(prev => prev.filter(l => l.id !== linkId));
        if (generatedLink?.id === linkId) {
          setGeneratedLink(null);
          setQrDataUrl(null);
        }
      }
    } catch { /* silent */ }
  };

  return (
    <div id="qr-codes" className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 scroll-mt-16">
      <h2 className="text-sm font-medium text-neutral-100 mb-1">QR Code para Captura de Leads</h2>
      <p className="text-xs text-purple-300/60 mb-4">
        Gere QR Codes para capturar leads em feiras e eventos. O lead escaneia, preenche o formulario e entra direto no seu pipeline.
      </p>

      {/* Generator */}
      <div className="space-y-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">
            Evento/Feira <span className="text-purple-300/40">(opcional — amarra o QR a uma feira especifica)</span>
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => handleEventChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            <option value="">Generico (qualquer evento)</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} {e.status === 'RASCUNHO' ? '(rascunho)' : ''}
              </option>
            ))}
          </select>
          {selectedEvent && (
            <p className="text-[11px] text-emerald-400/70 mt-1">
              Pipeline e nome foram preenchidos automaticamente a partir do evento.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">Pipeline de Destino</label>
          <select
            value={selectedPipeline}
            onChange={(e) => setSelectedPipeline(e.target.value)}
            disabled={!!selectedEvent && !!events.find((ev) => ev.id === selectedEvent)?.pipeline_id}
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Selecione um pipeline...</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">
            Nome do Evento/Feira <span className="text-purple-300/40">(opcional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Agrishow 2026"
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-purple-300/80 mb-1">
            Seu WhatsApp <span className="text-purple-300/40">(opcional - exibido apos cadastro do lead)</span>
          </label>
          <input
            type="tel"
            value={whatsappVendedor}
            onChange={(e) => setWhatsappVendedor(e.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-700/30 text-neutral-100 placeholder:text-purple-300/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={!selectedPipeline || generating}
          className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-colors"
        >
          {generating ? 'Gerando...' : 'Gerar QR Code'}
        </button>
      </div>

      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          actionResult.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/15 text-red-400 border border-red-500/20'
        }`}>
          {actionResult.message}
        </div>
      )}

      {/* Generated QR Code Display */}
      {qrDataUrl && generatedLink && (
        <div className="mb-5 p-4 bg-[#2a1245]/50 border border-purple-700/20 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-3 rounded-lg">
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="text-center">
              <p className="text-xs text-purple-300/60 mb-0.5">
                {generatedLink.label || 'Sem nome'}
              </p>
              <p className="text-[10px] text-purple-300/40 font-mono break-all">
                {getFullUrl(generatedLink.token)}
              </p>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={handleDownloadPng}
                className="flex-1 px-3 py-2 text-xs font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar PNG
              </button>
              <button
                onClick={handleCopyLink}
                className="flex-1 px-3 py-2 text-xs font-medium text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Links List */}
      {loadingLinks ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-purple-800/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : links.length > 0 ? (
        <div>
          <h3 className="text-xs font-medium text-purple-300/60 uppercase tracking-wider mb-2">
            Links Criados ({links.length})
          </h3>
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-3 bg-[#2a1245]/30 border border-purple-800/20 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-neutral-100 truncate">
                      {link.label || 'Sem nome'}
                    </p>
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${
                      link.is_active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {link.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    {link.event_name && (
                      <span
                        className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-500/15 text-cyan-400"
                        title="QR travado a este evento"
                      >
                        📍 {link.event_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-purple-300/50 mt-0.5">
                    {link.pipeline_name} &middot; {link.leads_count} lead{link.leads_count !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  {/* Show QR */}
                  <button
                    onClick={() => handleShowQr(link)}
                    title="Ver QR Code"
                    className="p-1.5 text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </button>

                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(link)}
                    title={link.is_active ? 'Desativar' : 'Ativar'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      link.is_active ? 'bg-emerald-500' : 'bg-purple-800/50'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                      link.is_active ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(link.id)}
                    title="Excluir"
                    className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-purple-300/40 text-center py-3">
          Nenhum QR Code criado ainda.
        </p>
      )}
    </div>
  );
}
