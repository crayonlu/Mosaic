type OpenAICompatibleResponse = {
  data?: Array<{ id?: string }>
}

export async function fetchAvailableModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  if (!baseUrl) return []

  const url = `${baseUrl.replace(/\/+$/, '')}/models`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  })

  if (!res.ok) {
    throw new Error(String(res.status))
  }

  const json = ((await res.json()) ?? {}) as OpenAICompatibleResponse

  if (Array.isArray(json.data)) {
    return json.data
      .map(model => model.id ?? '')
      .filter(Boolean)
      .sort()
  }

  return []
}
