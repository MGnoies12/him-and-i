import { AuthScreen } from '@/components/features/auth';
import { safeRedirect } from '@/lib/config';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return <AuthScreen mode="reset" next={safeRedirect(params.next)} errorCode={params.error} />;
}
