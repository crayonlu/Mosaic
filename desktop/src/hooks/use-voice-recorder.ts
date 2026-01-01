import { useState, useRef, useCallback } from 'react'
import { assetCommands } from '@/utils/callRust'
import { useInputStore } from '@/stores/input-store'

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { setVoiceRecordingState } = useInputStore()

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setVoiceRecordingState('recording')
    } catch (error) {
      console.error('无法访问麦克风:', error)
      throw error
    }
  }, [setVoiceRecordingState])

  const stopRecording = useCallback(async (): Promise<{
    filename: string
    previewUrl: string
  } | null> => {
    if (!mediaRecorderRef.current || !isRecording) {
      return null
    }

    return new Promise(resolve => {
      const mediaRecorder = mediaRecorderRef.current!

      mediaRecorder.onstop = async () => {
        try {
          setIsProcessing(true)
          setVoiceRecordingState('processing')

          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm;codecs=opus',
          })

          const previewUrl = URL.createObjectURL(audioBlob)

          const arrayBuffer = await audioBlob.arrayBuffer()
          const uint8Array = Array.from(new Uint8Array(arrayBuffer))

          const timestamp = Date.now()
          const tempFileName = `recording-${timestamp}.webm`

          const tempFilePath = await assetCommands.saveTempAudio(tempFileName, uint8Array)

          const uploadedResources = await assetCommands.uploadFiles([tempFilePath])

          setIsRecording(false)
          setIsProcessing(false)
          setVoiceRecordingState('idle')
          audioChunksRef.current = []

          if (uploadedResources.length > 0) {
            resolve({
              filename: uploadedResources[0].filename,
              previewUrl,
            })
          } else {
            URL.revokeObjectURL(previewUrl)
            resolve(null)
          }
        } catch (error) {
          console.error('保存录音失败:', error)
          setIsRecording(false)
          setIsProcessing(false)
          setVoiceRecordingState('idle')
          resolve(null)
        }
      }

      mediaRecorder.stop()
      setIsRecording(false)
    })
  }, [isRecording, setVoiceRecordingState])

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      audioChunksRef.current = []
      setIsRecording(false)
      setIsProcessing(false)
      setVoiceRecordingState('idle')
    }
  }, [isRecording, setVoiceRecordingState])

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    cancelRecording,
  }
}
