import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const SAMPLE_CONTACTS = [
  { name: 'João Silva', phone: '(11) 99999-0001', email: 'joao@empresa.com', company: 'Tech Solutions', status: 'EM_PROSPECCAO', notes: 'Interessado no plano enterprise' },
  { name: 'Maria Souza', phone: '(21) 98888-0002', email: 'maria@startup.io', company: 'Startup XYZ', status: 'REUNIAO_MARCADA', notes: 'Reunião marcada para sexta-feira' },
  { name: 'Pedro Santos', phone: '(31) 97777-0003', email: 'pedro@corp.com.br', company: 'Corp Brasil', status: 'CONVERTIDO', notes: 'Fechou contrato anual' },
  { name: 'Ana Costa', phone: '(41) 96666-0004', email: 'ana@digital.com', company: 'Digital Agency', status: 'CONTATADO', notes: 'Respondeu email, aguardando proposta' },
  { name: 'Carlos Lima', phone: '(51) 95555-0005', email: 'carlos@vendas.com', company: 'Vendas Pro', status: 'NOVO', notes: 'Lead via LinkedIn' },
  { name: 'Fernanda Oliveira', phone: '(61) 94444-0006', email: 'fernanda@mkt.com', company: 'Marketing Plus', status: 'EM_PROSPECCAO', notes: 'Segundo follow-up enviado' },
  { name: 'Ricardo Mendes', phone: '(71) 93333-0007', email: 'ricardo@invest.com', company: 'Invest Capital', status: 'PERDIDO', notes: 'Escolheu concorrente' },
  { name: 'Juliana Ferreira', phone: '(81) 92222-0008', email: 'juliana@edu.com.br', company: 'EduTech', status: 'REUNIAO_MARCADA', notes: 'Demo agendada para terça' },
  { name: 'Lucas Almeida', phone: '(91) 91111-0009', email: 'lucas@log.com', company: 'LogBrasil', status: 'CONTATADO', notes: 'Ligação realizada, interessado' },
  { name: 'Beatriz Rocha', phone: '(11) 90000-0010', email: 'beatriz@saude.com', company: 'Saúde Total', status: 'CONVERTIDO', notes: 'Contrato assinado ontem' },
];

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const created = [];

    for (const contact of SAMPLE_CONTACTS) {
      const nameNormalized = contact.name.toLowerCase().trim();
      const emailNormalized = contact.email.toLowerCase().trim();
      const phoneNormalized = contact.phone.replace(/\D/g, '');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          organization_id: profile.organization_id,
          name: contact.name,
          name_normalized: nameNormalized,
          phone: contact.phone,
          phone_normalized: phoneNormalized,
          email: contact.email,
          email_normalized: emailNormalized,
          company: contact.company,
          status: contact.status,
          notes: contact.notes,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (data) created.push(data.name);
      if (error) console.error(`Error inserting ${contact.name}:`, error.message);
    }

    return NextResponse.json({ message: `${created.length} contatos criados`, created });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
