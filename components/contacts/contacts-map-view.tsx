'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Contact } from '@/lib/types';
import { getContactCoords } from '@/lib/data/brazil-cities-coords';

interface ContactsMapViewProps {
  contacts: Contact[];
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

export default function ContactsMapView({ contacts }: ContactsMapViewProps) {
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

  return (
    <div className="relative">
      <div className="h-[500px] sm:h-[600px] rounded-xl overflow-hidden border border-purple-800/30">
        <MapInner contacts={mapped} />
      </div>
      {unmappedCount > 0 && (
        <div className="mt-2 text-center">
          <span className="text-[11px] text-neutral-500">
            {unmappedCount} contato{unmappedCount !== 1 ? 's' : ''} sem localizacao (sem cidade/estado)
          </span>
        </div>
      )}
    </div>
  );
}
