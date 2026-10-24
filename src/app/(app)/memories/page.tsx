import { MemoriesScreen } from '@/components/features/memories';
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <MemoriesScreen initialSearch={(await searchParams).q || ''} />;
}
