import { notFound } from 'next/navigation';
import { InviteScreen } from '@/components/features/invite';
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  return <InviteScreen token={token} />;
}
