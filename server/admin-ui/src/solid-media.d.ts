// Declare solid-media as a valid JSX/Vue intrinsic element
declare module 'solid-media' {
  const solidMedia: any;
  export { solidMedia };
  export const core: {
    setFetcher: (fetcher: (url: string) => Promise<Blob>) => void;
  };
}

// Allow <solid-media> custom element in Vue templates
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'solid-media': any;
    }
  }
}

export { };

