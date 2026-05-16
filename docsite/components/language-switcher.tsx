'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * LanguageSwitcher toggles between English and Chinese pages.
 *
 * - On English pages → shows "中文" → navigates to `/zh/...`
 * - On Chinese pages → shows "EN" → navigates to the English version (strip `/zh` prefix)
 * - Home `/` → `/zh` and vice versa
 */
export function LanguageSwitcher() {
  const pathname = usePathname();

  const isChinese = pathname.startsWith('/zh');
  const targetHref = isChinese
    ? pathname.replace(/^\/zh/, '') || '/'
    : `/zh${pathname === '/' ? '' : pathname}`;

  return (
    <Link
      href={targetHref}
      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
      prefetch={false}
    >
      {isChinese ? 'EN' : '中文'}
    </Link>
  );
}
