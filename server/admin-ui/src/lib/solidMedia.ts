import 'solid-media';
import { core } from 'solid-media';
import { getToken } from '../api';

let configured = false;

export function ensureSolidMediaConfigured(): void {
  if (configured) return;

  core.setFetcher(async (url: string) => {
    // Handle blob: and data: URIs directly
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load local media: HTTP ${response.status}`);
      }
      return response.blob();
    }

    const token = getToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const error = new Error(`Failed to load media: HTTP ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    return response.blob();
  });

  configured = true;
}

export { core as solidMediaCore };

