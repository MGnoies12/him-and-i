import { PersonalizationScreen } from '@/components/features/personalization';
import { safeRedirect } from '@/lib/config';
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return <PersonalizationScreen next={safeRedirect(params.next)} />;
}
