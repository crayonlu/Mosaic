import { sourceZh } from '@/lib/source';
import { SharedDocsLayout } from '@/components/shared-layouts';

export default function ZhDocsLayout({ children }: { children: React.ReactNode }) {
  return <SharedDocsLayout tree={sourceZh.getPageTree()}>{children}</SharedDocsLayout>;
}
