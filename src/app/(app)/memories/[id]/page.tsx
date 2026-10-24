import { MemoryDetailScreen } from '@/components/features/memories';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MemoryDetailScreen id={(await params).id} />;
}
