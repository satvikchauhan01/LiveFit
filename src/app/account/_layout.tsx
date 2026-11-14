import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors } from '@/theme/tokens';

const closeButton = () => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Close"
    hitSlop={12}
    onPress={() => router.back()}
  >
    <Icon name="close" />
  </Pressable>
);

// Sign-in and account settings, presented as one modal.
export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Account', headerLeft: closeButton }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
      <Stack.Screen name="delete" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
