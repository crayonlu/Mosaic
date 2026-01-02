/**
 * Voice Recording Types
 * Voice memo and transcription functionality
 */

export interface VoiceRecording {
  id: string
  duration: number // seconds
  size: number // bytes
  localPath: string
  createdAt: string
}

export interface TranscriptionResult {
  text: string
  confidence: number
  timestamp: string
}
