import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { sourceZh } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';

export default function ZhDocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout tree={sourceZh.getPageTree()} {...baseOptions()}>
      {children}
    </DocsLayout>
  );
}
