import CustomSearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import React from 'react';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://crayonlu.github.io/Mosaic'),
  title: { default: 'Mosaic', template: '%s | Mosaic' },
  description: 'A digital second brain for notes, moods, and memories.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          search={{
            enabled: true,
            SearchDialog: CustomSearchDialog,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
