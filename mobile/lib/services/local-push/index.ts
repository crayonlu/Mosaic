import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export const requestNotificationPermission = async () => {
  const { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync()
    return newStatus === 'granted'
  }
  return true
}

export const triggerLocalNotification = async () => {
  try {
    console.log('触发本地推送通知')
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '测试通知',
        body: '这是一条来自开发界面的本地推送通知',
      },
      trigger: null,
    })
  } catch (error) {
    console.error('推送通知失败:', error)
  }
}
