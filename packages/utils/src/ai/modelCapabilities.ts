export interface ModelCapabilities {
  supportsVision: boolean
  supportsThinking: boolean
}

export async function detectModelCapabilities(
  baseUrl: string,
  apiKey: string,
  model: string
): Promise<ModelCapabilities> {
  const fallback: ModelCapabilities = { supportsVision: false, supportsThinking: false }

  if (!baseUrl || !apiKey || !model) return fallback

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return fallback

    const { data } = await res.json()
    if (!Array.isArray(data)) return fallback

    const modelInfo = data.find((m: { id: string }) => m.id === model)
    if (!modelInfo) return fallback

    const inputModalities: string[] = modelInfo.input_modalities ?? []
    const features: string[] = modelInfo.features ?? []

    return {
      supportsVision: inputModalities.includes('image') || inputModalities.includes('video'),
      supportsThinking: features.includes('reasoning'),
    }
  } catch {
    return fallback
  }
}
