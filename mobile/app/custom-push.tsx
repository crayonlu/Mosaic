import { Button, DatePickerSheet, Input, ScreenHeader } from '@/components/ui'
import { toast } from '@/components/ui/Toast'
import i18n from '@/lib/i18n'
import {
  useCustomPushList,
  useDeleteCustomPush,
  useSaveCustomPush,
} from '@/lib/query/hooks/useCustomPush'
import { CustomPushData } from '@/lib/services/local-push/custom'
import { useThemeStore } from '@/stores/themeStore'
import { Bell, Clock, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function CustomPushScreen() {
  const { t } = useTranslation()
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
        title: t('push.incomplete'),
        message: t('push.incompleteMsg'),
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

    resetForm()
  }

  const handleDelete = async (name: string) => {
    await deleteCustomPush(name)
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
    return date.toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        showBack
        title={t('push.pushNotifications')}
        right={
          <TouchableOpacity onPress={() => setShowAddForm(true)} style={{ padding: 4 }}>
            <Bell size={24} color={theme.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content}>
        {showAddForm && (
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {editingPush ? t('push.editReminder') : t('push.newReminder')}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('push.title')}</Text>
              <Input value={title} onChangeText={setTitle} placeholder={t('push.title')} />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t('push.content')}
              </Text>
              <Input
                value={body}
                onChangeText={setBody}
                placeholder={t('push.content')}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t('push.selectTime')}
              </Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.dateTimeBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: theme.text, marginLeft: 4 }}>
                    {triggerDate.toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateTimeBtn, { backgroundColor: theme.surfaceMuted }]}
                  onPress={openTimePicker}
                >
                  <Text style={{ color: theme.text, marginLeft: 4 }}>
                    {triggerDate.toLocaleTimeString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.formActions}>
              <Button
                title={t('push.cancel')}
                variant="secondary"
                onPress={resetForm}
                style={{ flex: 1 }}
              />
              <Button
                title={t('push.save')}
                variant="primary"
                onPress={handleSave}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        <View style={styles.listSection}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t('push.reminders', { count: pushes.length })}
          </Text>

          {pushes.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surfaceMuted }]}>
              <Bell size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {t('push.empty')}
              </Text>
              <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
                {t('push.addHint')}
              </Text>
            </View>
          ) : (
            pushes.map(push => (
              <View key={push.name} style={[styles.pushCard, { backgroundColor: theme.surface }]}>
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
                    <Text style={{ color: theme.primary, fontSize: 14 }}>{t('common.edit')}</Text>
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
        title={t('push.selectDate')}
        selectedDate={formatPickerDate(triggerDate)}
        onSelect={handleDateSelect}
        onClose={() => setShowDatePicker(false)}
      />

      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={styles.timeOverlay}>
          <Pressable style={styles.timeBackdrop} onPress={() => setShowTimePicker(false)} />
          <View style={[styles.timeSheet, { backgroundColor: theme.background }]}>
            <Text style={[styles.timeSheetTitle, { color: theme.text }]}>
              {t('push.selectTime')}
            </Text>

            <View style={styles.timeColumns}>
              <View style={styles.timeColumn}>
                <Text style={[styles.timeColumnLabel, { color: theme.textSecondary }]}>
                  {t('push.hour')}
                </Text>
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
                <Text style={[styles.timeColumnLabel, { color: theme.textSecondary }]}>
                  {t('push.minute')}
                </Text>
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
                title={t('push.cancel')}
                variant="secondary"
                onPress={() => setShowTimePicker(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={t('push.confirm')}
                variant="primary"
                onPress={applyTime}
                style={{ flex: 1 }}
              />
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
