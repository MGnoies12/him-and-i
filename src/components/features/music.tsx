'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Music2, Plus, Heart, ArrowUpRight, Trash2, Search, Disc3 } from 'lucide-react';
import { useI18n, useWorkspace } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  MembershipNotice,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Field,
  Select,
  ConfirmButton,
} from '@/components/ui/primitives';
import { useAction, useData } from '@/hooks/use-data';
import type { Playlist } from '@/types/models';
import { safeExternalLink } from '@/lib/config';
const trackSchema = z.object({
  playlist_id: z.uuid(),
  title: z.string().trim().min(1).max(120),
  artist: z.string().trim().min(1).max(120),
  url: z
    .url()
    .max(2048)
    .refine((v) => !!safeExternalLink(v)),
});
function TrackForm({ playlists, onSaved }: { playlists: Playlist[]; onSaved: () => void }) {
  const { t } = useI18n();
  const action = useAction();
  const form = useForm({
    resolver: zodResolver(trackSchema),
    defaultValues: { playlist_id: playlists[0]?.id || '', title: '', artist: '', url: '' },
  });
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await action.run({ type: 'track.add', ...values });
        if (result.ok) onSaved();
      })}
    >
      <Field label={t('در کدام فهرست؟', 'Which playlist?')}>
        <Select {...form.register('playlist_id')}>
          {playlists.map((playlist) => (
            <option key={playlist.id} value={playlist.id}>
              {playlist.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={t('نام آهنگ', 'Song title')}
        error={
          form.formState.errors.title ? t('نام آهنگ را وارد کن.', 'Enter a song title.') : undefined
        }
      >
        <input
          {...form.register('title')}
          maxLength={120}
          placeholder={t('آهنگی که یاد تو می‌اندازدم', 'The song that reminds me of you')}
        />
      </Field>
      <Field
        label={t('خواننده یا هنرمند', 'Artist')}
        error={
          form.formState.errors.artist
            ? t('نام هنرمند را وارد کن.', 'Enter an artist name.')
            : undefined
        }
      >
        <input {...form.register('artist')} maxLength={120} />
      </Field>
      <Field
        label={t('پیوند در سرویس اصلی', 'Link to the original service')}
        error={
          form.formState.errors.url
            ? t('یک پیوند HTTPS معتبر وارد کن.', 'Use a valid HTTPS link.')
            : undefined
        }
        hint={t(
          'مثلاً Spotify، Apple Music، YouTube یا Bandcamp.',
          'For example Spotify, Apple Music, YouTube, or Bandcamp.',
        )}
      >
        <input type="url" {...form.register('url')} dir="ltr" placeholder="https://…" />
      </Field>
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onSaved}>
          {t('انصراف', 'Cancel')}
        </Button>
        <Button type="submit" busy={action.pending}>
          <Music2 size={16} />
          {t('اضافه به آهنگ‌های ما', 'Add to our soundtrack')}
        </Button>
      </div>
    </form>
  );
}
export function MusicScreen() {
  const { t } = useI18n();
  const ws = useWorkspace();
  const query = useData<Playlist[]>('music');
  const action = useAction();
  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [trackOpen, setTrackOpen] = useState(false);
  const [title, setTitle] = useState('');
  const enabled = ws.configured && !!ws.couple;
  const playlists = query.data || [];
  return (
    <>
      <PageHeader
        eyebrow="THE SOUNDTRACK TO US"
        title={t('آهنگ‌هایی که بوی تو را دارند.', 'The songs that sound like us.')}
        description={t(
          'بعضی آهنگ‌ها، یک نفرند. بعضی‌ها، یک خاطره.',
          'Some songs are a person. Some are a memory.',
        )}
        action={
          <Button onClick={() => (playlists.length ? setTrackOpen(true) : setPlaylistOpen(true))}>
            <Plus size={17} />
            {t('یک آهنگ تازه', 'Add a song')}
          </Button>
        }
      />
      <SetupNotice />
      <MembershipNotice />
      <section className="music-hero">
        <div className="vinyl" aria-hidden="true">
          <Heart size={24} />
        </div>
        <div>
          <div className="eyebrow" dir="ltr">
            ON REPEAT, IN OUR HEARTS
          </div>
          <h2>{t('اگر قصه‌ی ما یک آهنگ بود…', 'If our story were a song…')}</h2>
          <p>
            {t(
              'یک مجموعه از پیوندهای قانونی. موسیقی از سرویس اصلی باز می‌شود؛ اینجا هیچ آهنگی دانلود، بازنشر یا وانمود به پخش نمی‌شود.',
              'A collection of legitimate music links. Listening happens on the original service; no songs are downloaded, rehosted, or pretend-played here.',
            )}
          </p>
        </div>
      </section>
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="search-input">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('آهنگ یا هنرمند…', 'A song or an artist…')}
              aria-label={t('جست‌وجوی آهنگ‌ها', 'Search our music')}
            />
          </label>
          <button
            className={`icon-button ${favorites ? 'active' : ''}`}
            onClick={() => setFavorites(!favorites)}
            aria-pressed={favorites}
            aria-label={t('فقط آهنگ‌های محبوب', 'Favorite tracks only')}
          >
            <Heart size={18} />
          </button>
        </div>
        <Button variant="secondary" onClick={() => setPlaylistOpen(true)}>
          <Plus size={15} />
          {t('فهرست تازه', 'New playlist')}
        </Button>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !playlists.length ? (
        <section className="panel">
          <EmptyState
            icon={Music2}
            title={t('سکوت قبل از اولین آهنگ.', 'The quiet before our first song.')}
            description={t(
              'یک فهرست بساز و آهنگ‌هایی را که شما را یاد هم می‌اندازند، کنار هم بگذار.',
              'Make a playlist for the songs that bring you back to each other.',
            )}
            action={
              <Button variant="secondary" onClick={() => setPlaylistOpen(true)}>
                <Plus size={15} />
                {t('ساخت اولین فهرست', 'Our first playlist')}
              </Button>
            }
          />
        </section>
      ) : (
        playlists.map((playlist) => {
          const tracks = playlist.playlist_tracks.filter(
            (track) =>
              (!favorites || track.track_favorites.length > 0) &&
              `${track.title} ${track.artist}`
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase()),
          );
          return (
            <section className="panel playlist-panel" key={playlist.id}>
              <div className="panel-header">
                <h2>
                  <Music2
                    size={17}
                    style={{ display: 'inline', marginInlineEnd: 8, color: 'var(--dusty-rose)' }}
                  />
                  {playlist.title}
                </h2>
                {playlist.creator_id === ws.userId && (
                  <ConfirmButton
                    variant="ghost"
                    title={t('حذف این فهرست؟', 'Delete this playlist?')}
                    description={t(
                      'فهرست و همه‌ی پیوندهای آن، از جمله آهنگ‌های افزوده‌شده توسط همراهت، حذف می‌شوند.',
                      'The playlist and all its links, including your partner’s additions, will be removed.',
                    )}
                    onConfirm={async () => {
                      await action.run({ type: 'playlist.delete', id: playlist.id });
                    }}
                  >
                    <Trash2 size={14} />
                  </ConfirmButton>
                )}
              </div>
              {tracks.length ? (
                tracks.map((track, index) => (
                  <article className="track-row" key={track.id}>
                    <span className="track-number">{String(index + 1).padStart(2, '0')}</span>
                    <div className="track-art">
                      <Music2 size={19} strokeWidth={1.4} />
                    </div>
                    <div className="track-info">
                      <h3 dir="auto">{track.title}</h3>
                      <p dir="auto">
                        {track.artist} ·{' '}
                        {safeExternalLink(track.url)?.hostname ||
                          t('پیوند نامعتبر', 'Invalid link').replace(/^www\./, '')}
                      </p>
                    </div>
                    <div className="track-actions">
                      <button
                        className={`icon-button ${track.track_favorites.length ? 'active' : ''}`}
                        aria-label={t('تغییر علاقه‌مندی آهنگ', 'Toggle track favorite')}
                        aria-pressed={track.track_favorites.length > 0}
                        onClick={() =>
                          void action.run({
                            type: 'track.favorite',
                            id: track.id,
                            active: !track.track_favorites.length,
                          })
                        }
                      >
                        <Heart
                          size={16}
                          fill={track.track_favorites.length ? 'currentColor' : 'none'}
                        />
                      </button>
                      <a
                        href={safeExternalLink(track.url)?.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button secondary"
                        aria-label={t(
                          `بازکردن ${track.title} در سرویس اصلی`,
                          `Open ${track.title} on its original service`,
                        )}
                      >
                        <span>{t('در سرویس اصلی', 'Open provider')}</span>
                        <ArrowUpRight size={15} />
                      </a>
                      {track.creator_id === ws.userId && (
                        <ConfirmButton
                          variant="ghost"
                          title={t('حذف این پیوند؟', 'Remove this track?')}
                          description={t(
                            'فقط از فهرست ما حذف می‌شود.',
                            'Only the link in your shared playlist is removed.',
                          )}
                          onConfirm={async () => {
                            await action.run({ type: 'track.delete', id: track.id });
                          }}
                        >
                          <Trash2 size={13} />
                        </ConfirmButton>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  compact
                  icon={Disc3}
                  title={
                    search || favorites
                      ? t('آهنگی با این انتخاب پیدا نشد.', 'No songs match this selection.')
                      : t('اولین آهنگِ این فصل چیست؟', 'What’s the first song of this chapter?')
                  }
                  description={t(
                    'پیوند یک آهنگ را اضافه کن؛ پخش و دسترسی تابع سرویس اصلی است.',
                    'Add a song link. Playback and access are handled by its original provider.',
                  )}
                  action={
                    <Button variant="ghost" onClick={() => setTrackOpen(true)}>
                      <Plus size={14} />
                      {t('افزودن آهنگ', 'Add a song')}
                    </Button>
                  }
                />
              )}
            </section>
          );
        })
      )}
      <Modal
        open={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        title={t('یک اسم برای آهنگ‌های ما', 'A name for our soundtrack')}
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await action.run({ type: 'playlist.create', title });
            if (result.ok) {
              setTitle('');
              setPlaylistOpen(false);
            }
          }}
        >
          <Field label={t('نام فهرست', 'Playlist name')}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              disabled={!enabled}
              placeholder={t('مثلاً: برای جاده‌های دونفره', 'For our long drives')}
            />
          </Field>
          <Button type="submit" disabled={!enabled} busy={action.pending}>
            <Music2 size={16} />
            {t('ساخت فهرست', 'Create playlist')}
          </Button>
        </form>
      </Modal>
      <Modal
        open={trackOpen}
        onClose={() => setTrackOpen(false)}
        title={t('یک آهنگ، یک حس', 'One song, a whole feeling')}
      >
        <TrackForm playlists={playlists} onSaved={() => setTrackOpen(false)} />
      </Modal>
    </>
  );
}
