export interface UploadedResource {
  filename: string;
  size: number;
  mimeType: string;
  resourceType: 'image' | 'voice' | 'video' | 'file';
}

