'use client';

import Link from 'next/link';
import { Notification } from '@/lib/ai/types';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  RISK_ALERT: { icon: '!', color: 'text-red-400', bg: 'bg-red-500/20' },
  NEXT_ACTION: { icon: '>', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  COACHING_TIP: { icon: '*', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  TASK_OVERDUE: { icon: '!', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  STALE_DEAL: { icon: '~', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  NO_OWNER: { icon: '?', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  SYSTEM: { icon: 'i', color: 'text-neutral-400', bg: 'bg-neutral-500/20' },
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationItem({ notification, onMarkRead, onDismiss }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.SYSTEM;

  const content = (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        notification.read ? 'opacity-60' : 'bg-purple-500/5'
      } hover:bg-purple-500/10`}
    >
      {/* Icon */}
      <div className={`shrink-0 w-7 h-7 rounded-full ${config.bg} flex items-center justify-center`}>
        <span className={`text-xs font-bold ${config.color}`}>{config.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${notification.read ? 'text-neutral-400' : 'text-white'} truncate`}>
          {notification.title}
        </p>
        <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{notification.body}</p>
        <span className="text-[10px] text-neutral-600 mt-1 block">{timeAgo(notification.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-col gap-1">
        {!notification.read && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMarkRead(notification.id); }}
            className="text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors"
            title="Marcar como lida"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(notification.id); }}
          className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
          title="Dispensar"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );

  if (notification.contact_id) {
    return <Link href={`/contacts/${notification.contact_id}`}>{content}</Link>;
  }

  return content;
}
