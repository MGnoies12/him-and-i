import { LettersScreen } from '@/components/features/letters';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string }>;
}) {
  return <LettersScreen composeInitially={(await searchParams).compose === '1'} />;
}
