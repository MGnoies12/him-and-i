'use client';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ImageIcon, FileWarning, Upload, X, LoaderCircle } from 'lucide-react';
import { useI18n, useToast } from '@/components/providers';
import type { Asset } from '@/types/models';
import { requestJSON, ClientError, errorText } from '@/lib/client-api';
import { ACCEPTED_MEDIA, MAX_UPLOAD_BYTES, type MediaKind } from '@/lib/media';
function MediaFailure({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="media-fallback">
      <FileWarning size={24} />
      <button onClick={retry}>{t('دریافت دوباره‌ی فایل', 'Reload private media')}</button>
    </div>
  );
}
function PlayableMedia({
  asset,
  alt,
  className,
}: {
  asset: Asset;
  alt: string;
  className: string;
}) {
  const { t } = useI18n();
  const [source, setSource] = useState('');
  const query = useQuery({
    queryKey: ['playback', asset.id],
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const signed = await requestJSON<{ data: { url: string } }>(`/api/media/${asset.id}`);
      const response = await fetch(signed.data.url, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new ClientError('request_failed', response.status);
      return response.blob();
    },
  });
  useEffect(() => {
    if (!query.data) return;
    const url = URL.createObjectURL(query.data);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [query.data]);
  if (query.isError) return <MediaFailure retry={() => void query.refetch()} />;
  if (!source)
    return (
      <div className={`media-fallback skeleton ${className}`}>
        <ImageIcon size={25} />
      </div>
    );
  // Whole clips are capped at 4 MiB. A transient blob permits seeking beyond the signed
  // URL's 60-second expiry without renewing the src and interrupting playback.
  if (asset.mime_type.startsWith('audio/'))
    return (
      <div className="voice-player">
        <audio
          controls
          preload="metadata"
          src={source}
          aria-label={t('پیام صوتی', 'Voice message')}
        />
        <small>
          {Math.ceil((asset.duration_ms || 0) / 1000)} {t('ثانیه', 'sec')}
        </small>
      </div>
    );
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={source}
      className={className}
      aria-label={alt || t('ویدیوی خصوصی', 'Private video')}
    />
  );
}
function PrivateImage({ asset, alt, className }: { asset: Asset; alt: string; className: string }) {
  const query = useQuery({
    queryKey: ['asset', asset.id],
    queryFn: async () =>
      (await requestJSON<{ data: { url: string } }>(`/api/media/${asset.id}`)).data,
    staleTime: 45000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const [failed, setFailed] = useState(false);
  if (query.isError || failed)
    return (
      <MediaFailure
        retry={() => {
          setFailed(false);
          void query.refetch();
        }}
      />
    );
  if (!query.data)
    return (
      <div className={`media-fallback skeleton ${className}`}>
        <ImageIcon size={25} />
      </div>
    );
  return (
    <img
      src={query.data.url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function PrivateMedia({
  asset,
  alt = '',
  className = '',
}: {
  asset: Asset;
  alt?: string;
  className?: string;
}) {
  return asset.mime_type.startsWith('image/') ? (
    <PrivateImage asset={asset} alt={alt} className={className} />
  ) : (
    <PlayableMedia asset={asset} alt={alt} className={className} />
  );
}
export function uploadFile(
  file: File,
  kind: MediaKind,
  onProgress: (n: number) => void,
  duration?: number,
): Promise<Asset> {
  if (file.size > MAX_UPLOAD_BYTES) return Promise.reject(new ClientError('file_too_large'));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media');
    xhr.responseType = 'json';
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response.data);
      else reject(new ClientError(xhr.response?.error || 'upload_failed', xhr.status));
    };
    xhr.onerror = () => reject(new ClientError('offline'));
    xhr.ontimeout = () => reject(new ClientError('upload_failed'));
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    if (duration) form.set('duration', String(Math.round(duration)));
    xhr.send(form);
  });
}
export function UploadField({
  kind,
  assets,
  onChange,
  disabled = false,
  max = 8,
  onBusyChange,
}: {
  kind: MediaKind;
  assets: Asset[];
  onChange: (assets: Asset[]) => void;
  disabled?: boolean;
  max?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  async function select(files: FileList | null) {
    if (!files) return;
    const all = [...assets];
    onBusyChange?.(true);
    for (const file of Array.from(files).slice(0, max - assets.length)) {
      setProgress(0);
      try {
        all.push(await uploadFile(file, kind, setProgress));
        onChange([...all]);
      } catch (error) {
        toast(errorText(error, t), 'error');
        break;
      }
    }
    setProgress(null);
    onBusyChange?.(false);
  }
  return (
    <div>
      <label className={`upload-zone ${disabled ? 'disabled' : ''}`}>
        <input
          type="file"
          accept={kind === 'letter' ? 'image/jpeg,image/png,image/webp' : ACCEPTED_MEDIA}
          multiple={max > 1}
          disabled={disabled || progress !== null || assets.length >= max}
          onChange={(e) => {
            void select(e.target.files);
            e.target.value = '';
          }}
        />
        {progress !== null ? (
          <LoaderCircle size={28} className="spin" />
        ) : (
          <Upload size={26} strokeWidth={1.5} />
        )}
        <strong>
          {progress !== null
            ? `${progress}%`
            : t('لحظه‌هایتان را اینجا اضافه کنید', 'Give your moments a place here')}
        </strong>
        <small>
          {t(
            'تصویر یا ویدیو · حداکثر ۴ مگابایت برای هر فایل',
            'Images or video · up to 4 MB per file',
          )}
        </small>
        {progress !== null && (
          <progress
            value={progress}
            max={100}
            aria-label={t('پیشرفت بارگذاری', 'Upload progress')}
          />
        )}
      </label>
      {assets.length > 0 && (
        <div className="upload-previews">
          {assets.map((asset) => (
            <div key={asset.id}>
              <PrivateMedia
                asset={asset}
                alt={t('پیش‌نمایش فایل انتخاب‌شده', 'Selected file preview')}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={t('حذف از انتخاب', 'Remove selection')}
                onClick={() => onChange(assets.filter((a) => a.id !== asset.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
