import { Interaction, Meeting, ContactAttachment } from '@/lib/types';

export type TimelineEventKind = 'interaction' | 'meeting' | 'attachment';
export type TimelineFilter = 'all' | 'interaction' | 'meeting' | 'attachment';

type AttachmentWithUrl = ContactAttachment & { public_url: string };

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  sortDate: string; // ISO - para ordenacao cronologica
  data: Interaction | Meeting | AttachmentWithUrl;
}
