import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="not-found">
      <p className="wordmark" dir="ltr">
        HIM & I
      </p>
      <h1>این صفحه پیدا نشد</h1>
      <p>We couldn’t find this page. Your little world is still here.</p>
      <Link href="/home" className="button primary">
        بازگشت به خانه · Back home
      </Link>
    </main>
  );
}
