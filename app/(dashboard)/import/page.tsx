'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useContactPreferences } from '@/lib/hooks/use-contact-preferences';

export default function ImportPage() {
  const router = useRouter();
  const { setActiveView } = useContactPreferences();

  useEffect(() => {
    setActiveView('import');
    router.replace('/contacts');
  }, []);

  return null;
}
