'use client';

import { useState } from 'react';
import { PcAlert } from '@/lib/types';

interface PcAlertsPanelProps {
  alerts: PcAlert[];
}

export default function PcAlertsPanel({ alerts }: PcAlertsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0) return null;

  const dangerCount = alerts.filter((a) => a.type === 'danger').length;
  const warningCount = alerts.filter((a) => a.type === 'warning').length;

  return (
    <div className="bg-[#1e0f35] border border-purple-800/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-purple-800/10 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm font-semibold text-white">
            Alertas ({alerts.length})
          </span>
          <div className="flex items-center gap-2">
            {dangerCount > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400">
                {dangerCount} critico{dangerCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400">
                {warningCount} atencao
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-purple-800/20 divide-y divide-purple-800/10">
          {alerts.slice(0, 10).map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 px-4 py-3 ${
                alert.type === 'danger' ? 'bg-red-500/5' : 'bg-amber-500/5'
              }`}
            >
              <div
                className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  alert.type === 'danger' ? 'bg-red-500' : 'bg-amber-500'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-300">{alert.message}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {alert.days_old} dias
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  alert.entity === 'cotacao'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {alert.entity === 'cotacao' ? 'Cotacao' : 'Pedido'}
              </span>
            </div>
          ))}
          {alerts.length > 10 && (
            <div className="px-4 py-2 text-xs text-neutral-500 text-center">
              + {alerts.length - 10} alertas adicionais
            </div>
          )}
        </div>
      )}
    </div>
  );
}
