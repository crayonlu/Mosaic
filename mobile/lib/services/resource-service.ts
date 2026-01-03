import { execute, queryAll, queryFirst } from '@/lib/database'
import type { Resource, ResourceType } from '@/types/resource'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'

/**
 * Resource Service
 * Handles all resource-related database and file operations
 */

class ResourceService {
  // ============================================================================
  // Configuration
  // ============================================================================

  private readonly RESOURCE_DIR = `${(FileSystem as any).documentDirectory}resources/`

  /**
   * Initialize resource directory
   */
  private async ensureResourceDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(this.RESOURCE_DIR)
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.RESOURCE_DIR, { intermediates: true })
    }
  }

  /**
   * Generate unique ID for resource
   */
  private generateId(): string {
    return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get current timestamp in milliseconds
   */
  private getCurrentTimestamp(): number {
    return Date.now()
  }

  /**
   * Detect resource type from mime type
   */
  private detectResourceType(mimeType: string): ResourceType {
    if (mimeType.startsWith('image/')) {
      return 'image'
    } else if (mimeType.startsWith('audio/')) {
      return 'audio'
    } else if (mimeType.startsWith('video/')) {
      return 'video'
    } else {
      return 'file'
    }
  }

  /**
   * Get safe filename (prevent path traversal)
   */
  private getSafeFilename(filename: string): string {
    // Remove any directory path components
    const name = filename.replace(/^.*[\\/]/, '')
    // Remove special characters that might cause issues
    return name.replace(/[<>:"|?*]/g, '_')
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return bytes + ' B'
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB'
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }
  }

  /**
   * Validate file size (max 10MB)
   */
  private validateFileSize(size: number): boolean {
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    return size <= MAX_FILE_SIZE
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Upload a resource from file picker result
   */
  async uploadResource(
    file: DocumentPicker.DocumentPickerAsset,
    memoId?: string
  ): Promise<Resource> {
    try {
      // Validate file size
      if (file.size && !this.validateFileSize(file.size)) {
        throw new Error(`文件大小超过限制（最大10MB）`)
      }

      // Ensure resource directory exists
      await this.ensureResourceDir()

      // Generate unique filename to prevent conflicts
      const resourceId = this.generateId()
      const safeOriginalName = this.getSafeFilename(file.name || 'unknown')
      const filename = `${resourceId}_${safeOriginalName}`
      const localPath = `${this.RESOURCE_DIR}${filename}`

      // Move file to resources directory
      await FileSystem.moveAsync({
        from: file.uri,
        to: localPath,
      })

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(localPath)
      const fileSize = (fileInfo as any).size || 0

      // Create database record
      const now = this.getCurrentTimestamp()
      await execute(
        `INSERT INTO resources (id, memo_id, filename, resource_type, mime_type, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          resourceId,
          memoId || null,
          filename,
          this.detectResourceType(file.mimeType || 'application/octet-stream'),
          file.mimeType || 'application/octet-stream',
          fileSize,
          now,
        ]
      )

      // Return resource with URL
      return {
        id: resourceId,
        memoId: memoId || '',
        filename,
        resourceType: this.detectResourceType(file.mimeType || 'application/octet-stream'),
        mimeType: file.mimeType || 'application/octet-stream',
        size: fileSize,
        createdAt: now,
      }
    } catch (error) {
      console.error('Upload resource failed:', error)
      throw error
    }
  }

  /**
   * Upload multiple resources
   */
  async uploadResources(
    files: DocumentPicker.DocumentPickerAsset[],
    memoId?: string
  ): Promise<Resource[]> {
    const uploadPromises = files.map(file => this.uploadResource(file, memoId))
    return Promise.all(uploadPromises)
  }

  /**
   * Get local file URI for a resource
   */
  getResourceUri(filename: string): string {
    return `${this.RESOURCE_DIR}${filename}`
  }

  /**
   * Check if resource file exists
   */
  async resourceExists(filename: string): Promise<boolean> {
    const uri = this.getResourceUri(filename)
    const info = await FileSystem.getInfoAsync(uri)
    return info.exists
  }

  /**
   * Delete resource file from disk
   */
  async deleteResourceFile(filename: string): Promise<void> {
    try {
      const uri = this.getResourceUri(filename)
      const exists = await this.resourceExists(filename)
      if (exists) {
        await FileSystem.deleteAsync(uri)
      }
    } catch (error) {
      console.error('Delete resource file failed:', error)
    }
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  /**
   * Get resource by id
   */
  async getResource(id: string): Promise<Resource | null> {
    const row = await queryFirst<any>(
      `SELECT * FROM resources WHERE id = ?`,
      [id]
    )

    if (!row) {
      return null
    }

    return {
      id: row.id,
      memoId: row.memoId,
      filename: row.filename,
      resourceType: row.resourceType,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
    }
  }

  /**
   * Get resources for a memo
   */
  async getMemoResources(memoId: string): Promise<Resource[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM resources WHERE memo_id = ? ORDER BY created_at DESC`,
      [memoId]
    )

    return rows.map(row => ({
      id: row.id,
      memoId: row.memoId,
      filename: row.filename,
      resourceType: row.resourceType,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
    }))
  }

  /**
   * Link resources to a memo
   */
  async linkResourcesToMemo(resourceIds: string[], memoId: string): Promise<void> {
    for (const resourceId of resourceIds) {
      await execute(
        `UPDATE resources SET memo_id = ? WHERE id = ? AND memo_id IS NULL`,
        [memoId, resourceId]
      )
    }
  }

  /**
   * Unlink resources from a memo (set memo_id to NULL)
   */
  async unlinkResourcesFromMemo(resourceIds: string[]): Promise<void> {
    for (const resourceId of resourceIds) {
      await execute(
        `UPDATE resources SET memo_id = NULL WHERE id = ?`,
        [resourceId]
      )
    }
  }

  /**
   * Get orphaned resources (not linked to any memo)
   */
  async getOrphanedResources(): Promise<Resource[]> {
    const rows = await queryAll<any>(
      `SELECT * FROM resources WHERE memo_id IS NULL ORDER BY created_at DESC`
    )

    return rows.map(row => ({
      id: row.id,
      memoId: '',
      filename: row.filename,
      resourceType: row.resourceType,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
    }))
  }

  /**
   * Delete resource from database and disk
   */
  async deleteResource(id: string): Promise<void> {
    const resource = await this.getResource(id)
    if (resource) {
      // Delete from disk
      await this.deleteResourceFile(resource.filename)
      // Delete from database
      await execute(`DELETE FROM resources WHERE id = ?`, [id])
    }
  }

  /**
   * Delete multiple resources
   */
  async deleteResources(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteResource(id)
    }
  }

  /**
   * Clean up orphaned resources (older than 24 hours)
   */
  async cleanupOrphanedResources(): Promise<number> {
    const now = this.getCurrentTimestamp()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    const rows = await queryAll<{ id: string; filename: string }>(
      `SELECT id, filename FROM resources 
       WHERE memo_id IS NULL AND created_at < ?`,
      [oneDayAgo]
    )

    for (const row of rows) {
      await this.deleteResource(row.id)
    }

    return rows.length
  }

  /**
   * Get resources by type
   */
  async getResourcesByType(type: ResourceType, memoId?: string): Promise<Resource[]> {
    let query = `SELECT * FROM resources WHERE resource_type = ?`
    const params: any[] = [type]

    if (memoId) {
      query += ` AND memo_id = ?`
      params.push(memoId)
    }

    query += ` ORDER BY created_at DESC`

    const rows = await queryAll<any>(query, params)

    return rows.map(row => ({
      id: row.id,
      memoId: row.memoId,
      filename: row.filename,
      resourceType: row.resourceType,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt,
    }))
  }

  /**
   * Get total storage used by resources
   */
  async getTotalStorageSize(): Promise<number> {
    const result = await queryFirst<{ total: number }>(
      `SELECT COALESCE(SUM(size), 0) as total FROM resources`
    )
    return result?.total || 0
  }

  /**
   * Get storage size by type
   */
  async getStorageSizeByType(): Promise<Record<ResourceType, number>> {
    const result = await queryAll<{ resource_type: ResourceType; total: number }>(
      `SELECT resource_type, COALESCE(SUM(size), 0) as total 
       FROM resources 
       GROUP BY resource_type`
    )

    const sizes: Record<ResourceType, number> = {
      image: 0,
      audio: 0,
      video: 0,
      file: 0,
    }

    for (const row of result) {
      sizes[row.resource_type] = row.total
    }

    return sizes
  }
}

// Export singleton instance
export const resourceService = new ResourceService()
