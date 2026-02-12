'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PROXIMA_ACAO_LABELS } from '@/lib/utils/labels';

interface Task {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  proxima_acao_tipo: string | null;
  proxima_acao_data: string;
  status: string;
  temperatura: string | null;
}

function getTaskUrgency(date: string): { label: string; color: string; bgColor: string } {
  const now = new Date();
  const taskDate = new Date(date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDay = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

  if (taskDay < today) {
    return { label: 'Atrasado', color: 'text-red-400', bgColor: 'bg-red-500/15 border-red-500/20' };
  }
  if (taskDay.getTime() === today.getTime()) {
    return { label: 'Hoje', color: 'text-amber-400', bgColor: 'bg-amber-500/15 border-amber-500/20' };
  }
  return { label: `${Math.ceil((taskDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}d`, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15 border-emerald-500/20' };
}

export default function DailyTasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks/pending');
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchTasks();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#1e0f35] border border-purple-800/30 rounded-lg p-5 mb-8 animate-pulse">
        <div className="h-5 bg-purple-800/30 rounded w-40 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-purple-800/20 rounded" />
          <div className="h-12 bg-purple-800/20 rounded" />
        </div>
      </div>
    );
  }

  if (tasks.length === 0) return null;

  const overdue = tasks.filter((t) => {
    const d = new Date(t.proxima_acao_data);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }).length;

  return (
    <div className="bg-[#1e0f35] border border-amber-500/20 rounded-xl p-5 mb-8 shadow-lg shadow-amber-900/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-white">Minhas Tarefas</h3>
          <span className="text-xs font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">{tasks.length}</span>
          {overdue > 0 && (
            <span className="text-xs font-bold bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full animate-pulse badge-glow">{overdue} atrasada{overdue > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {tasks.map((task) => {
          const urgency = getTaskUrgency(task.proxima_acao_data);
          return (
            <Link
              key={task.id}
              href={`/contacts/${task.id}`}
              className={`block p-3 rounded-lg border transition-colors hover:bg-purple-800/20 ${urgency.bgColor}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100 truncate">{task.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.proxima_acao_tipo && (
                      <span className="text-[10px] text-purple-300/60">
                        {PROXIMA_ACAO_LABELS[task.proxima_acao_tipo as keyof typeof PROXIMA_ACAO_LABELS] || task.proxima_acao_tipo}
                      </span>
                    )}
                    {task.company && <span className="text-[10px] text-purple-300/40">{task.company}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${urgency.color}`}>
                    {urgency.label}
                  </span>
                  <span className="text-[10px] text-purple-300/40">
                    {new Date(task.proxima_acao_data).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
