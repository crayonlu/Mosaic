/// <reference types="vite/client" />

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      'solid-media': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        type?: 'image' | 'video'
        fallback?: string
        alt?: string
        poster?: string
        preload?: string
        autoplay?: boolean
        loop?: boolean
        muted?: boolean
        controls?: boolean
        playsinline?: boolean
      }
    }
  }
}
