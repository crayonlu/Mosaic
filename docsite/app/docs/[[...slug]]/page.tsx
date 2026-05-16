import { SharedDocsPageContent, type PageData } from '@/components/shared-doc-page';
import { getPageImage, source } from '@/lib/source';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return (
    <SharedDocsPageContent
      sourceLoader={source}
      page={page}
      pageData={page.data as unknown as PageData}
      contentDir="content/docs"
    />
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const metaData = page.data as unknown as PageData;

  return {
    title: metaData.title,
    description: metaData.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  };
}
