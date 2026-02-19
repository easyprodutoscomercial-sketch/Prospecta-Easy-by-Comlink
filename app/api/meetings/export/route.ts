import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcalDate(date: string): string {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getAdminClient();
    const { data: profile } = await admin.from('profiles').select('organization_id').eq('user_id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { data: meetings } = await admin
      .from('meetings')
      .select('id, title, notes, location, meeting_at, duration_minutes, status, contact_id')
      .eq('organization_id', profile.organization_id)
      .eq('status', 'SCHEDULED')
      .order('meeting_at', { ascending: true });

    if (!meetings || meetings.length === 0) {
      return new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ProspectaEasy//CRM//PT\r\nEND:VCALENDAR', {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reunioes.ics"',
        },
      });
    }

    // Get contact names
    const contactIds = [...new Set(meetings.map(m => m.contact_id))];
    const { data: contacts } = await admin.from('contacts').select('id, name').in('id', contactIds);
    const contactMap: Record<string, string> = {};
    for (const c of contacts || []) contactMap[c.id] = c.name;

    let ical = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ProspectaEasy//CRM//PT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';

    for (const m of meetings) {
      const start = toIcalDate(m.meeting_at);
      const endDate = new Date(new Date(m.meeting_at).getTime() + (m.duration_minutes || 30) * 60000);
      const end = toIcalDate(endDate.toISOString());
      const contactName = contactMap[m.contact_id] || '';
      const summary = escapeIcal(m.title || `Reuniao com ${contactName}`);
      const description = escapeIcal([contactName ? `Contato: ${contactName}` : '', m.notes || ''].filter(Boolean).join('\\n'));

      ical += 'BEGIN:VEVENT\r\n';
      ical += `UID:${m.id}@prospectaeasy\r\n`;
      ical += `DTSTART:${start}\r\n`;
      ical += `DTEND:${end}\r\n`;
      ical += `SUMMARY:${summary}\r\n`;
      if (description) ical += `DESCRIPTION:${description}\r\n`;
      if (m.location) ical += `LOCATION:${escapeIcal(m.location)}\r\n`;
      ical += 'END:VEVENT\r\n';
    }

    ical += 'END:VCALENDAR';

    return new Response(ical, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reunioes.ics"',
      },
    });
  } catch (err) {
    console.error('iCal export error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
