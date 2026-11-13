import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/Icon';
import { colors } from '@/theme/tokens';

// The modal for starting a workout: pick an activity, then wait for GPS and
// count down. Once recording starts, the live screen replaces this modal.
export default function RecordLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Start a workout',
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              onPress={() => router.back()}
            >
              <Icon name="close" />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="ready" options={{ title: '' }} />
    </Stack>
  );
}
