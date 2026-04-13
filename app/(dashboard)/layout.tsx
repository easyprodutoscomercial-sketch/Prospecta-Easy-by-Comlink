import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import { ensureProfile } from '@/lib/ensure-profile';
import { Providers } from '@/components/providers';
import DashboardBanner from '@/components/dashboard-banner';
import CommandPalette from '@/components/command-palette';
import { ProductTour } from '@/components/onboarding/product-tour';
import OfflineIndicator from '@/components/offline/offline-indicator';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await ensureProfile(supabase, user);

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="min-h-screen bg-[#1a0a2e]">
      {/* Skip to content - accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium">
        Pular para o conteudo
      </a>
      <Sidebar profileName={profile?.name ?? null} userRole={profile?.role ?? 'user'} visibleMenus={profile?.visible_menus ?? []} signOutAction={handleSignOut} />

      <main id="main-content" className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <DashboardBanner />
        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 max-w-[1600px]">
          <Providers>
            {children}
            <ProductTour />
          </Providers>
        </div>
      </main>
      <CommandPalette />
      <OfflineIndicator />
    </div>
  );
}
