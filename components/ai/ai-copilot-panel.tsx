'use client';

import { useState, useEffect } from 'react';
import { RiskAlert, ActionSuggestion } from '@/lib/ai/types';
import RiskBadge from './risk-badge';
import NextActionCard from './next-action-card';
import MessageGenerator from './message-generator';
import { formatStatus } from '@/lib/utils/labels';

interface AICopilotPanelProps {
  contactId: string;
  contactName: string;
  contactStatus: string;
  onActionApplied?: () => void;
}

export default function AICopilotPanel({ contactId, contactName, contactStatus, onActionApplied }: AICopilotPanelProps) {
  const [risks, setRisks] = useState<RiskAlert[]>([]);
  const [nextAction, setNextAction] = useState<ActionSuggestion | null>(null);
  const [contactStats, setContactStats] = useState<{
    daysInStage: number;
    interactionCount: number;
    lastInteraction: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyingAction, setApplyingAction] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/next-action/${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setRisks(data.risks || []);
        setNextAction(data.nextAction || null);
        setContactStats(data.contact || null);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchAnalysis(); }, [contactId]);

  const handleApplyAction = async (action: string, date?: string) => {
    setApplyingAction(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxima_acao_tipo: action,
          proxima_acao_data: date || null,
        }),
      });
      if (res.ok) {
        onActionApplied?.();
        // Refresh analysis
        await fetchAnalysis();
      }
    } catch { /* silent */ }
    setApplyingAction(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          Analisando contato...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      {contactStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#120826] rounded-lg border border-purple-800/20 p-3 text-center">
            <p className="text-lg font-bold text-white">{contactStats.daysInStage}</p>
            <p className="text-[10px] text-neutral-500">dias na etapa</p>
          </div>
          <div className="bg-[#120826] rounded-lg border border-purple-800/20 p-3 text-center">
            <p className="text-lg font-bold text-white">{contactStats.interactionCount}</p>
            <p className="text-[10px] text-neutral-500">interacoes</p>
          </div>
          <div className="bg-[#120826] rounded-lg border border-purple-800/20 p-3 text-center">
            <p className="text-lg font-bold text-white">{formatStatus(contactStatus)}</p>
            <p className="text-[10px] text-neutral-500">status atual</p>
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Alertas de Risco ({risks.length})
          </h4>
          <div className="space-y-2">
            {risks.map((risk, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-3 ${
                  risk.level === 'CRITICAL'
                    ? 'border-red-500/30 bg-red-500/5'
                    : risk.level === 'HIGH'
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : 'border-amber-500/30 bg-amber-500/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  <RiskBadge level={risk.level} compact />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white">{risk.title}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{risk.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No risks */}
      {risks.length === 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-emerald-400">Tudo certo!</p>
          <p className="text-xs text-neutral-500 mt-1">Nenhum risco detectado para este contato.</p>
        </div>
      )}

      {/* Next Action Suggestion */}
      {nextAction && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Proxima Acao Sugerida
          </h4>
          <NextActionCard
            suggestion={nextAction}
            onApply={handleApplyAction}
            loading={applyingAction}
          />
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-purple-800/20" />

      {/* Message Generator */}
      <MessageGenerator contactId={contactId} />
    </div>
  );
}
