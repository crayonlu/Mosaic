export const hashUrl = (url: string): string => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export const hashBuffer = async (buffer: ArrayBuffer): Promise<string> => {
  const crypto = globalThis.crypto;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
};

export const createCacheFilename = (url: string, ext?: string): string => {
  const hash = hashUrl(url);
  const extension = ext ?? getExtension(url);
  return `${hash}.${extension}`;
};

export const getExtension = (url: string): string => {
  const match = url.match(/\.([^./?#]+)(?:[?#]|$)/);
  return match ? match[1]!.toLowerCase() : 'bin';
};

export const getMimeFromExtension = (ext: string): string => {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
};
