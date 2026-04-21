import { useThemeStore } from '@/stores/themeStore'
import { ChevronDown, X } from 'lucide-react-native'
import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ModelComboboxProps {
  value: string
  onChange: (model: string) => void
  baseUrl: string
  apiKey: string
  placeholder?: string
  label?: string
}

async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const json = (await res.json()) as { data?: { id: string }[] } | { models?: { name: string }[] }

  // OpenAI-compatible: { data: [{ id: string }] }
  if ('data' in json && Array.isArray(json.data)) {
    return json.data
      .map(m => m.id)
      .filter(Boolean)
      .sort()
  }
  // Anthropic-compatible: { models: [{ api_name/id/name }] }
  if ('models' in json && Array.isArray(json.models)) {
    return (json.models as { id?: string; api_name?: string; name?: string }[])
      .map(m => m.id ?? m.api_name ?? m.name ?? '')
      .filter(Boolean)
      .sort()
  }
  return []
}

export function ModelCombobox({
  value,
  onChange,
  baseUrl,
  apiKey,
  placeholder = 'gpt-4o',
  label = '模型',
}: ModelComboboxProps) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()

  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const searchRef = useRef<TextInput>(null)

  const loadModels = async () => {
    if (!baseUrl.trim() || !apiKey.trim()) return
    setLoading(true)
    setFetchError(null)
    try {
      const list = await fetchModels(baseUrl, apiKey)
      setModels(list)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '获取失败')
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    setSearch('')
    loadModels()
    setTimeout(() => searchRef.current?.focus(), 200)
  }

  const handleSelect = (model: string) => {
    onChange(model)
    setOpen(false)
  }

  const filtered = search.trim()
    ? models.filter(m => m.toLowerCase().includes(search.toLowerCase()))
    : models

  return (
    <>
      <View style={styles.wrapper}>
        {label ? <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text> : null}
        <TouchableOpacity
          style={[
            styles.trigger,
            { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
          ]}
          onPress={handleOpen}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.triggerText, { color: value ? theme.text : theme.textSecondary }]}
            numberOfLines={1}
          >
            {value || placeholder}
          </Text>
          <ChevronDown size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[styles.sheet, { backgroundColor: theme.background, paddingTop: insets.top + 12 }]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>选择模型</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
            <TextInput
              ref={searchRef}
              style={[
                styles.searchInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceMuted,
                },
              ]}
              value={search}
              onChangeText={setSearch}
              placeholder="搜索或输入模型名..."
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (search.trim()) handleSelect(search.trim())
              }}
            />
            {search.trim() && (
              <TouchableOpacity
                style={[styles.useInputBtn, { backgroundColor: theme.primary }]}
                onPress={() => handleSelect(search.trim())}
              >
                <Text style={[styles.useInputBtnText, { color: theme.onPrimary }]}>使用</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                获取模型列表...
              </Text>
            </View>
          )}

          {!loading && fetchError && (
            <View style={styles.errorRow}>
              <Text style={[styles.errorText, { color: theme.error }]}>
                {fetchError === '401' ? '请先填写正确的 API Key' : `获取失败: ${fetchError}`}
              </Text>
              <TouchableOpacity onPress={loadModels}>
                <Text style={[styles.retryText, { color: theme.primary }]}>重试</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !fetchError && models.length === 0 && !search && (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {!baseUrl.trim() || !apiKey.trim() ? '请先填写 API URL 和 Key' : '未获取到模型列表'}
              </Text>
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modelItem,
                  { borderBottomColor: theme.border },
                  item === value && { backgroundColor: theme.surfaceMuted },
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.modelName, { color: theme.text }]}>{item}</Text>
                {item === value && (
                  <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 12,
    marginBottom: 2,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    height: 44,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
  },
  sheet: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  useInputBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  useInputBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modelName: {
    flex: 1,
    fontSize: 14,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
