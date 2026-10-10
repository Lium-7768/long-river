'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

/** 层级面包屑：长河 / 北宋 / 司马光 … 让人看清当前在哪一层。 */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-base text-white/45">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-2">
            {c.href && !last ? (
              <Link href={c.href} className="transition hover:text-white">
                {c.label}
              </Link>
            ) : (
              <span className={last ? 'text-white/80' : ''}>{c.label}</span>
            )}
            {!last && <ChevronRight className="h-4 w-4 text-white/25" />}
          </span>
        );
      })}
    </nav>
  );
}
