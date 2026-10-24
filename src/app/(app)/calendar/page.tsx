import { CalendarScreen } from '@/components/features/calendar';
export default async function Page({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  return <CalendarScreen createInitially={(await searchParams).new === '1'} />;
}
