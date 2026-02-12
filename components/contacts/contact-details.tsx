'use client';

import { Contact } from '@/lib/types';
import {
  CONTACT_TYPE_LABELS,
  CONTACT_TYPE_COLORS,
  CLASSE_LABELS,
  TEMPERATURA_LABELS,
  TEMPERATURA_COLORS,
  ORIGEM_LABELS,
  PROXIMA_ACAO_LABELS,
} from '@/lib/utils/labels';

interface ContactDetailsProps {
  contact: Contact;
}

function FieldValue({ value, placeholder = 'Nao informado' }: { value: string | null | undefined; placeholder?: string }) {
  if (value && value.trim() !== '') return <p className="text-sm font-medium text-neutral-100">{value}</p>;
  return <p className="text-sm text-neutral-600 italic">{placeholder}</p>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-purple-300/80 font-semibold mb-0.5">{children}</p>;
}

function Section({ title, children, noBorder }: { title: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div className={noBorder ? '' : 'pb-5 border-b border-purple-800/30'}>
      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function ContactDetails({ contact }: ContactDetailsProps) {
  return (
    <div className="space-y-6">
      <Section title="Dados Basicos">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Nome</Label><FieldValue value={contact.name} /></div>
          <div><Label>Empresa</Label><FieldValue value={contact.company} /></div>
          <div><Label>Email</Label><FieldValue value={contact.email} /></div>
          <div><Label>Telefone</Label><FieldValue value={contact.phone} /></div>
          <div><Label>WhatsApp</Label><FieldValue value={contact.whatsapp} /></div>
          <div><Label>CPF</Label><FieldValue value={contact.cpf} /></div>
          <div><Label>CNPJ</Label><FieldValue value={contact.cnpj} /></div>
          <div><Label>Referencia</Label><FieldValue value={contact.referencia} /></div>
        </div>
      </Section>

      <Section title="Tipo e Classificacao">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            {contact.tipo && contact.tipo.length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {contact.tipo.map((t) => (
                  <span key={t} className={`px-2 py-0.5 text-xs font-medium rounded-full ${CONTACT_TYPE_COLORS[t] || 'bg-[#2a1245] text-neutral-400'}`}>
                    {CONTACT_TYPE_LABELS[t] || t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-600 italic">Nao informado</p>
            )}
          </div>
          <div><Label>Classe</Label><FieldValue value={contact.classe ? (CLASSE_LABELS[contact.classe] || contact.classe) : null} /></div>
          <div className="sm:col-span-2"><Label>Produtos Fornecidos</Label><FieldValue value={contact.produtos_fornecidos} /></div>
        </div>
      </Section>

      <Section title="Pessoa de Contato">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Nome do Contato</Label><FieldValue value={contact.contato_nome} /></div>
          <div><Label>Cargo</Label><FieldValue value={contact.cargo} /></div>
        </div>
      </Section>

      <Section title="Endereco">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Label>Endereco</Label><FieldValue value={contact.endereco} /></div>
          <div><Label>Cidade</Label><FieldValue value={contact.cidade} /></div>
          <div><Label>Estado</Label><FieldValue value={contact.estado} /></div>
          <div><Label>CEP</Label><FieldValue value={contact.cep} /></div>
        </div>
      </Section>

      <Section title="Presenca Digital">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Website</Label><FieldValue value={contact.website} /></div>
          <div><Label>Instagram</Label><FieldValue value={contact.instagram} /></div>
        </div>
      </Section>

      <Section title="Qualificacao">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Temperatura</Label>
            {contact.temperatura ? (
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${TEMPERATURA_COLORS[contact.temperatura] || ''}`}>
                {TEMPERATURA_LABELS[contact.temperatura] || contact.temperatura}
              </span>
            ) : (
              <p className="text-sm text-neutral-600 italic">Nao informado</p>
            )}
          </div>
          <div><Label>Origem</Label><FieldValue value={contact.origem ? (ORIGEM_LABELS[contact.origem] || contact.origem) : null} /></div>
          <div><Label>Proxima Acao</Label><FieldValue value={contact.proxima_acao_tipo ? (PROXIMA_ACAO_LABELS[contact.proxima_acao_tipo] || contact.proxima_acao_tipo) : null} /></div>
          <div><Label>Data Proxima Acao</Label><FieldValue value={contact.proxima_acao_data ? new Date(contact.proxima_acao_data).toLocaleString('pt-BR') : null} /></div>
          <div>
            <Label>Valor Estimado</Label>
            {contact.valor_estimado != null && contact.valor_estimado > 0 ? (
              <p className="text-sm font-bold text-emerald-400">
                {contact.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            ) : (
              <p className="text-sm text-neutral-600 italic">Nao informado</p>
            )}
          </div>
          <div><Label>Motivo Ganho/Perdido</Label><FieldValue value={contact.motivo_ganho_perdido} /></div>
        </div>
      </Section>

      <Section title="Observacoes" noBorder>
        <FieldValue value={contact.notes} placeholder="Sem observacoes" />
      </Section>
    </div>
  );
}
