'use client';
import { LockKeyhole, Heart, Flower2, Mail, Database, Bell, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '@/components/layout/app-shell';
import { useI18n } from '@/components/providers';
import { LinkButton } from '@/components/ui/primitives';
export function PrivacyScreen() {
  const { t } = useI18n();
  const sections = [
    {
      icon: Heart,
      fa: 'یک فضا، دقیقاً دو نفر',
      en: 'One space. Exactly two people.',
      bodyFa:
        'فقط دو حساب دعوت‌شده می‌توانند به یک فضای مشترک دسترسی داشته باشند. لینک دعوت به‌تنهایی اجازه‌ی خواندن داده‌ها نیست. حساب‌ها با ایمیل و رمز عبور توسط Supabase مدیریت می‌شوند.',
      bodyEn:
        'Only two invited accounts can belong to a shared space. An invitation link alone never grants data access. Supabase manages email and password accounts.',
    },
    {
      icon: LockKeyhole,
      fa: 'خصوصی، نه رمزگذاری سرتاسری',
      en: 'Private, not end-to-end encrypted.',
      bodyFa:
        'مجوزهای سرور و سیاست‌های سطح سطر پایگاه داده، دسترسی را محدود می‌کنند. فایل‌ها در فضای ذخیره‌سازی خصوصی نگه‌داری می‌شوند و لینک دسترسی حداکثر ۶۰ ثانیه اعتبار دارد. این برنامه رمزگذاری سرتاسری ندارد؛ مدیر مجاز زیرساخت ممکن است به داده‌ها دسترسی داشته باشد.',
      bodyEn:
        'Server authorization and database row-level security restrict access. Media uses private storage with signed URLs lasting up to 60 seconds. This application is not end-to-end encrypted; authorized infrastructure administrators may access stored data.',
    },
    {
      icon: Flower2,
      fa: 'داده‌های چرخه، فقط برای خودت',
      en: 'Your cycle data belongs to you.',
      bodyFa:
        'تاریخ دوره‌ها، علائم، یادداشت‌ها و پیش‌بینی‌ها به‌صورت پیش‌فرض فقط برای صاحب حساب قابل مشاهده‌اند. اشتراک‌گذاری وضعیت ساده یا تاریخ تقریبی، دو انتخاب مستقل هستند و هر زمان قابل لغوند. سوابق کامل هرگز به همراهتان داده نمی‌شوند. پیش‌بینی فقط یک تخمین است، نه توصیه پزشکی یا روش پیشگیری از بارداری.',
      bodyEn:
        'Period dates, symptoms, notes and predictions are owner-only by default. Sharing a simple status and sharing an approximate date are independent, revocable choices. Full records are never disclosed to your partner. Predictions are estimates, not medical advice or contraception.',
    },
    {
      icon: Mail,
      fa: 'حرف‌هایت، در زمان خودشان',
      en: 'Your words, in their own time.',
      bodyFa:
        'گیرنده نمی‌تواند متن یا تصویر نامه‌ی زمان‌بندی‌شده را پیش از زمان تعیین‌شده از پایگاه داده بخواند. نویسنده همیشه می‌تواند نامه‌ی خودش را ببیند. نامه پس از ارسال قابل ویرایش نیست؛ پیش از انتشار می‌توان آن را لغو کرد.',
      bodyEn:
        'A recipient cannot query the body or attachment of a scheduled letter before release. The sender can always see their own letter. Sent letters cannot be edited; scheduled letters can be cancelled before release.',
    },
    {
      icon: Bell,
      fa: 'اعلان‌های کم‌حرف و با اجازه',
      en: 'Quiet notifications, with permission.',
      bodyFa:
        'پوش‌ها متن گفتگو، نامه یا جزئیات سلامت را ندارند. اعلان‌های سلامت نیازمند فعال‌سازی جداگانه هستند. وضعیت شبکه، مجوز سیستم و سرویس ارسال بر تحویل اثر دارند؛ تحویل تضمین نمی‌شود. ثبت دستگاه با خروج یا خاموش‌کردن پوش لغو می‌شود.',
      bodyEn:
        'Push payloads do not include message bodies, letters or health details. Health reminders require separate opt-in. Connectivity, system permissions and providers affect delivery; delivery is not guaranteed. Device subscriptions are revoked on sign-out or when push is disabled.',
    },
    {
      icon: Database,
      fa: 'خروجی، حذف و نگه‌داری',
      en: 'Export, deletion and retention.',
      bodyFa:
        'در تنظیمات می‌توانید خروجی داده‌های مجازتان را بگیرید. خروجی سلامت جداگانه در بخش مراقبت از خودم است. حذف حساب نیازمند تأیید رمز و حذف محتوای متعلق به شماست؛ نامه‌های خطاب به شما نیز حذف می‌شوند؛ سایر محتوای همراهتان باقی می‌ماند. پس از حذف، دسترسی تازه به فایل رد می‌شود و پاک‌سازی قابل‌تلاش‌مجدد صف می‌شود. پیوند امضاشده‌ی قبلی ممکن است حداکثر ۶۰ ثانیه معتبر بماند؛ نسخه‌های قبلاً دانلودشده قابل پس‌گرفتن نیستند. اعلان‌ها پس از ۹۰ روز پاک می‌شوند. نسخه‌های پشتیبان ممکن است تا پایان دوره‌ی نگه‌داری میزبان باقی بمانند؛ مالک سرویس باید این مدت را پیش از انتشار مشخص کند.',
      bodyEn:
        'Settings lets you export your authorized data. Health export is separate in My wellbeing. Account deletion requires password confirmation and removes your owned content; letters addressed to you are also removed, while your partner’s other content remains. New file access is denied after deletion and physical erasure is durably queued for the cleanup job. Previously issued links may last up to 60 seconds; existing downloads cannot be recalled. Notifications expire after 90 days. Backups may retain deleted data until the host’s retention period ends; the operator must publish that period before launch.',
    },
    {
      icon: ShieldCheck,
      fa: 'شفافیت پیش از انتشار',
      en: 'Transparency before launch.',
      bodyFa:
        'این پروژه به‌صورت پیش‌فرض ابزار تحلیل یا رهگیری شخصی ندارد. برای پیوند موسیقی، سرویس خارجی باز می‌شود و سیاست همان سرویس اعمال می‌شود. مالک محصول باید نام مسئول پردازش داده، راه تماس، کشور میزبانی، مدت نگه‌داری پشتیبان و شرایط استفاده را پیش از ارائه‌ی عمومی اعلام کند.',
      bodyEn:
        'No personal analytics or tracking are enabled by default. Music links open an external provider governed by its own policy. Before public launch, the operator must publish the data controller, contact address, hosting region, backup retention, and terms of use.',
    },
  ];
  return (
    <>
      <PublicHeader />
      <main className="privacy-page">
        <div className="eyebrow" dir="ltr">
          CLOSENESS, WITH BOUNDARIES
        </div>
        <h1>{t('دوست‌داشتن، با احترام به حریم تو.', 'Love, with room for your privacy.')}</h1>
        <p className="privacy-lede">
          {t(
            'دونفره‌بودن به معنای اشتراک‌گذاشتن همه‌چیز نیست. انتخاب، آگاهی و امکانِ تغییر نظرت، بخشی از طراحی این خانه است.',
            'Being together doesn’t mean sharing everything. Choice, clarity, and the freedom to change your mind are part of this home’s design.',
          )}
        </p>
        {sections.map((section) => (
          <section className="privacy-section" key={section.en}>
            <h2>
              <section.icon size={21} strokeWidth={1.5} />
              {t(section.fa, section.en)}
            </h2>
            <p>{t(section.bodyFa, section.bodyEn)}</p>
          </section>
        ))}
        <LinkButton href="/home" variant="secondary">
          {t('بازگشت به خانه‌ی ما', 'Back to our little home')}
        </LinkButton>
      </main>
    </>
  );
}
