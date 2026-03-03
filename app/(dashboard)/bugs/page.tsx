import { redirect } from 'next/navigation';

export default function BugsRedirect() {
  redirect('/suporte?ticket_type=BUG');
}
