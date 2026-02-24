'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PipelineCustomField, ContactCustomFieldValue } from '@/lib/types';

interface CustomFieldsDisplayProps {
  pipelineId: string;
  contactId: string;
}

export default function CustomFieldsDisplay({ pipelineId, contactId }: CustomFieldsDisplayProps) {
  const [fields, setFields] = useState<PipelineCustomField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [fieldsRes, valuesRes] = await Promise.all([
        fetch(`/api/pipelines/${pipelineId}/custom-fields`),
        fetch(`/api/contacts/${contactId}/custom-fields`),
      ]);
      if (fieldsRes.ok) setFields(await fieldsRes.json());
      if (valuesRes.ok) {
        const data: ContactCustomFieldValue[] = await valuesRes.json();
        const valMap: Record<string, any> = {};
        for (const v of data) {
          if (v.value_text !== null) valMap[v.field_id] = v.value_text;
          else if (v.value_number !== null) valMap[v.field_id] = v.value_number;
          else if (v.value_date !== null) valMap[v.field_id] = v.value_date?.split('T')[0];
          else if (v.value_boolean !== null) valMap[v.field_id] = v.value_boolean;
        }
        setValues(valMap);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [pipelineId, contactId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;
  if (fields.length === 0) return null;

  const filledFields = fields.filter(f => values[f.id] !== undefined && values[f.id] !== null && values[f.id] !== '');
  if (filledFields.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-purple-300/70 uppercase tracking-wider">Campos Personalizados</h4>
      <div className="grid grid-cols-2 gap-2">
        {filledFields.map(field => (
          <div key={field.id} className="bg-[#2a1245]/30 rounded-lg px-3 py-2">
            <span className="text-[10px] text-purple-300/50 block">{field.name}</span>
            <span className="text-sm text-neutral-200">
              {field.field_type === 'boolean'
                ? (values[field.id] ? 'Sim' : 'Nao')
                : field.field_type === 'date' && values[field.id]
                  ? new Date(values[field.id] + 'T00:00:00').toLocaleDateString('pt-BR')
                  : field.field_type === 'number'
                    ? Number(values[field.id]).toLocaleString('pt-BR')
                    : String(values[field.id])
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
