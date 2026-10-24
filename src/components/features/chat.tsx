'use client';
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle,
  Send,
  Mic,
  Square,
  Paperclip,
  Search,
  X,
  LockKeyhole,
  UserRound,
  Reply,
  Smile,
  Trash2,
  Check,
  CheckCheck,
  Clock3,
  RotateCcw,
} from 'lucide-react';
import { useI18n, useWorkspace, useToast } from '@/components/providers';
import {
  PageHeader,
  SetupNotice,
  MembershipNotice,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  ConfirmButton,
  LoadingState,
} from '@/components/ui/primitives';
import { PrivateMedia, uploadFile } from '@/components/ui/media';
import { useAction, useRealtime } from '@/hooks/use-data';
import { ClientError, errorText, performClientAction, requestJSON } from '@/lib/client-api';
import { formatTime, formatDate } from '@/lib/dates';
import type { Asset, Message } from '@/types/models';
import type { Row } from '@/types/database';
interface MessagePage {
  messages: Message[];
  reads: Row<'conversation_reads'>[];
}
interface PendingMessage {
  message: Message;
  status: 'sending' | 'failed' | 'sent';
}
const reactions = [
  { id: 'heart', value: '❤️', fa: 'عشق', en: 'Love' },
  { id: 'smile', value: '😊', fa: 'لبخند', en: 'Smile' },
  { id: 'sparkles', value: '✨', fa: 'درخشش', en: 'Sparkles' },
  { id: 'hug', value: '🤗', fa: 'آغوش', en: 'Hug' },
] as const;
export function ChatScreen() {
  const { t, locale, timezone } = useI18n();
  const ws = useWorkspace();
  const toast = useToast();
  const client = useQueryClient();
  const action = useAction();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [body, setBody] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [attachment, setAttachment] = useState<Asset | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [local, setLocal] = useState<PendingMessage[]>([]);
  const [reactTo, setReactTo] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [requestingMic, setRequestingMic] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStart = useRef(0);
  const mounted = useRef(true);
  const scroll = useRef<HTMLDivElement>(null);
  const lastSeen = useRef('');
  const lastRead = useRef('');
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const enabled = ws.configured && !!ws.conversationId && ws.members.length === 2;
  const partner = ws.members.find((p) => p.id !== ws.userId);
  const query = useInfiniteQuery({
    queryKey: ['data', ws.userId, 'messages', search],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ q: search });
      if (pageParam) params.set('cursor', pageParam);
      return (await requestJSON<{ data: MessagePage }>(`/api/data/messages?${params}`)).data;
    },
    getNextPageParam: (last) =>
      last.messages.length === 40
        ? btoa(
            JSON.stringify({ at: last.messages.at(-1)!.created_at, id: last.messages.at(-1)!.id }),
          )
        : undefined,
    enabled: ws.configured && !!ws.conversationId,
    refetchInterval: 15000,
  });
  useRealtime(['messages', 'message_reactions', 'conversation_reads']);
  const stored = query.data?.pages.flatMap((page) => page.messages) || [];
  const storedIds = new Set(stored.map((m) => m.id));
  const messages = [
    ...stored,
    ...local.filter((m) => !storedIds.has(m.message.id)).map((m) => m.message),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const newestId = stored[0]?.id;
  const receipt = query.data?.pages[0].reads.find((r) => r.user_id === partner?.id);
  useEffect(() => {
    if (!newestId || !ws.conversationId || search) return;
    const element = scroll.current;
    function mark() {
      if (
        document.visibilityState !== 'visible' ||
        !element ||
        element.scrollHeight - element.scrollTop - element.clientHeight > 80 ||
        lastRead.current === newestId
      )
        return;
      lastRead.current = newestId!;
      void performClientAction({ type: 'message.read' })
        .then(() => client.invalidateQueries({ queryKey: ['data', ws.userId, 'home'] }))
        .catch(() => {
          lastRead.current = '';
        });
    }
    const frame = requestAnimationFrame(mark);
    element?.addEventListener('scroll', mark, { passive: true });
    document.addEventListener('visibilitychange', mark);
    return () => {
      cancelAnimationFrame(frame);
      element?.removeEventListener('scroll', mark);
      document.removeEventListener('visibilitychange', mark);
    };
  }, [newestId, ws.conversationId, ws.userId, client, search]);
  useEffect(() => {
    if (!newestId || lastSeen.current === newestId) return;
    const element = scroll.current;
    if (
      element &&
      (!lastSeen.current || element.scrollHeight - element.scrollTop - element.clientHeight < 230)
    )
      element.scrollTop = element.scrollHeight;
    lastSeen.current = newestId;
  }, [newestId]);
  useEffect(() => {
    mounted.current = true;
    const stopInBackground = () => {
      if (document.visibilityState === 'hidden' && recorder.current?.state === 'recording') {
        if (timer.current) clearInterval(timer.current);
        recorder.current.stop();
        stream.current?.getTracks().forEach((track) => track.stop());
        setRecording(false);
      }
    };
    document.addEventListener('visibilitychange', stopInBackground);
    return () => {
      document.removeEventListener('visibilitychange', stopInBackground);
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
      if (recorder.current?.state === 'recording') {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  async function send(message: Message) {
    setLocal((rows) => {
      const existing = rows.find((r) => r.message.id === message.id);
      return existing
        ? rows.map((r) => (r.message.id === message.id ? { ...r, status: 'sending' } : r))
        : [...rows, { message, status: 'sending' }];
    });
    try {
      const persisted = await performClientAction<Row<'messages'>>({
        type: 'message.send',
        id: message.id,
        body: message.body,
        asset_id: message.asset_id,
        reply_to: message.reply_to,
      });
      setLocal((rows) =>
        rows.map((r) =>
          r.message.id === message.id
            ? { message: { ...r.message, ...persisted }, status: 'sent' }
            : r,
        ),
      );
      await client.invalidateQueries({ queryKey: ['data'] });
    } catch (error) {
      setLocal((rows) =>
        rows.map((r) => (r.message.id === message.id ? { ...r, status: 'failed' } : r)),
      );
      toast(errorText(error, t), 'error');
    }
  }
  function submit() {
    if (!enabled || (!body.trim() && !attachment) || recording || uploadProgress !== null) return;
    const message: Message = {
      id: crypto.randomUUID(),
      conversation_id: ws.conversationId!,
      sender_id: ws.userId!,
      body: body.trim(),
      asset_id: attachment?.id || null,
      upload_assets: attachment,
      reply_to: reply?.id || null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      message_reactions: [],
    };
    setBody('');
    setAttachment(null);
    setReply(null);
    void send(message);
    input.current?.focus();
    requestAnimationFrame(() => {
      if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
    });
  }
  async function attach(file: File, duration?: number) {
    setUploadProgress(0);
    try {
      const asset = await uploadFile(file, 'chat', setUploadProgress, duration);
      if (mounted.current) setAttachment(asset);
    } catch (error) {
      toast(errorText(error, t), 'error');
    } finally {
      if (mounted.current) setUploadProgress(null);
    }
  }
  async function selectAudio(file: File) {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new ClientError('invalid_audio')), 10000);
        audio.onloadedmetadata = () => {
          clearTimeout(timeout);
          if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration * 1000);
          else reject(new ClientError('invalid_audio'));
        };
        audio.onerror = () => {
          clearTimeout(timeout);
          reject(new ClientError('unsupported_media'));
        };
      });
      await attach(file, duration);
    } catch (error) {
      toast(errorText(error, t), 'error');
    } finally {
      audio.src = '';
      URL.revokeObjectURL(url);
    }
  }
  function stopRecording() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
    stream.current?.getTracks().forEach((track) => track.stop());
  }
  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast(errorText(new ClientError('unsupported_recording'), t), 'error');
      return;
    }
    setRequestingMic(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new ClientError('unsupported_recording');
      const rec = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 64000 });
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onerror = () => {
        stopRecording();
        toast(errorText(new ClientError('invalid_audio'), t), 'error');
      };
      rec.onstop = () => {
        const duration = Math.min(120000, Math.round(performance.now() - recordStart.current));
        if (!mounted.current) return;
        setRecording(false);
        if (timer.current) clearInterval(timer.current);
        media.getTracks().forEach((track) => track.stop());
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        void (async () => {
          let blob = new Blob(chunks, { type: mime.split(';')[0] });
          if (ext === 'webm') {
            const { fixWebmDuration } = await import('@fix-webm-duration/fix');
            blob = await fixWebmDuration(blob, duration, { logger: false });
          }
          if (mounted.current)
            await attach(new File([blob], `voice.${ext}`, { type: blob.type }), duration);
        })().catch((error) => toast(errorText(error, t), 'error'));
      };
      recordStart.current = performance.now();
      rec.start(250);
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((performance.now() - recordStart.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 120) stopRecording();
      }, 250);
    } catch (error) {
      stream.current?.getTracks().forEach((track) => track.stop());
      toast(
        errorText(error instanceof ClientError ? error : new ClientError('permission_denied'), t),
        'error',
      );
    } finally {
      setRequestingMic(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="WORDS, JUST BETWEEN US"
        title={t('گفت‌وگوی ما', 'Our conversation')}
        description={t(
          'از یک «سلام» ساده، تا حرف‌هایی که فقط خودمان می‌فهمیم.',
          'From a simple hello to the things only we understand.',
        )}
      />
      <SetupNotice compact />
      <MembershipNotice />
      <section className="chat-layout">
        <header className="chat-header">
          <span className="avatar partner">
            {partner?.display_name.slice(0, 1) || <UserRound size={21} />}
          </span>
          <div>
            <h2>{partner?.display_name || t('همراه تو', 'Your person')}</h2>
            <p>
              <LockKeyhole size={11} />
              {t(
                'گفت‌وگوی خصوصی · بدون رمزگذاری سرتاسری',
                'Private conversation · not end-to-end encrypted',
              )}
            </p>
          </div>
          <button
            className="icon-button"
            onClick={() => setShowSearch(!showSearch)}
            aria-label={t('جست‌وجوی پیام‌ها', 'Search messages')}
            aria-expanded={showSearch}
          >
            <Search size={19} />
          </button>
        </header>
        {showSearch && (
          <div className="chat-search">
            <label className="search-input">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={120}
                aria-label={t('جست‌وجوی متن پیام', 'Search message text')}
                placeholder={t('بخشی از یک حرف…', 'A few words to find…')}
              />
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setSearch('');
                  setShowSearch(false);
                }}
                aria-label={t('بستن جست‌وجو', 'Close search')}
              >
                <X size={16} />
              </button>
            </label>
          </div>
        )}
        <div
          className="chat-scroll"
          ref={scroll}
          role="log"
          aria-label={t('پیام‌های خصوصی', 'Private messages')}
          aria-live="polite"
        >
          {query.hasNextPage && (
            <Button
              variant="ghost"
              busy={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('حرف‌های قدیمی‌تر', 'Earlier conversations')}
            </Button>
          )}
          {query.isLoading ? (
            <LoadingState />
          ) : query.isError ? (
            <ErrorState error={query.error} retry={() => void query.refetch()} />
          ) : !messages.length ? (
            <EmptyState
              icon={MessageCircle}
              title={
                search
                  ? t('پیامی پیدا نشد', 'No matching messages')
                  : t('اینجا، حرف‌هایمان خانه دارند.', 'Our words have a home here.')
              }
              description={
                !partner
                  ? t(
                      'برای شروع گفت‌وگو، همراهت باید دعوت را بپذیرد.',
                      'Your partner needs to accept their invitation before you can start chatting.',
                    )
                  : t(
                      'اولین پیاممان چه باشد؟ یک «دلتنگتم» شاید.',
                      'What should our first words be? Maybe a little “miss you.”',
                    )
              }
            />
          ) : (
            messages.map((message) => {
              const mine = message.sender_id === ws.userId;
              const pending = !storedIds.has(message.id)
                ? local.find((m) => m.message.id === message.id)?.status
                : undefined;
              const parent = messages.find((m) => m.id === message.reply_to);
              const read = mine && receipt && receipt.last_read_at >= message.created_at;
              const sender = ws.members.find((m) => m.id === message.sender_id);
              return (
                <article
                  key={message.id}
                  className={`message-bubble ${mine ? 'mine' : ''} ${pending === 'failed' ? 'failed-message' : ''}`}
                >
                  <strong>
                    {mine ? t('من', 'Me') : sender?.display_name || t('همراه من', 'My partner')}
                  </strong>
                  {message.reply_to && (
                    <div className="message-reply">
                      <Reply size={12} style={{ display: 'inline', marginInlineEnd: 5 }} />
                      {parent?.deleted_at
                        ? t('پیام حذف‌شده', 'Deleted message')
                        : parent?.body || t('پاسخ به پیام پیشین', 'Reply to an earlier message')}
                    </div>
                  )}
                  {message.deleted_at ? (
                    <p className="muted">
                      {t(
                        'این پیام توسط فرستنده حذف شده است.',
                        'This message was deleted by its sender.',
                      )}
                    </p>
                  ) : (
                    <>
                      {message.upload_assets && (
                        <PrivateMedia
                          asset={message.upload_assets}
                          className="message-media"
                          alt={t('فایل ضمیمه‌ی خصوصی', 'Private message attachment')}
                        />
                      )}
                      <p dir="auto">{message.body}</p>
                    </>
                  )}
                  <div className="message-meta">
                    <time
                      dateTime={message.created_at}
                      title={formatDate(message.created_at, locale, timezone)}
                    >
                      {formatTime(message.created_at, locale, timezone)}
                    </time>
                    {mine &&
                      pending !== 'failed' &&
                      (pending === 'sending' ? (
                        <Clock3 size={12} aria-label={t('در حال ارسال', 'Sending')} />
                      ) : read ? (
                        <CheckCheck size={14} aria-label={t('خوانده شده', 'Read')} />
                      ) : (
                        <Check
                          size={13}
                          aria-label={t('ذخیره‌شده در سرور', 'Persisted on server')}
                        />
                      ))}
                    {!message.deleted_at && !pending && (
                      <div className="message-actions">
                        <button
                          className="icon-button"
                          aria-label={t('پاسخ به پیام', 'Reply to message')}
                          onClick={() => {
                            setReply(message);
                            input.current?.focus();
                          }}
                        >
                          <Reply size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={t('واکنش به پیام', 'React to message')}
                          onClick={() => setReactTo(message)}
                        >
                          <Smile size={13} />
                        </button>
                        {mine && (
                          <ConfirmButton
                            variant="ghost"
                            title={t(
                              'حذف پیام برای هر دو نفر؟',
                              'Delete this message for both of you?',
                            )}
                            description={t(
                              'متن و دسترسی فایل حذف می‌شود؛ جای پیام به‌صورت حذف‌شده باقی می‌ماند.',
                              'Its text and attachment access are removed. A deleted-message marker remains.',
                            )}
                            onConfirm={async () => {
                              await action.run({ type: 'message.delete', id: message.id });
                            }}
                          >
                            <Trash2 size={12} />
                          </ConfirmButton>
                        )}
                      </div>
                    )}
                  </div>
                  {message.message_reactions.length > 0 && (
                    <div className="message-reactions">
                      {message.message_reactions.map((reaction) => (
                        <button
                          className="reaction-pill"
                          key={reaction.user_id}
                          onClick={() =>
                            reaction.user_id === ws.userId
                              ? void action.run({
                                  type: 'message.react',
                                  id: message.id,
                                  emoji: null,
                                })
                              : setReactTo(message)
                          }
                          aria-label={`${ws.members.find((m) => m.id === reaction.user_id)?.display_name || ''}: ${reactions.find((r) => r.id === reaction.emoji)?.en}`}
                        >
                          <span>{reactions.find((r) => r.id === reaction.emoji)?.value}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {pending === 'failed' && (
                    <div className="failed-label">
                      <span>{t('ارسال نشد', 'Not sent')}</span>
                      <button onClick={() => void send(message)}>
                        <RotateCcw size={11} style={{ display: 'inline' }} />{' '}
                        {t('تلاش دوباره', 'Retry')}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {reply && (
            <div className="composer-reply">
              <Reply size={15} />
              <span>{reply.body || t('فایل ضمیمه', 'Attachment')}</span>
              <button
                className="icon-button"
                type="button"
                onClick={() => setReply(null)}
                aria-label={t('لغو پاسخ', 'Cancel reply')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {attachment && (
            <div className="composer-reply">
              <Paperclip size={15} />
              <span>
                {attachment.mime_type.startsWith('audio/')
                  ? t('پیام صوتی آماده‌ی ارسال', 'Voice message ready to send')
                  : t('فایل خصوصی آماده‌ی ارسال', 'Private attachment ready to send')}
              </span>
              <button
                className="icon-button"
                type="button"
                onClick={() => setAttachment(null)}
                aria-label={t('حذف ضمیمه', 'Remove attachment')}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {uploadProgress !== null && (
            <div className="composer-reply" role="status">
              {t('در حال بارگذاری', 'Uploading')} {uploadProgress}%
            </div>
          )}
          {recording && (
            <div className="recording-bar">
              <span className="recording-dot" />
              <span>
                {t('در حال ضبط', 'Recording')} · {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, '0')} / 2:00
              </span>
              <Button type="button" variant="secondary" onClick={stopRecording}>
                <Square size={14} />
                {t('پایان ضبط', 'Finish')}
              </Button>
            </div>
          )}
          <div className="composer-row">
            <div className="composer-tools">
              <button
                type="button"
                className="icon-button"
                disabled={!enabled || recording || uploadProgress !== null}
                aria-label={t('انتخاب تصویر یا فایل صوتی', 'Choose an image or audio file')}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip size={19} />
              </button>
              <button
                type="button"
                className={`icon-button ${recording ? 'active' : ''}`}
                disabled={!enabled || requestingMic || uploadProgress !== null}
                aria-label={
                  recording
                    ? t('پایان ضبط', 'Stop recording')
                    : t(
                        'ضبط پیام صوتی؛ اجازه‌ی میکروفن درخواست می‌شود',
                        'Record a voice message; microphone permission will be requested',
                      )
                }
                onClick={() => (recording ? stopRecording() : void startRecording())}
              >
                {recording ? <Square size={17} /> : <Mic size={19} />}
              </button>
              <input
                type="file"
                className="sr-only"
                aria-label={t('انتخاب تصویر یا فایل صوتی', 'Choose an image or audio file')}
                disabled={!enabled || recording || uploadProgress !== null || requestingMic}
                tabIndex={-1}
                ref={fileInput}
                accept="image/jpeg,image/png,image/webp,audio/webm,audio/ogg,audio/wav,audio/mp4,.m4a"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void (file.type.startsWith('audio/') ? selectAudio(file) : attach(file));
                  e.target.value = '';
                }}
              />
            </div>
            <textarea
              ref={input}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={1}
              disabled={!enabled}
              placeholder={t('چیزی از دلت بنویس…', 'A little something from your heart…')}
              aria-label={t('متن پیام', 'Your message')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              type="submit"
              disabled={
                !enabled || recording || uploadProgress !== null || (!body.trim() && !attachment)
              }
              aria-label={t('ارسال پیام', 'Send message')}
            >
              <Send size={18} />
            </Button>
          </div>
          <p className="composer-note">
            {t(
              'ضبط حداکثر ۲ دقیقه · در صورت نبود میکروفن، متن یا فایل صوتی بفرست.',
              'Record up to 2 minutes · No microphone? Send text or choose an audio file.',
            )}
          </p>
        </form>
      </section>
      <Modal
        open={!!reactTo}
        onClose={() => setReactTo(null)}
        title={t('یک واکنش کوچک', 'A little reaction')}
      >
        <div className="mood-select">
          {reactions.map((reaction) => (
            <button
              className="mood-option"
              key={reaction.id}
              onClick={async () => {
                if (reactTo) {
                  const result = await action.run({
                    type: 'message.react',
                    id: reactTo.id,
                    emoji: reaction.id,
                  });
                  if (result.ok) setReactTo(null);
                }
              }}
            >
              <span style={{ fontSize: 28 }}>{reaction.value}</span>
              <span>{t(reaction.fa, reaction.en)}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
