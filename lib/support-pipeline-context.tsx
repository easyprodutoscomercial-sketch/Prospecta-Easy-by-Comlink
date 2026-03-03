'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PipelineWithStages } from '@/lib/types';

interface SupportPipelineContextValue {
  pipelines: PipelineWithStages[];
  selectedPipelineId: string;
  setSelectedPipelineId: (id: string) => void;
  currentPipeline: PipelineWithStages | null;
  loading: boolean;
  refetch: () => Promise<PipelineWithStages[] | void>;
}

const SupportPipelineContext = createContext<SupportPipelineContextValue>({
  pipelines: [],
  selectedPipelineId: '',
  setSelectedPipelineId: () => {},
  currentPipeline: null,
  loading: true,
  refetch: async () => {},
});

export function SupportPipelineProvider({ children }: { children: ReactNode }) {
  const [pipelines, setPipelines] = useState<PipelineWithStages[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [setupAttempted, setSetupAttempted] = useState(false);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch('/api/pipelines?type=SUPORTE');
      if (res.ok) {
        const data = await res.json();
        const list: PipelineWithStages[] = data.pipelines || [];
        setPipelines(list);

        setSelectedPipelineId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          const def = list.find((p) => p.is_default) || list[0];
          return def?.id || '';
        });

        return list;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
    return [];
  }, []);

  useEffect(() => {
    const init = async () => {
      const list = await fetchPipelines();
      // If no SUPORTE pipeline exists, auto-create one
      if (list.length === 0 && !setupAttempted) {
        setSetupAttempted(true);
        try {
          const res = await fetch('/api/suporte/setup-pipeline', { method: 'POST' });
          if (res.ok) {
            await fetchPipelines();
          }
        } catch {
          // silent
        }
      }
    };
    init();
  }, [fetchPipelines, setupAttempted]);

  const currentPipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0] || null;

  return (
    <SupportPipelineContext.Provider
      value={{
        pipelines,
        selectedPipelineId,
        setSelectedPipelineId,
        currentPipeline,
        loading,
        refetch: fetchPipelines,
      }}
    >
      {children}
    </SupportPipelineContext.Provider>
  );
}

export function useSupportPipeline() {
  return useContext(SupportPipelineContext);
}
