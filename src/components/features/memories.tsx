'use client';
import { useDeferredValue, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Heart,
  CalendarDays,
  MapPin,
  Search,
  Grid2X2,
  List,
  Plus,
  PenLine,
  Trash2,
  ArrowUpRight,
  ImageIcon,
  Music2,
  LockKeyhole,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import {
  PageHeader,
  LinkButton,
  SetupNotice,
  MembershipNotice,
  Button,
  EmptyState,
  Field,
  Select,
  ErrorState,
  LoadingState,
  Modal,
  ConfirmButton,
  Badge,
} from '@/components/ui/primitives';
import { UploadField, PrivateMedia } from '@/components/ui/media';
import { useAction, useData } from '@/hooks/use-data';
import { memoryFields } from '@/schemas/actions';
import { requestJSON } from '@/lib/client-api';
import type { Asset, Memory } from '@/types/models';
import { formatDate, todayISO } from '@/lib/dates';
export const categories = [
  { id: 'everyday', fa: 'روزمره‌های قشنگ', en: 'Everyday' },
  { id: 'date', fa: 'قرارهای ما', en: 'Date nights' },
  { id: 'travel', fa: 'سفرها', en: 'Adventures' },
  { id: 'milestone', fa: 'روزهای خاص', en: 'Milestones' },
];
export function MemoryCard({ memory }: { memory: Memory }) {
  const { t, locale } = useI18n();
  const action = useAction();
  const cover = memory.memory_media.find((m) =>
    m.upload_assets?.mime_type.startsWith('image/'),
  )?.upload_assets;
  const favorite = memory.memory_favorites.length > 0;
  const category = categories.find((c) => c.id === memory.category);
  return (
    <article className="memory-card">
      <div className="memory-image-wrap">
        <Link href={`/memories/${memory.id}`} aria-label={memory.title}>
          {cover ? (
            <PrivateMedia asset={cover} alt={memory.title} className="memory-cover" />
          ) : (
            <div className="memory-cover memory-cover-placeholder">
              <Camera size={29} strokeWidth={1.1} />
              <span dir="ltr">a piece of us</span>
            </div>
          )}
        </Link>
        <button
          className={`icon-button favorite-button ${favorite ? 'active' : ''}`}
          aria-label={
            favorite
              ? t('حذف از محبوب‌ها', 'Remove favorite')
              : t('افزودن به محبوب‌ها', 'Add favorite')
          }
          aria-pressed={favorite}
          disabled={action.pending}
          onClick={() =>
            void action.run({ type: 'memory.favorite', id: memory.id, active: !favorite })
          }
        >
          <Heart size={15} />
        </button>
      </div>
      <div className="memory-card-body">
        <Link href={`/memories/${memory.id}`}>
          <h3>{memory.title}</h3>
        </Link>
        <div className="memory-card-meta">
          <span>
            <CalendarDays size={11} />
            {formatDate(memory.memory_date, locale, 'UTC', { year: undefined, month: 'short' })}
          </span>
          {category && <Badge>{t(category.fa, category.en)}</Badge>}
        </div>
      </div>
    </article>
  );
}
export function MemoriesScreen({ initialSearch = '' }: { initialSearch?: string }) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const [search, setSearch] = useState(initialSearch);
  const deferred = useDeferredValue(search);
  const [category, setCategory] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [view, setView] = useState<'grid' | 'timeline'>('grid');
  const query = useInfiniteQuery({
    queryKey: ['data', ws.userId, 'memories', deferred, category, favorites],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ q: deferred });
      if (category) params.set('category', category);
      if (favorites) params.set('favorites', '1');
      if (pageParam) params.set('cursor', pageParam);
      return (await requestJSON<{ data: Memory[] }>(`/api/data/memories?${params}`)).data;
    },
    getNextPageParam: (last) =>
      last.length === 24
        ? btoa(JSON.stringify({ at: last.at(-1)!.created_at, id: last.at(-1)!.id }))
        : undefined,
    enabled: ws.configured && !!ws.userId && !!ws.couple,
  });
  const memories = query.data?.pages.flat() || [];
  return (
    <>
      <PageHeader
        eyebrow="OUR MEMORY BOOK"
        title={t('خاطره‌های ما', 'Our memory book')}
        description={t(
          'لحظه‌های بزرگ و کوچک؛ همه‌شان بخشی از قصه‌ی ما هستند.',
          'The big days and the little moments. Every one is a piece of us.',
        )}
        action={
          <LinkButton href="/memories/new">
            <Plus size={17} />
            {t('یک خاطره‌ی تازه', 'New memory')}
          </LinkButton>
        }
      />
      <SetupNotice />
      <MembershipNotice />
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="search-input">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('دنبال کدام لحظه می‌گردی؟', 'Find a little moment…')}
              aria-label={t('جست‌وجوی خاطره', 'Search memories')}
            />
          </label>
          <button
            className={`icon-button ${favorites ? 'active' : ''}`}
            onClick={() => setFavorites(!favorites)}
            aria-pressed={favorites}
            aria-label={t('فقط محبوب‌ها', 'Favorites only')}
          >
            <Heart size={18} />
          </button>
        </div>
        <div className="view-toggle">
          <button
            className={`icon-button ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
            aria-label={t('نمای آلبوم', 'Gallery view')}
            aria-pressed={view === 'grid'}
          >
            <Grid2X2 size={17} />
          </button>
          <button
            className={`icon-button ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => setView('timeline')}
            aria-label={t('نمای خط زمانی', 'Timeline view')}
            aria-pressed={view === 'timeline'}
          >
            <List size={18} />
          </button>
        </div>
        <div className="filter-chips">
          <button
            className={`filter-chip ${!category ? 'active' : ''}`}
            onClick={() => setCategory('')}
          >
            {t('همه‌ی لحظه‌ها', 'All our moments')}
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              className={`filter-chip ${category === item.id ? 'active' : ''}`}
              onClick={() => setCategory(item.id)}
            >
              {t(item.fa, item.en)}
            </button>
          ))}
        </div>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : memories.length ? (
        <div className={view === 'grid' ? 'memory-grid' : 'timeline'}>
          {[...memories]
            .sort((a, b) => (view === 'timeline' ? b.memory_date.localeCompare(a.memory_date) : 0))
            .map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            icon={Camera}
            title={
              search || category || favorites
                ? t('این لحظه را پیدا نکردیم', 'We couldn’t find that moment')
                : t('اولین صفحه هنوز سفید است', 'Our first page is still unwritten')
            }
            description={
              search || category || favorites
                ? t(
                    'جست‌وجو یا فیلتر را تغییر بده و دوباره ببین.',
                    'Try a different search or filter.',
                  )
                : t(
                    'از یک عکس ساده شروع کن. روزی، همین لحظه‌ها باارزش‌ترین قصه‌هایمان می‌شوند.',
                    'Start with a simple photo. One day, these little moments will be our favorite stories.',
                  )
            }
            action={
              <LinkButton href="/memories/new" variant="secondary">
                <Plus size={16} />
                {t('ثبت یک خاطره', 'Keep a memory')}
              </LinkButton>
            }
          />
        </div>
      )}
      {query.hasNextPage && (
        <div className="load-more">
          <Button
            variant="secondary"
            busy={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t('خاطره‌های بیشتر', 'More memories')}
          </Button>
        </div>
      )}
    </>
  );
}
export function MemoryForm({
  initial,
  onSaved,
}: {
  initial?: Memory;
  onSaved?: (id: string) => void;
}) {
  const { t, timezone } = useI18n();
  const ws = useWorkspace();
  const action = useAction();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState(initial?.tags.join(', ') || '');
  const form = useForm({
    resolver: zodResolver(memoryFields),
    defaultValues: {
      title: initial?.title || '',
      description: initial?.description || '',
      memory_date: initial?.memory_date || todayISO(timezone),
      location: initial?.location || '',
      category: (initial?.category as 'everyday' | 'date' | 'travel' | 'milestone') || 'everyday',
      tags: initial?.tags || [],
      music_url: initial?.music_url || '',
    },
  });
  const enabled = ws.configured && !!ws.couple;
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit(async (fields) => {
        const result = await action.run<string>({
          type: 'memory.save',
          id: initial?.id,
          fields: {
            ...fields,
            tags: tags
              .split(/[,،]/)
              .map((v) => v.trim())
              .filter(Boolean),
          },
          assets: assets.map((a) => a.id),
        });
        if (result.ok) {
          if (onSaved) onSaved(result.data);
          else router.push(`/memories/${result.data}`);
        }
      })}
    >
      <UploadField
        kind="memory"
        assets={assets}
        onChange={setAssets}
        disabled={!enabled}
        max={8 - (initial?.memory_media.length || 0)}
        onBusyChange={setUploading}
      />
      <div className="form-grid">
        <Field
          label={t('اسم این لحظه', 'Give this moment a name')}
          error={
            form.formState.errors.title
              ? t('عنوانی تا ۱۲۰ کاراکتر وارد کنید.', 'Enter a title up to 120 characters.')
              : undefined
          }
          className="span-full"
        >
          <input
            {...form.register('title')}
            maxLength={120}
            placeholder={t('مثلاً: یک عصر بارانی، کنار تو', 'A rainy afternoon, with you')}
            disabled={!enabled}
          />
        </Field>
        <Field label={t('چه روزی بود؟', 'When was it?')}>
          <input type="date" {...form.register('memory_date')} disabled={!enabled} />
        </Field>
        <Field label={t('کجا بودیم؟ (اختیاری)', 'Where were we? (optional)')}>
          <input
            {...form.register('location')}
            maxLength={200}
            placeholder={t('یک جای دوست‌داشتنی', 'Somewhere lovely')}
            disabled={!enabled}
          />
        </Field>
        <Field label={t('قصه‌ی این خاطره', 'The story of this moment')} className="span-full">
          <textarea
            {...form.register('description')}
            rows={5}
            maxLength={10000}
            placeholder={t(
              'جزئیات کوچکی که نمی‌خواهی یادت بروند…',
              'The little details you never want to forget…',
            )}
            disabled={!enabled}
          />
        </Field>
        <Field label={t('بخشی از قصه‌ی ما', 'A chapter of our story')}>
          <Select {...form.register('category')} disabled={!enabled}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.fa, c.en)}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t('برچسب‌ها (با ویرگول جدا کن)', 'Tags (separate with commas)')}
          hint={t('حداکثر ۱۰ برچسب، هر کدام تا ۴۰ کاراکتر', 'Up to 10 tags, 40 characters each')}
        >
          <input value={tags} onChange={(e) => setTags(e.target.value)} disabled={!enabled} />
        </Field>
        <Field
          label={t('آهنگِ این لحظه (پیوند اختیاری)', 'The soundtrack (optional link)')}
          className="span-full"
          hint={t(
            'یک پیوند HTTPS از سرویس موسیقی؛ پخش در سرویس اصلی انجام می‌شود.',
            'An HTTPS music-service link; playback stays with the original provider.',
          )}
          error={
            form.formState.errors.music_url
              ? t('یک پیوند HTTPS معتبر وارد کنید.', 'Enter a valid HTTPS link.')
              : undefined
          }
        >
          <input
            type="url"
            dir="ltr"
            {...form.register('music_url')}
            placeholder="https://open.spotify.com/…"
            disabled={!enabled}
          />
        </Field>
      </div>
      <div className="inline-note">
        <LockKeyhole size={13} />
        {t(
          'فایل‌ها خصوصی‌اند؛ فقط اعضای این فضا اجازه‌ی دیدنشان را دارند.',
          'Files are private and only accessible to members of this space.',
        )}
      </div>
      <div className="form-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => (initial && onSaved ? onSaved(initial.id) : router.push('/memories'))}
        >
          {t('انصراف', 'Cancel')}
        </Button>
        <Button type="submit" busy={action.pending} disabled={!enabled || uploading}>
          <Heart size={16} />
          {initial
            ? t('ذخیره‌ی تغییرات', 'Save changes')
            : t('این لحظه را نگه دار', 'Keep this moment')}
        </Button>
      </div>
    </form>
  );
}
export function NewMemoryScreen() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        eyebrow="A MOMENT TO KEEP"
        title={t('یک تکه‌ی تازه از ما', 'A new little piece of us')}
        description={t(
          'قرار نیست کامل باشد؛ کافی‌ست واقعی و مالِ ما باشد.',
          'It doesn’t have to be perfect. It just has to be ours.',
        )}
      />
      <SetupNotice />
      <MembershipNotice />
      <div className="panel memory-detail">
        <MemoryForm />
      </div>
    </>
  );
}
export function MemoryDetailScreen({ id }: { id: string }) {
  const { t, locale } = useI18n();
  const ws = useWorkspace();
  const query = useData<Memory>('memory', { id });
  const action = useAction();
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const memory = query.data;
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  if (!memory)
    return (
      <>
        <SetupNotice />
        <EmptyState
          icon={ImageIcon}
          title={t('این خاطره در دسترس نیست', 'This memory is unavailable')}
          description={t(
            'ابتدا اتصال و عضویت خود را بررسی کنید.',
            'Check your connection and membership first.',
          )}
          action={
            <LinkButton href="/memories" variant="secondary">
              {t('بازگشت به آلبوم', 'Back to our album')}
            </LinkButton>
          }
        />
      </>
    );
  const owner = memory.creator_id === ws.userId;
  return (
    <div className="memory-detail">
      <PageHeader
        eyebrow="A PIECE OF OUR STORY"
        title={memory.title}
        description={formatDate(memory.memory_date, locale, 'UTC')}
        action={
          owner ? (
            <Button variant="secondary" onClick={() => setEdit(true)}>
              <PenLine size={16} />
              {t('ویرایش', 'Edit')}
            </Button>
          ) : undefined
        }
      />
      <div className="detail-gallery">
        {memory.memory_media.map(
          (media) =>
            media.upload_assets && (
              <div key={media.id}>
                <PrivateMedia asset={media.upload_assets} alt={memory.title} />
                {owner && (
                  <ConfirmButton
                    className="remove-media"
                    onConfirm={async () => {
                      await action.run({ type: 'memory.media.delete', id: media.id });
                    }}
                    title={t('حذف این فایل؟', 'Remove this file?')}
                    description={t(
                      'دسترسی فوراً قطع می‌شود؛ فایل در نوبت پاک‌سازی قرار می‌گیرد.',
                      'Access is revoked immediately. The file is queued for physical cleanup.',
                    )}
                  >
                    <Trash2 size={14} />
                    {t('حذف فایل', 'Remove')}
                  </ConfirmButton>
                )}
              </div>
            ),
        )}
      </div>
      <section className="panel">
        <div className="detail-meta">
          <span>
            <CalendarDays size={15} />
            {formatDate(memory.memory_date, locale, 'UTC')}
          </span>
          {memory.location && (
            <span>
              <MapPin size={15} />
              {memory.location}
            </span>
          )}
          <span>
            <Camera size={15} />
            {ws.members.find((m) => m.id === memory.creator_id)?.display_name}
          </span>
        </div>
        <p className="prose-text">
          {memory.description ||
            t('گاهی، یک تصویر تمام قصه است.', 'Sometimes, a picture is the whole story.')}
        </p>
        {memory.tags.length > 0 && (
          <div className="tag-list">
            {memory.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {memory.music_url && (
          <a
            href={memory.music_url}
            className="text-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Music2 size={16} />
            {t('آهنگ این خاطره', 'The soundtrack to this memory')}
            <ArrowUpRight size={15} />
          </a>
        )}
        <div className="form-actions spread">
          <Button
            variant="secondary"
            busy={action.pending}
            onClick={() =>
              void action.run({
                type: 'memory.favorite',
                id,
                active: !memory.memory_favorites.length,
              })
            }
          >
            <Heart size={16} fill={memory.memory_favorites.length ? 'currentColor' : 'none'} />
            {t('محبوب من', 'My favorite')}
          </Button>
          {owner && (
            <ConfirmButton
              disabled={action.pending}
              title={t('این خاطره پاک شود؟', 'Delete this memory?')}
              description={t(
                'متن، محبوب‌ها و دسترسی به فایل‌ها حذف می‌شوند. فایل‌ها توسط کار پاک‌سازی سرور حذف خواهند شد. این کار قابل بازگشت نیست.',
                'The memory, favorites and file access will be removed. Files are physically deleted by the cleanup job. This cannot be undone.',
              )}
              onConfirm={async () => {
                const result = await action.run({ type: 'memory.delete', id });
                if (result.ok) {
                  toast(t('خاطره پاک شد.', 'Memory deleted.'));
                  router.push('/memories');
                }
              }}
            >
              <Trash2 size={15} />
              {t('حذف خاطره', 'Delete memory')}
            </ConfirmButton>
          )}
        </div>
      </section>
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title={t('ویرایش خاطره', 'Edit our memory')}
        wide
      >
        <MemoryForm initial={memory} onSaved={() => setEdit(false)} />
      </Modal>
    </div>
  );
}
