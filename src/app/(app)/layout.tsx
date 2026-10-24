import { redirect } from 'next/navigation';
import { getWorkspace } from '@/lib/server/workspace';
import { AppShell } from '@/components/layout/app-shell';
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (workspace.configured && !workspace.userId) redirect('/login');
  return <AppShell>{children}</AppShell>;
}
