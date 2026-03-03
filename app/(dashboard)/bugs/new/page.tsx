import { redirect } from 'next/navigation';

export default function BugNewRedirect() {
  redirect('/suporte/new?type=BUG');
}
