import { useCallback, useEffect, useRef, useState } from "react"

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  })
  const [tick, setTick] = useState(0)
  const depsKey = deps.join("\u0000")
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let active = true
    fetcherRef
      .current()
      .then((data) => {
        if (active) setState({ data, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (active) {
          setState((s) => ({
            ...s,
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          }))
        }
      })
    return () => {
      active = false
    }
  }, [depsKey, tick])

  const refetch = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    setTick((t) => t + 1)
  }, [])

  return { ...state, refetch }
}
