'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Contact } from '@/lib/types';
import { getContactCoords } from '@/lib/data/brazil-cities-coords';
import { usePipeline } from '@/lib/pipeline-context';

interface ContactsMapViewProps {
  contacts: Contact[];
  onEnrichComplete?: () => void;
}

// Status → marker color
const STATUS_MARKER_COLORS: Record<string, string> = {
  NOVO: '#a3a3a3',
  EM_PROSPECCAO: '#f59e0b',
  CONTATADO: '#3b82f6',
  REUNIAO_MARCADA: '#06b6d4',
  CONVERTIDO: '#10b981',
  PERDIDO: '#ef4444',
};

// Dynamic import to avoid SSR (Leaflet requires window)
const MapInner = dynamic(() => import('./contacts-map-inner'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-[#1e0f35] rounded-xl border border-purple-800/30">
    <div className="text-center">
      <svg className="mx-auto w-8 h-8 text-purple-400/30 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="text-xs text-neutral-500 mt-2">Carregando mapa...</p>
    </div>
  </div>
)});

export interface MapContact {
  contact: Contact;
  coords: [number, number];
  color: string;
}

export default function ContactsMapView({ contacts, onEnrichComplete }: ContactsMapViewProps) {
  const { selectedPipelineId } = usePipeline();
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; not_found: number } | null>(null);

  const { mapped, unmappedCount } = useMemo(() => {
    const mapped: MapContact[] = [];
    let unmappedCount = 0;

    for (const contact of contacts) {
      const coords = getContactCoords(contact.cidade, contact.estado);
      if (coords) {
        mapped.push({
          contact,
          coords,
          color: STATUS_MARKER_COLORS[contact.status] || '#a3a3a3',
        });
      } else {
        unmappedCount++;
      }
    }

    return { mapped, unmappedCount };
  }, [contacts]);

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await fetch('/api/contacts/enrich-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_id: selectedPipelineId || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setEnrichResult({ enriched: data.enriched, not_found: data.not_found });
        if (data.enriched > 0 && onEnrichComplete) {
          onEnrichComplete();
        }
      }
    } catch {
      setEnrichResult({ enriched: 0, not_found: 0 });
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="relative">
      <div className="h-[500px] sm:h-[600px] rounded-xl overflow-hidden border border-purple-800/30">
        <MapInner contacts={mapped} />
      </div>
      {unmappedCount > 0 && (
        <div className="mt-3 flex items-center justify-center gap-3 flex-wrap">
          <span className="text-[11px] text-neutral-500">
            {unmappedCount} contato{unmappedCount !== 1 ? 's' : ''} sem localização (sem cidade/estado)
          </span>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enriching ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Preenchendo...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Preencher pelo DDD
              </>
            )}
          </button>
          {enrichResult && (
            <span className="text-[11px]">
              {enrichResult.enriched > 0 ? (
                <span className="text-emerald-400">{enrichResult.enriched} preenchido{enrichResult.enriched !== 1 ? 's' : ''}</span>
              ) : (
                <span className="text-amber-400">Nenhum DDD encontrado</span>
              )}
              {enrichResult.not_found > 0 && (
                <span className="text-neutral-500 ml-1">({enrichResult.not_found} sem DDD válido)</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
