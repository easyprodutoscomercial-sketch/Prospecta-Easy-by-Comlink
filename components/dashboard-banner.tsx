'use client';

import { useEffect, useState, useCallback } from 'react';
import { PICK_ME_PHRASES } from '@/lib/utils/pick-me-phrases';
import { getUserColor, getUserInitials } from '@/lib/utils/user-colors';

interface Announcement {
  id: string;
  title: string;
  category: string; // meeting_urgent | meeting_today | meeting_tomorrow | personal | org
}

interface RunnerUser {
  name: string;
  avatar_url: string | null;
  color: { bg: string; text: string };
}

// Cores por categoria — cada tipo de mensagem tem sua cor
const CATEGORY_COLORS: Record<string, string> = {
  meeting_urgent: '#f43f5e',   // vermelho/rose — URGENTE
  meeting_today: '#22d3ee',    // cyan — reunioes de hoje
  meeting_tomorrow: '#a78bfa', // violeta — reunioes de amanha
  personal: '#fb923c',         // laranja — pessoal do usuario
  org: '#34d399',              // verde — org geral
};

const CATEGORY_LABELS: Record<string, string> = {
  meeting_urgent: 'URGENTE',
  meeting_today: 'AGENDA',
  meeting_tomorrow: 'AMANHA',
  personal: 'PARA VOCE',
  org: 'AVISO',
};

const RUN_DURATION = 10;

