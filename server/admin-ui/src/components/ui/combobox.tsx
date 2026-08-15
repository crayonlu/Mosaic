import { Combobox } from "@base-ui/react/combobox"
import { Check, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { LoadingSpinner } from "./spinner"

const modelCache = new Map<string, Promise<string[]>>()

function fetchModelList(baseUrl: string, apiKey?: string): Promise<string[]> {
  return (async () => {
    const url = `${baseUrl.replace(/\/+$/, "")}/models`
    const res = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    })
    if (!res.ok) throw new Error(String(res.status))
    const json = (await res.json()) as { data?: Array<{ id?: string }> }
    if (!Array.isArray(json.data)) return []
    return json.data
      .map((m) => m.id ?? "")
      .filter(Boolean)
      .sort()
  })()
}

interface ModelComboboxProps {
  value: string
  onChange: (model: string) => void
  baseUrl: string
  apiKey?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ModelCombobox({
  value,
  onChange,
  baseUrl,
  apiKey,
  placeholder,
  disabled,
  className,
}: ModelComboboxProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const cacheKey = `${baseUrl}|${apiKey ?? ""}`

  const loadModels = useCallback(
    async (force = false) => {
      if (!baseUrl.trim()) return
      setStatus("loading")
      try {
        let p = force ? null : modelCache.get(cacheKey)
        if (!p) {
          p = fetchModelList(baseUrl, apiKey)
          modelCache.set(cacheKey, p)
          p.catch(() => modelCache.delete(cacheKey))
        }
        const list = await p
        setModels(list)
        setStatus("idle")
      } catch {
        modelCache.delete(cacheKey)
        setStatus("error")
      }
    },
    [baseUrl, apiKey, cacheKey]
  )

  const filtered = query.trim()
    ? models.filter((m) => m.toLowerCase().includes(query.toLowerCase()))
    : models

  return (
    <Combobox.Root
      items={filtered}
      value={value || null}
      onValueChange={(v) => onChange(v ?? "")}
      onInputValueChange={(v) => setQuery(v)}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <div className={cn("relative", className)}>
        <MagnifyingGlass
          size={14}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary"
        />
        <Combobox.Input
          placeholder={placeholder}
          onFocus={() => {
            void loadModels()
            setOpen(true)
          }}
          className={cn(
            "h-[40px] w-full rounded-md bg-subtle pr-3 pl-9 text-base text-ink transition-colors outline-none md:h-9 md:text-sm",
            "placeholder:text-ink-tertiary",
            "focus:bg-surface focus:ring-1 focus:ring-primary/50 focus:ring-inset",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        />
      </div>
      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          className="z-100 w-[var(--anchor-width)]"
        >
          <Combobox.Popup className="animate-pop-in overflow-hidden rounded-lg bg-surface shadow-pop ring-1 ring-hairline">
            {status === "loading" && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink-tertiary">
                <LoadingSpinner size={14} className="text-ink-tertiary" />
                {t("common.loading")}
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-[13px] text-error">
                  <WarningCircle size={14} />
                  {t("aiSettings.fetchFailed")}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadModels(true)}
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}
            {status === "idle" && filtered.length === 0 && (
              <div className="px-3 py-2.5 text-[13px] text-ink-tertiary">
                {t("aiSettings.modelPlaceholder")}
              </div>
            )}
            {status === "idle" && filtered.length > 0 && (
              <Combobox.List className="max-h-56 overflow-y-auto p-1">
                {filtered.map((m) => (
                  <Combobox.Item
                    key={m}
                    value={m}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-subtle"
                  >
                    <span className="truncate">{m}</span>
                    {m === value && (
                      <Check size={14} className="shrink-0 text-primary" />
                    )}
                  </Combobox.Item>
                ))}
              </Combobox.List>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
