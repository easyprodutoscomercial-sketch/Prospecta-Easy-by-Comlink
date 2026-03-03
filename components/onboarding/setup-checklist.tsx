'use client';

import { useState, useEffect } from 'react';

interface ChecklistStep {
  key: string;
  label: string;
  completed: boolean;
}

export function SetupChecklist() {
  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('onboarding_dismissed');
    if (stored === 'true') { setDismissed(true); setLoading(false); return; }

    const fetchChecklist = async () => {
      try {
        const res = await fetch('/api/onboarding/checklist');
        if (res.ok) {
          const data = await res.json();
          setSteps(data.steps);
          setCompletedCount(data.completedCount);
          setTotalCount(data.totalCount);
          setAllDone(data.allDone);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchChecklist();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setDismissed(true);
  };

  if (loading || dismissed || allDone) return null;

  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="mb-6 bg-[#1e0f35] border border-purple-800/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-neutral-100">Configuracao Inicial</h3>
          <p className="text-xs text-purple-300/50 mt-0.5">{completedCount} de {totalCount} concluidos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-1.5 bg-purple-800/30 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-bold text-emerald-400">{pct}%</span>
          <button onClick={handleDismiss} className="text-purple-300/30 hover:text-purple-300/60 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              step.completed ? 'bg-emerald-500' : 'bg-purple-800/30'
            }`}>
              {step.completed && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`text-xs ${step.completed ? 'text-purple-300/40 line-through' : 'text-neutral-200'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
