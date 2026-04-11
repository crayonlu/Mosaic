import { Button, DatePickerSheet, Input } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import {
    useCustomPushList,
    useDeleteCustomPush,
    useSaveCustomPush,
} from '@/lib/query/hooks/useCustomPush'
import { CustomPushData } from '@/lib/services/local-push/custom'
import { useThemeStore } from '@/stores/themeStore'
import { router } from 'expo-router'
import { ArrowLeft, Bell, Clock, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function CustomPushScreen() {
  const { theme } = useThemeStore()
  const { data: pushes = [] } = useCustomPushList()
  const { mutateAsync: saveCustomPush } = useSaveCustomPush()
  const { mutateAsync: deleteCustomPush } = useDeleteCustomPush()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPush, setEditingPush] = useState<CustomPushData | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [triggerDate, setTriggerDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [tempHour, setTempHour] = useState(new Date().getHours())
  const [tempMinute, setTempMinute] = useState(new Date().getMinutes())

  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const resetForm = () => {
    setTitle('')
    setBody('')
    setTriggerDate(new Date())
    setEditingPush(null)
    setShowAddForm(false)
  }

  const handleSave = async () => {
    if (!title.trim() || !body.trim()) {
      toast.show({
        type: 'warning',
        title: '填写不完整',
        message: '请填写标题和内容',
      })
      return
    }

    const pushData: CustomPushData = {
      name: editingPush?.name || `custom_${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      trigger: triggerDate.toISOString().slice(0, 16),
    }

    await saveCustomPush(pushData)

    toast.show({
      type: 'success',
      title: '保存成功',
      message: '自定义提醒已保存',
    })

    resetForm()
  }

  const handleDelete = async (name: string) => {
    await deleteCustomPush(name)
    toast.show({
      type: 'success',
      title: '已删除',
      message: '自定义提醒已删除',
    })
  }

  const handleEdit = (push: CustomPushData) => {
    setTitle(push.title)
    setBody(push.body)
    const date = new Date(push.trigger)
    setTriggerDate(date)
    setTempHour(date.getHours())
    setTempMinute(date.getMinutes())
    setEditingPush(push)
    setShowAddForm(true)
  }

  const openTimePicker = () => {
    setTempHour(triggerDate.getHours())
    setTempMinute(triggerDate.getMinutes())
    setShowTimePicker(true)
  }

  const applyTime = () => {
    const next = new Date(triggerDate)
    next.setHours(tempHour)
    next.setMinutes(tempMinute)
    next.setSeconds(0)
    next.setMilliseconds(0)
    setTriggerDate(next)
    setShowTimePicker(false)
  }

  const handleDateSelect = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    if (!year || !month || !day) {
      return
    }

    const next = new Date(triggerDate)
    next.setFullYear(year)
    next.setMonth(month - 1)
    next.setDate(day)
    setTriggerDate(next)
  }

  const formatPickerDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const formatTriggerTime = (trigger: string) => {
    const date = new Date(trigger)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <ArrowLeft size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>自定义提醒</Text>
        <TouchableOpacity onPress={() => setShowAddForm(true)} style={styles.headerAdd}>
          <Bell size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {showAddForm && (
          <View
            style={[styles.card, { backgroundColor: theme.surface }]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {editingPush ? '编辑提醒' : '新增提醒'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>标题</Text>
              <Input value={title} onChangeText={setTitle} placeholder="输入提醒标题" />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>内容</Text>
              <Input
                value={body}
                onChangeText={setBody}
                placeholder="输入提醒内容"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>提醒时间</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[
                    styles.dateTimeBtn,
                    { backgroundColor: theme.surfaceMuted },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: theme.text, marginLeft: 4 }}>
                    {triggerDate.toLocaleDateString('zh-CN')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.dateTimeBtn,
                    { backgroundColor: theme.surfaceMuted },
                  ]}
                  onPress={openTimePicker}
                >
                  <Text style={{ color: theme.text, marginLeft: 4 }}>
                    {triggerDate.toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formActions}>
              <Button title="取消" variant="secondary" onPress={resetForm} style={{ flex: 1 }} />
              <Button title="保存" variant="primary" onPress={handleSave} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            已设置的提醒 ({pushes.length})
          </Text>

          {pushes.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.surfaceMuted },
              ]}
            >
              <Bell size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>暂无自定义提醒</Text>
              <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
                点击右上角添加新的提醒
              </Text>
            </View>
          ) : (
            pushes.map(push => (
              <View
                key={push.name}
                style={[
                  styles.pushCard,
                  { backgroundColor: theme.surface },
                ]}
              >
                <View style={styles.pushInfo}>
                  <Text style={[styles.pushTitle, { color: theme.text }]}>{push.title}</Text>
                  <Text style={[styles.pushBody, { color: theme.textSecondary }]}>{push.body}</Text>
                  <View style={styles.pushTimeRow}>
                    <Clock size={12} color={theme.textSecondary} />
                    <Text style={[styles.pushTime, { color: theme.textSecondary }]}>
                      {formatTriggerTime(push.trigger)}
                    </Text>
                  </View>
                </View>
                <View style={styles.pushActions}>
                  <TouchableOpacity onPress={() => handleEdit(push)} style={styles.actionBtn}>
                    <Text style={{ color: theme.primary, fontSize: 14 }}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(push.name)}
                    style={styles.actionBtn}
                  >
                    <Trash2 size={16} color={theme.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <DatePickerSheet
        visible={showDatePicker}
        title="选择日期"
        selectedDate={formatPickerDate(triggerDate)}
        onSelect={handleDateSelect}
        onClose={() => setShowDatePicker(false)}
      />

      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.timeOverlay}>
          <Pressable style={styles.timeBackdrop} onPress={() => setShowTimePicker(false)} />
          <View style={[styles.timeSheet, { backgroundColor: theme.background }]}> 
            <Text style={[styles.timeSheetTitle, { color: theme.text }]}>选择时间</Text>

            <View style={styles.timeColumns}>
              <View style={styles.timeColumn}>
                <Text style={[styles.timeColumnLabel, { color: theme.textSecondary }]}>小时</Text>
                <ScrollView style={styles.timeOptions} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <TouchableOpacity
                      key={`hour-${hour}`}
                      style={[
                        styles.timeOption,
                        {
                          backgroundColor: tempHour === hour ? theme.surfaceMuted : 'transparent',
                        },
                      ]}
                      onPress={() => setTempHour(hour)}
                    >
                      <Text style={[styles.timeOptionText, { color: theme.text }]}>
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.timeColumn}>
                <Text style={[styles.timeColumnLabel, { color: theme.textSecondary }]}>分钟</Text>
                <ScrollView style={styles.timeOptions} showsVerticalScrollIndicator={false}>
                  {minuteOptions.map(minute => (
                    <TouchableOpacity
                      key={`minute-${minute}`}
                      style={[
                        styles.timeOption,
                        {
                          backgroundColor:
                            tempMinute === minute ? theme.surfaceMuted : 'transparent',
                        },
                      ]}
                      onPress={() => setTempMinute(minute)}
                    >
                      <Text style={[styles.timeOptionText, { color: theme.text }]}>
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.timeActions}>
              <Button
                title="取消"
                variant="secondary"
                onPress={() => setShowTimePicker(false)}
                style={{ flex: 1 }}
              />
              <Button title="确定" variant="primary" onPress={applyTime} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
  },
  headerAdd: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
  },
  formActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  timeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
  timeSheet: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 12,
  },
  timeSheetTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  timeColumn: {
    flex: 1,
  },
  timeColumnLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  timeOptions: {
    maxHeight: 180,
  },
  timeOption: {
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timeOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  timeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  listSection: {},
  sectionTitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.7,
  },
  pushCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pushInfo: {
    flex: 1,
  },
  pushTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  pushBody: {
    fontSize: 14,
    marginBottom: 8,
  },
  pushTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pushTime: {
    fontSize: 12,
  },
  pushActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    padding: 8,
  },
})
