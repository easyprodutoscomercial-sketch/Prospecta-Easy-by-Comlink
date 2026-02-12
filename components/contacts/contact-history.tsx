'use client';

import { Interaction, ContactAttachment } from '@/lib/types';
import { formatInteractionType, formatInteractionOutcome } from '@/lib/utils/labels';

interface HistoryEvent {
  id: string;
  type: 'interaction' | 'attachment';
  date: string;
  data: Interaction | (ContactAttachment & { public_url: string });
}

interface ContactHistoryProps {
  interactions: Interaction[];
  attachments: (ContactAttachment & { public_url: string })[];
}

export default function ContactHistory({ interactions, attachments }: ContactHistoryProps) {
  // Merge interactions and attachments into a single timeline
  const events: HistoryEvent[] = [
    ...interactions.map((i) => ({
      id: i.id,
      type: 'interaction' as const,
      date: i.happened_at,
      data: i,
    })),
    ...attachments.map((a) => ({
      id: a.id,
      type: 'attachment' as const,
      date: a.created_at,
      data: a,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <div className="text-center py-10">
        <svg className="w-12 h-12 mx-auto mb-3 text-purple-700/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-neutral-500">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-purple-700/30" />

      <div className="space-y-4">
        {events.map((event) => (
          <div key={`${event.type}-${event.id}`} className="relative pl-10">
            {/* Dot */}
            <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 ${
              event.type === 'interaction'
                ? 'border-emerald-500 bg-emerald-500/30'
                : 'border-purple-400 bg-purple-400/30'
            }`} />

            {event.type === 'interaction' ? (
              <InteractionEvent interaction={event.data as Interaction} />
            ) : (
              <AttachmentEvent attachment={event.data as (ContactAttachment & { public_url: string })} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InteractionEvent({ interaction }: { interaction: Interaction }) {
  return (
    <div className="bg-[#2a1245]/30 rounded-lg p-3 border border-purple-700/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-500/20 text-emerald-400">
              {formatInteractionType(interaction.type)}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300">
              {formatInteractionOutcome(interaction.outcome)}
            </span>
          </div>
          {interaction.note && (
            <p className="mt-1.5 text-sm text-neutral-400 break-words">{interaction.note}</p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-neutral-600 mt-2">
        {new Date(interaction.happened_at).toLocaleString('pt-BR')} · {interaction.created_by_name}
      </p>
    </div>
  );
}

function AttachmentEvent({ attachment }: { attachment: ContactAttachment & { public_url: string } }) {
  return (
    <div className="bg-[#2a1245]/30 rounded-lg p-3 border border-purple-700/20">
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-400/20 text-purple-300">
          Arquivo
        </span>
        <a
          href={attachment.public_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-300 hover:text-emerald-400 transition-colors truncate"
        >
          {attachment.file_name}
        </a>
      </div>
      <p className="text-[11px] text-neutral-600 mt-2">
        {new Date(attachment.created_at).toLocaleString('pt-BR')} · {attachment.uploaded_by_name}
      </p>
    </div>
  );
}
