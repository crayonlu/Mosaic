import { source } from '@/lib/source';
import { SharedDocsLayout } from '@/components/shared-layouts';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return <SharedDocsLayout tree={source.getPageTree()}>{children}</SharedDocsLayout>;
}
