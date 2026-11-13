import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { colors, radius } from '@/theme/tokens';

export default function TabsLayout() {
  const recording = useRecorderStore((state) => state.phase === 'live');
  const reopenPending = useRecorderStore((state) => state.reopenPending);
  const acknowledgeReopen = useRecorderStore((state) => state.acknowledgeReopen);

  // A workout was still running when the app last closed (or crashed):
  // go straight back to it, where it can be resumed or finished.
  useEffect(() => {
    if (reopenPending) {
      acknowledgeReopen();
      router.push('/recording');
    }
  }, [reopenPending, acknowledgeReopen]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Icon name="time" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="start"
        options={{
          title: recording ? 'Recording' : 'Record',
          tabBarIcon: () => (
            <View style={styles.recordButton}>
              <Icon
                name={recording ? 'radio-button-on' : 'add'}
                color={colors.textOnAccent}
                size={recording ? 24 : 28}
              />
            </View>
          ),
        }}
        listeners={{
          // This tab never shows its own screen: tapping it opens the Record
          // modal, or returns to the workout that's being recorded.
          tabPress: (event) => {
            event.preventDefault();
            router.push(recording ? '/recording' : '/record');
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Icon name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  recordButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
