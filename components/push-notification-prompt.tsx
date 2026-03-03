'use client';

import { useState, useEffect } from 'react';

export function PushNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Only show if push API is available, not already subscribed, and not dismissed
    if (typeof window === 'undefined' || !('PushManager' in window)) return;
    if (localStorage.getItem('push_prompt_dismissed') === 'true') return;

    // Check current permission
    if (Notification.permission === 'granted') return; // already granted
    if (Notification.permission === 'denied') return; // user already denied

    setShow(true);
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setShow(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        console.warn('VAPID key not configured');
        setShow(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const sub = subscription.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      });

      setShow(false);
    } catch (err) {
      console.error('Push subscription error:', err);
    }
    setSubscribing(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('push_prompt_dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mb-4 bg-[#1e0f35] border border-emerald-500/20 rounded-lg p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-200 font-medium">Ativar notificacoes push?</p>
        <p className="text-[10px] text-purple-300/50">Receba alertas mesmo quando o app estiver fechado</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-500 disabled:opacity-40 transition-colors"
        >
          {subscribing ? '...' : 'Ativar'}
        </button>
        <button
          onClick={handleDismiss}
          className="px-2 py-1.5 text-xs text-purple-300/40 hover:text-purple-300/60 transition-colors"
        >
          Agora nao
        </button>
      </div>
    </div>
  );
}
