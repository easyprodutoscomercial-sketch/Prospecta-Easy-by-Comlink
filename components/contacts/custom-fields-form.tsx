'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { PipelineCustomField, ContactCustomFieldValue } from '@/lib/types';

interface CustomFieldsFormProps {
  pipelineId: string;
  contactId?: string;
  onChange?: (values: Record<string, any>) => void;
}

export interface CustomFieldsFormRef {
  getValues: () => { field_id: string; value_text?: string; value_number?: number; value_date?: string; value_boolean?: boolean }[];
  save: (contactId: string) => Promise<void>;
}

const CustomFieldsForm = forwardRef<CustomFieldsFormRef, CustomFieldsFormProps>(
  function CustomFieldsForm({ pipelineId, contactId, onChange }, ref) {
    const [fields, setFields] = useState<PipelineCustomField[]>([]);
    const [values, setValues] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    const loadFields = useCallback(async () => {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}/custom-fields`);
        if (res.ok) {
          const data = await res.json();
          setFields(data);
        }
      } catch { /* ignore */ }
    }, [pipelineId]);

    const loadValues = useCallback(async () => {
      if (!contactId) return;
      try {
        const res = await fetch(`/api/contacts/${contactId}/custom-fields`);
        if (res.ok) {
          const data: ContactCustomFieldValue[] = await res.json();
          const valMap: Record<string, any> = {};
          for (const v of data) {
            if (v.value_text !== null) valMap[v.field_id] = v.value_text;
            else if (v.value_number !== null) valMap[v.field_id] = v.value_number;
            else if (v.value_date !== null) valMap[v.field_id] = v.value_date;
            else if (v.value_boolean !== null) valMap[v.field_id] = v.value_boolean;
          }
          setValues(valMap);
        }
      } catch { /* ignore */ }
    }, [contactId]);

    useEffect(() => {
      setLoading(true);
      Promise.all([loadFields(), loadValues()]).finally(() => setLoading(false));
    }, [loadFields, loadValues]);

    const handleChange = useCallback((fieldId: string, value: any) => {
      setValues(prev => {
        const next = { ...prev, [fieldId]: value };
        onChange?.(next);
        return next;
      });
    }, [onChange]);

    const getFormValues = useCallback(() => {
      return fields.map(f => {
        const val = values[f.id];
        const entry: any = { field_id: f.id };
        switch (f.field_type) {
          case 'text':
          case 'select':
            entry.value_text = val ?? null;
            break;
          case 'number':
            entry.value_number = val !== undefined && val !== '' ? Number(val) : null;
            break;
          case 'date':
            entry.value_date = val ?? null;
            break;
          case 'boolean':
            entry.value_boolean = val ?? null;
            break;
        }
        return entry;
      });
    }, [fields, values]);

    const save = useCallback(async (cId: string) => {
      const formValues = getFormValues();
      await fetch(`/api/contacts/${cId}/custom-fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: formValues }),
      });
    }, [getFormValues]);

    useImperativeHandle(ref, () => ({
      getValues: getFormValues,
      save,
    }), [getFormValues, save]);

    if (loading) return null;
    if (fields.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-purple-300/70 uppercase tracking-wider">Campos Personalizados</h4>
        {fields.map(field => (
          <div key={field.id}>
            <label className="block text-xs text-purple-300/60 mb-1">
              {field.name}
              {field.is_required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {field.field_type === 'text' && (
              <input
                type="text"
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              />
            )}
            {field.field_type === 'number' && (
              <input
                type="number"
                value={values[field.id] ?? ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              />
            )}
            {field.field_type === 'date' && (
              <input
                type="date"
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              />
            )}
            {field.field_type === 'select' && (
              <select
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#2a1245] border border-purple-800/30 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="">Selecione...</option>
                {(field.options || []).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {field.field_type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!values[field.id]}
                  onChange={(e) => handleChange(field.id, e.target.checked)}
                  className="rounded border-purple-800/30 bg-[#2a1245] text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className="text-sm text-neutral-300">{values[field.id] ? 'Sim' : 'Nao'}</span>
              </label>
            )}
          </div>
        ))}
      </div>
    );
  }
);

export default CustomFieldsForm;
