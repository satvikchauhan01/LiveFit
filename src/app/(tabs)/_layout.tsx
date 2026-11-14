import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useRecorderStore } from '@/features/recorder/recorderStore';
import { useStrengthStore } from '@/features/strength/strengthStore';
import { useActiveSession } from '@/features/workouts/activeSession';
import { colors, radius } from '@/theme/tokens';

export default function TabsLayout() {
  const active = useActiveSession();
  const recording = active !== null;
  const gpsReopen = useRecorderStore((state) => state.reopenPending);
  const acknowledgeGpsReopen = useRecorderStore((state) => state.acknowledgeReopen);
  const strengthReopen = useStrengthStore((state) => state.reopenPending);
  const acknowledgeStrengthReopen = useStrengthStore((state) => state.acknowledgeReopen);

  // A workout was still open when the app last closed (or crashed):
  // go straight back to it, where it can be carried on or finished.
  useEffect(() => {
    if (gpsReopen) {
      acknowledgeGpsReopen();
      router.push('/recording');
    } else if (strengthReopen) {
      acknowledgeStrengthReopen();
      router.push('/strength');
    }
  }, [gpsReopen, acknowledgeGpsReopen, strengthReopen, acknowledgeStrengthReopen]);

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
          title: recording ? 'In progress' : 'Record',
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
            router.push(active ? active.route : '/record');
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
