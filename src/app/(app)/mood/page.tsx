import { MoodScreen } from '@/components/features/mood';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ select?: string }>;
}) {
  return <MoodScreen initialMood={(await searchParams).select} />;
}
