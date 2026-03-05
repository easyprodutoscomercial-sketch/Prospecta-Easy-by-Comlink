'use client';

interface TimelineEvent {
  label: string;
  date: string;
  by?: string;
  type: 'created' | 'updated' | 'finalized';
}

interface PcRecordTimelineProps {
  created_at: string;
  updated_at: string;
  finalizado_at?: string | null;
  created_by_name?: string;
}

export default function PcRecordTimeline({ created_at, updated_at, finalizado_at, created_by_name }: PcRecordTimelineProps) {
  const events: TimelineEvent[] = [];

  if (created_at) {
    events.push({
      label: 'Criado',
      date: created_at,
      by: created_by_name,
      type: 'created',
    });
  }

  if (updated_at && updated_at !== created_at) {
    events.push({
      label: 'Atualizado',
      date: updated_at,
      type: 'updated',
    });
  }

  if (finalizado_at) {
    events.push({
      label: 'Finalizado',
      date: finalizado_at,
      type: 'finalized',
    });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const typeColors = {
    created: 'bg-blue-500',
    updated: 'bg-amber-500',
    finalized: 'bg-emerald-500',
  };

  return (
    <div className="space-y-0">
      {events.map((event, idx) => (
        <div key={idx} className="flex items-start gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full ${typeColors[event.type]} shrink-0 mt-1`} />
            {idx < events.length - 1 && (
              <div className="w-px h-full bg-purple-800/30 min-h-[20px]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-neutral-300 font-medium">{event.label}</p>
            <p className="text-xs text-neutral-500">
              {new Date(event.date).toLocaleDateString('pt-BR')}{' '}
              {new Date(event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {event.by && <span className="ml-1">por {event.by}</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
