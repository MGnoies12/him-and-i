import { redirect } from 'next/navigation';
import { getWorkspace } from '@/lib/server/workspace';
import { Landing } from '@/components/features/landing';
export default async function Page() {
  const workspace = await getWorkspace();
  if (workspace.userId) redirect('/home');
  return <Landing />;
}
