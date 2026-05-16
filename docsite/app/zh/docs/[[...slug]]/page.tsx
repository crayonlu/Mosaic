import { sourceZh } from '@/lib/source';
import {
  DocsBody,
  DocsPage,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import React from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';

type PageData = {
  body: React.ComponentType<{ components?: Record<string, unknown> }>;
  toc: TOCItemType[];
  title?: string;
  description?: string;
  full?: boolean;
};

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = sourceZh.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as PageData;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc} full={data.full}>
      <DocsBody>
        <MDX />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return sourceZh.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = sourceZh.getPage(params.slug);
  if (!page) return {};

  const data = page.data as unknown as PageData;

  return {
    title: data.title,
    description: data.description,
  };
}
