/**
 * Modal Layout
 * For bottom sheet modals like editor and voice recording
 */

import { Stack } from 'expo-router'

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'transparentModal',
        animation: 'slide_from_bottom',
        headerShown: false,
        contentStyle: {
          backgroundColor: 'transparent',
        },
      }}
    >
      <Stack.Screen
        name="input-editor"
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="voice"
        options={{
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  )
}
