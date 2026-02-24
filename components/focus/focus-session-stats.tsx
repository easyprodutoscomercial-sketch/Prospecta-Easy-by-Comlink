'use client';

import { useState, useEffect } from 'react';

interface FocusSessionStatsProps {
  contactsCalled: number;
  answeredCount: number;
  meetingsBooked: number;
  sessionStartTime: Date;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function FocusSessionStats({
  contactsCalled,
  answeredCount,
  meetingsBooked,
  sessionStartTime,
}: FocusSessionStatsProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const computeElapsed = () => {
      const diff = Math.floor((Date.now() - sessionStartTime.getTime()) / 1000);
      setElapsed(Math.max(0, diff));
    };

    computeElapsed();
    const interval = setInterval(computeElapsed, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const answerRate =
    contactsCalled > 0
      ? Math.round((answeredCount / contactsCalled) * 100)
      : 0;

  const stats = [
    {
      label: 'Contatos',
      value: String(contactsCalled),
      color: 'text-purple-300',
      bgColor: 'bg-purple-500/10',
      icon: (
        <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Taxa Atend.',
      value: `${answerRate}%`,
      color: answerRate >= 50 ? 'text-emerald-400' : answerRate >= 25 ? 'text-amber-400' : 'text-red-400',
      bgColor: answerRate >= 50 ? 'bg-emerald-500/10' : answerRate >= 25 ? 'bg-amber-500/10' : 'bg-red-500/10',
      icon: (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Reunioes',
      value: String(meetingsBooked),
      color: meetingsBooked > 0 ? 'text-cyan-400' : 'text-neutral-400',
      bgColor: meetingsBooked > 0 ? 'bg-cyan-500/10' : 'bg-neutral-500/10',
      icon: (
        <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Tempo',
      value: formatElapsed(elapsed),
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      icon: (
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-purple-800/20 ${stat.bgColor}`}
        >
          {stat.icon}
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-bold tabular-nums ${stat.color}`}>
              {stat.value}
            </span>
            <span className="text-[10px] text-purple-300/40 font-medium">
              {stat.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
