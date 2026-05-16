import { SharedDocsPageContent, type PageData } from '@/components/shared-doc-page';
import { sourceZh } from '@/lib/source';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = sourceZh.getPage(params.slug);
  if (!page) notFound();

  return (
    <SharedDocsPageContent
      sourceLoader={sourceZh}
      page={page}
      pageData={page.data as unknown as PageData}
      contentDir="content/zh/docs"
    />
  );
}

export async function generateStaticParams() {
  return sourceZh.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = sourceZh.getPage(params.slug);
  if (!page) return {};

  const metaData = page.data as unknown as PageData;

  return {
    title: metaData.title,
    description: metaData.description,
  };
}
