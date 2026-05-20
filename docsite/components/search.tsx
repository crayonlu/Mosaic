'use client';

import type { AnyOrama } from '@orama/orama';
import { create } from '@orama/orama';
import { createTokenizer } from '@orama/tokenizers/mandarin';
import { useDocsSearch } from 'fumadocs-core/search/client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { usePathname } from 'next/navigation';

function useLocale(): string {
  const pathname = usePathname();
  return pathname.startsWith('/zh') ? 'zh' : 'en';
}

async function initStaticOrama(locale: string): Promise<AnyOrama> {
  if (locale === 'zh') {
    return create({
      schema: {
        _: 'string',
      },
      language: 'chinese',
      components: {
        tokenizer: createTokenizer(),
      },
    });
  }

  return create({
    schema: {
      _: 'string',
    },
    language: 'english',
  });
}

export default function CustomSearchDialog(props: SharedProps) {
  const locale = useLocale();
  const searchApi = locale === 'zh' ? '/api/zh/search' : '/api/search';

  const { search, setSearch, query } = useDocsSearch({
    type: 'static',
    from: searchApi,
    locale,
    initOrama: () => initStaticOrama(locale),
  });

  return (
    <SearchDialog
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
      {...props}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={query.data !== 'empty' ? query.data : null}
        />
        <SearchDialogFooter className="flex flex-row items-center gap-2 text-xs text-muted-foreground">
          <kbd className="rounded border bg-secondary px-1.5 py-0.5 text-xs">
            ↑↓
          </kbd>
          <span>navigate</span>
          <kbd className="rounded border bg-secondary px-1.5 py-0.5 text-xs">
            ⌘K
          </kbd>
          <span>close</span>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
