import { sourceZh } from '@/lib/source'
import { createTokenizer } from '@orama/tokenizers/mandarin'
import { createFromSource } from 'fumadocs-core/search/server'

export const revalidate = false

export const { staticGET: GET } = createFromSource(sourceZh, {
  components: {
    tokenizer: createTokenizer(),
  },
  search: {
    threshold: 0,
    tolerance: 0,
  },
})
