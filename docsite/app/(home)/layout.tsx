import { SharedHomeLayout } from '@/components/shared-layouts';

export default function Layout({ children }: LayoutProps<'/'>) {
  return <SharedHomeLayout>{children}</SharedHomeLayout>;
}