export default function DashboardBanner() {
  // === Announcement / Ticker state ===
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tickerEnabled, setTickerEnabled] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [tickerExpired, setTickerExpired] = useState(false);
  const [latestAnnouncementId, setLatestAnnouncementId] = useState('');

  // === Avatar runner state ===
  const [users, setUsers] = useState<RunnerUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [runKey, setRunKey] = useState(0);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements');
      if (!res.ok) return;
      const data = await res.json();
      const ann: Announcement[] = data.announcements || [];
      setAnnouncements(ann);
      setTickerEnabled(data.enabled ?? false);
      if (data.duration_minutes) setDurationMinutes(data.duration_minutes);
      // Reativar ticker quando chegam novas notificacoes
      const newLatestId = ann.length > 0 ? ann.map(a => a.id).join(',') : '';
      setLatestAnnouncementId((prev) => {
        if (prev && newLatestId && newLatestId !== prev) {
          setTickerExpired(false);
        }
        return newLatestId;
      });
    } catch {
      // silent
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) return;
      const data = await res.json();
      const list: RunnerUser[] = (data.users || []).map((u: any) => ({
        name: u.name,
        avatar_url: u.avatar_url || null,
        color: getUserColor(u.user_id),
      }));
      setUsers(list);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
    fetchUsers();
    const interval = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements, fetchUsers]);

  // Ticker auto-expire
  useEffect(() => {
    if (!tickerEnabled || announcements.length === 0) return;
    setTickerExpired(false);
    const timer = setTimeout(() => setTickerExpired(true), durationMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [tickerEnabled, announcements.length, durationMinutes, latestAnnouncementId]);

  // Pick phrase for avatar runner
  useEffect(() => {
    setCurrentPhrase(PICK_ME_PHRASES[Math.floor(Math.random() * PICK_ME_PHRASES.length)]);
  }, [currentIndex, runKey]);

  const handleAnimationEnd = useCallback(() => {
    setCurrentIndex((prev) => (users.length > 0 ? (prev + 1) % users.length : 0));
    setRunKey((k) => k + 1);
  }, [users.length]);

  const showTicker = tickerEnabled && announcements.length > 0 && !tickerExpired;

  // === TICKER UI — cada mensagem com sua cor ===
  if (showTicker) {
    // Calcular duracao da animacao — mais lento pra dar tempo de ler
    const totalChars = announcements.reduce((sum, a) => sum + a.title.length, 0);
    const animDuration = Math.max(40, Math.min(180, totalChars * 0.5));

    return (
      <div className="relative overflow-hidden bg-[#0d0620]/90 border-b border-cyan-500/20 py-2">
        <div className="flex items-center gap-3 px-4">
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Avisos</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="ticker-track" style={{ animationDuration: `${animDuration}s` }}>
              {/* First copy */}
              <span className="ticker-content text-xs font-medium">
                {announcements.map((a, i) => {
                  const color = CATEGORY_COLORS[a.category] || '#86efac';
                  const label = CATEGORY_LABELS[a.category] || '';
                  return (
                    <span key={`${i}-${a.id}`}>
                      {i > 0 && <span className="text-purple-500/40 mx-3">|</span>}
                      {label && (
                        <span
                          className="text-[9px] font-black uppercase tracking-wider mr-1.5 px-1.5 py-0.5 rounded"
                          style={{ color: '#fff', backgroundColor: color + '30', borderLeft: `2px solid ${color}` }}
                        >
                          {label}
                        </span>
                      )}
                      <span style={{ color }}>{a.title}</span>
                    </span>
                  );
                })}
              </span>
              {/* Second copy for seamless loop */}
              <span className="ticker-content text-xs font-medium">
                <span className="text-purple-500/40 mx-3">|</span>
                {announcements.map((a, i) => {
                  const color = CATEGORY_COLORS[a.category] || '#86efac';
                  const label = CATEGORY_LABELS[a.category] || '';
                  return (
                    <span key={`dup-${i}-${a.id}`}>
                      {i > 0 && <span className="text-purple-500/40 mx-3">|</span>}
                      {label && (
                        <span
                          className="text-[9px] font-black uppercase tracking-wider mr-1.5 px-1.5 py-0.5 rounded"
                          style={{ color: '#fff', backgroundColor: color + '30', borderLeft: `2px solid ${color}` }}
                        >
                          {label}
                        </span>
                      )}
                      <span style={{ color }}>{a.title}</span>
                    </span>
                  );
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === AVATAR RUNNER UI ===
  if (users.length === 0) return null;

  const runner = users[currentIndex % users.length];

  return (
    <div className="relative overflow-hidden bg-[#0d0620]/60 border-b border-purple-500/10" style={{ height: '52px' }}>
      <div
        key={`runner-${currentIndex}-${runKey}`}
        className="absolute top-[2px] runner-avatar-track pointer-events-none"
        style={{ animation: `runner-across ${RUN_DURATION}s linear forwards` }}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg shadow-purple-900/40 border-2 border-white/20">
          {runner.avatar_url ? (
            <img src={runner.avatar_url} alt={runner.name} className="w-9 h-9 object-cover" />
          ) : (
            <div
              className="w-9 h-9 flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: runner.color.bg, color: runner.color.text }}
            >
              {getUserInitials(runner.name)}
            </div>
          )}
        </div>

        {/* Speech bubble — behind (left of) avatar */}
        <div
          className="runner-speech"
          style={{ animation: `runner-speech-pop ${RUN_DURATION}s linear forwards` }}
        >
          {currentPhrase}
        </div>

        {/* Legs */}
        <div className="flex gap-[4px] justify-center -mt-[1px]">
          <div
            className="w-[2px] h-[10px] rounded-full origin-top"
            style={{
              backgroundColor: runner.color.bg,
              animation: `runner-leg-l ${RUN_DURATION}s linear forwards`,
            }}
          />
          <div
            className="w-[2px] h-[10px] rounded-full origin-top"
            style={{
              backgroundColor: runner.color.bg,
              animation: `runner-leg-r ${RUN_DURATION}s linear forwards`,
            }}
          />
        </div>

        {/* Name */}
        <p className="text-[8px] text-emerald-400 font-bold whitespace-nowrap text-center mt-0.5">
          {runner.name.split(' ')[0]}
        </p>
      </div>
    </div>
  );
}
