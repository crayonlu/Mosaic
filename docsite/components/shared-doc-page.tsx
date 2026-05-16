import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { getMDXComponents } from '@/components/mdx';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getPageMarkdownUrl } from '@/lib/source';
import { gitConfig } from '@/lib/shared';
import type { TOCItemType } from 'fumadocs-core/toc';
import type { ReactNode } from 'react';
import React from 'react';

export type PageData = {
  body: React.ComponentType<{ components?: Record<string, unknown> }>;
  toc: TOCItemType[];
  title?: string;
  description?: string;
  full?: boolean;
};

/**
 * Shared docs page renderer for both English and Chinese doc pages.
 */
export function SharedDocsPageContent({
  sourceLoader,
  page,
  pageData,
  contentDir,
  children,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceLoader: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any;
  pageData: PageData;
  contentDir: string;
  children?: ReactNode;
}) {
  const MDX = pageData.body;
  const markdownUrl = getPageMarkdownUrl(page).url;

  return (
    <DocsPage toc={pageData.toc} full={pageData.full}>
      <DocsTitle>{pageData.title}</DocsTitle>
      <DocsDescription className="mb-0">{pageData.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${contentDir}/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(sourceLoader, page),
          })}
        />
      </DocsBody>
      {children}
    </DocsPage>
  );
}

