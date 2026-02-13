'use client';

import { useEffect, useState } from 'react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  user_name: string;
  created_at: string;
}

export default function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [expired, setExpired] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      if (!res.ok) return;
      const data = await res.json();
      setAnnouncements(data.announcements || []);
      setEnabled(data.enabled ?? false);
      if (data.duration_minutes) setDurationMinutes(data.duration_minutes);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide after configured duration
  useEffect(() => {
    if (!enabled || announcements.length === 0) return;
    const timer = setTimeout(() => setExpired(true), durationMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [enabled, announcements.length, durationMinutes]);

  if (!enabled || announcements.length === 0 || expired) return null;

  const messages = announcements.map(
    (a) => `Informacao importante: ${a.user_name} — ${a.title}`
  );

  const tickerText = messages.join('     \u2022     ');

  return (
    <div className="relative overflow-hidden bg-[#0d0620]/90 border-b border-cyan-500/20 py-2">
      <div className="flex items-center gap-3 px-4">
        {/* Icon */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">Avisos</span>
        </div>

        {/* Marquee */}
        <div className="flex-1 overflow-hidden">
          <div className="ticker-track" style={{ animationDuration: `${Math.max(20, messages.length * 10)}s` }}>
            <span className="ticker-content text-xs font-medium text-emerald-300/90">
              {tickerText}
            </span>
            <span className="ticker-content text-xs font-medium text-emerald-300/90">
              {'     \u2022     '}{tickerText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
