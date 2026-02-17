import type {
    ConfirmUploadRequest,
    CreateResourceRequest,
    PresignedUploadResponse,
    PresignedUrlResponse,
    Resource,
} from '@mosaic/api'

export type ResourceType = Resource['resourceType']

export type {
    Resource, ConfirmUploadRequest as ServerConfirmUploadRequest, CreateResourceRequest as ServerCreateResourceRequest,
    PresignedUploadResponse as ServerPresignedUploadResponse, PresignedUrlResponse as ServerPresignedUrlResponse, Resource as ServerResourceResponse
}

export interface ResourcePreview {
  filename: string
  previewUrl: string
  type: ResourceType
  size?: number
}
