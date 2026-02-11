import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import { ensureProfile } from '@/lib/ensure-profile';
import { Providers } from '@/components/providers';

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
      <Sidebar profileName={profile?.name ?? null} userRole={profile?.role ?? 'user'} signOutAction={handleSignOut} />

      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 max-w-6xl">
          <Providers>{children}</Providers>
        </div>
      </main>
    </div>
  );
}
