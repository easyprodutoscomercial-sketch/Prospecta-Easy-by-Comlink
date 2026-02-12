'use client';

import NotificationBell from '@/components/notifications/notification-bell';

interface TopBarProps {
  userRole: string;
  profileName: string | null;
}

export default function TopBar({ userRole, profileName }: TopBarProps) {
  return (
    <div className="hidden lg:flex fixed top-0 left-64 right-0 z-30 h-12 bg-[#120826]/80 backdrop-blur-md border-b border-purple-800/15 items-center justify-end px-6 gap-4">
      {/* Right side */}
      <div className="flex items-center gap-4">
        {userRole === 'admin' && (
          <span className="text-[10px] text-emerald-400/50 font-bold uppercase tracking-wider">Admin</span>
        )}
        <NotificationBell />
      </div>
    </div>
  );
}
