import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/sidebar';

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="min-h-screen bg-white">
      <Sidebar profileName={profile?.name ?? null} signOutAction={handleSignOut} />

      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="px-6 py-8 lg:px-10 lg:py-10 max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
