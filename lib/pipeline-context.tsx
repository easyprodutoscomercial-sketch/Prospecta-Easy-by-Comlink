'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { PipelineWithStages } from '@/lib/types';

interface PipelineContextValue {
  pipelines: PipelineWithStages[];
  selectedPipelineId: string;
  setSelectedPipelineId: (id: string) => void;
  currentPipeline: PipelineWithStages | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const PipelineContext = createContext<PipelineContextValue>({
  pipelines: [],
  selectedPipelineId: '',
  setSelectedPipelineId: () => {},
  currentPipeline: null,
  loading: true,
  refetch: async () => {},
});

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [pipelines, setPipelines] = useState<PipelineWithStages[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch('/api/pipelines');
      if (res.ok) {
        const data = await res.json();
        const list: PipelineWithStages[] = data.pipelines || [];
        setPipelines(list);

        // Auto-select: keep current if still valid, otherwise default
        setSelectedPipelineId((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          const def = list.find((p) => p.is_default) || list[0];
          return def?.id || '';
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const currentPipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0] || null;

  return (
    <PipelineContext.Provider
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
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  return useContext(PipelineContext);
}
