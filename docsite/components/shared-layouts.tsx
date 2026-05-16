import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import type { ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';

export function SharedHomeLayout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}

export function SharedDocsLayout({
  children,
  tree,
}: {
  children: ReactNode;
  tree: PageTree.Root;
}) {
  return (
    <DocsLayout tree={tree} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}

