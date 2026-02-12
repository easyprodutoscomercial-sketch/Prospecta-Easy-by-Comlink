import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';
import { chatCompletion } from '@/lib/ai/openai';
import { buildMessagePrompt } from '@/lib/ai/prompts';
import { MessageChannel, MessageIntent } from '@/lib/ai/types';

const VALID_CHANNELS: MessageChannel[] = ['whatsapp', 'email', 'ligacao'];
const VALID_INTENTS: MessageIntent[] = ['primeiro_contato', 'follow_up', 'reagendar', 'enviar_proposta', 'cobrar_retorno', 'pos_reuniao', 'reativacao'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const body = await request.json();
    const { contact_id, channel, intent } = body;

    if (!contact_id || !channel || !intent) {
      return NextResponse.json({ error: 'contact_id, channel e intent são obrigatórios' }, { status: 400 });
    }
    if (!VALID_CHANNELS.includes(channel)) {
      return NextResponse.json({ error: 'Canal inválido' }, { status: 400 });
    }
    if (!VALID_INTENTS.includes(intent)) {
      return NextResponse.json({ error: 'Intenção inválida' }, { status: 400 });
    }

    const admin = getAdminClient();

    // Fetch contact
    const { data: contact, error: contactError } = await admin
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 });
    }

    // Fetch recent interactions (last 5)
    const { data: interactions } = await admin
      .from('interactions')
      .select('type, outcome, note, happened_at')
      .eq('contact_id', contact_id)
      .eq('organization_id', profile.organization_id)
      .order('happened_at', { ascending: false })
      .limit(5);

    // Build prompt
    const prompt = buildMessagePrompt({
      channel,
      intent,
      contactName: contact.name,
      contactCompany: contact.company,
      contactStatus: contact.status,
      sellerName: profile.name,
      recentInteractions: interactions || [],
    });

    // Call OpenAI
    const message = await chatCompletion({
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      maxTokens: 500,
      temperature: 0.7,
    });

    // Parse email subject if present
    let subject: string | undefined;
    let messageBody = message;
    if (channel === 'email') {
      const subjectMatch = message.match(/^Assunto:\s*(.+?)(?:\n|$)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        messageBody = message.replace(/^Assunto:\s*.+?\n+/i, '').trim();
      }
    }

    return NextResponse.json({
      channel,
      intent,
      subject,
      body: messageBody,
    });
  } catch (error: any) {
    console.error('Error generating message:', error);
    if (error.message?.includes('OPENAI_API_KEY')) {
      return NextResponse.json({ error: 'Chave da OpenAI não configurada. Adicione OPENAI_API_KEY nas variáveis de ambiente.' }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
