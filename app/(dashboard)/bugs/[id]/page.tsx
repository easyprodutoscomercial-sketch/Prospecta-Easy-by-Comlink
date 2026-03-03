import { redirect } from 'next/navigation';

export default async function BugDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/suporte/${id}`);
}
