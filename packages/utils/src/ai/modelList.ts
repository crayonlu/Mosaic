type OpenAICompatibleResponse = {
  data?: Array<{ id?: string }>
}

type AnthropicCompatibleResponse = {
  models?: Array<{ id?: string; api_name?: string; name?: string }>
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

  const json = ((await res.json()) ?? {}) as OpenAICompatibleResponse & AnthropicCompatibleResponse

  if (Array.isArray(json.data)) {
    return json.data
      .map(model => model.id ?? '')
      .filter(Boolean)
      .sort()
  }

  if (Array.isArray(json.models)) {
    return json.models
      .map(model => model.id ?? model.api_name ?? model.name ?? '')
      .filter(Boolean)
      .sort()
  }

  return []
}
