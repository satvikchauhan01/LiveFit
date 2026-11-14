import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { PrivacyZone } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { communityApi } from '@/features/community/communityApi';
import { type SettingsChanges, useCommunityStore } from '@/features/community/communityStore';
import { UsernameForm } from '@/features/community/UsernameForm';
import { useRemote } from '@/features/community/useRemote';
import { VISIBILITY_OPTIONS } from '@/features/community/visibility';
import { deviceTimeZone } from '@/lib/dates';
import { spacing } from '@/theme/tokens';

const ZONE_SIZES = [200, 500, 1000];

function hourLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`;
}

export default function CommunitySettingsScreen() {
  const user = useAccountStore((state) => state.user);
  const setUser = useAccountStore((state) => state.setUser);
  const settings = useCommunityStore((state) => state.settings);
  const loadSettings = useCommunityStore((state) => state.loadSettings);
  const updateSettings = useCommunityStore((state) => state.updateSettings);
  const zones = useRemote(useCallback(() => communityApi.privacyZones(), []));

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [zoneSize, setZoneSize] = useState(500);
  const [addingZone, setAddingZone] = useState(false);

  useEffect(() => {
    loadSettings().catch((error: unknown) => console.warn('[community] settings', error));
    // The bio isn't part of the account details, so fetch the public profile for it.
    if (user?.username) {
      communityApi
        .profileByUsername(user.username)
        .then((profile) => setBio(profile.bio))
        .catch(() => {});
    }
  }, [loadSettings, user?.username]);

  const change = (changes: SettingsChanges) =>
    updateSettings(changes).catch((error: unknown) =>
      Alert.alert('Couldn’t save that', errorMessage(error)),
    );

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { user: updated } = await communityApi.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
      });
      await setUser(updated);
    } catch (error) {
      Alert.alert('Couldn’t save your profile', errorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const setPrivate = async (isPrivate: boolean) => {
    try {
      const { user: updated } = await communityApi.updateProfile({ isPrivate });
      await setUser(updated);
    } catch (error) {
      Alert.alert('Couldn’t change that', errorMessage(error));
    }
  };

  const addZone = async () => {
    setAddingZone(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location needed', 'Allow location to add a privacy zone where you are now.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await communityApi.addPrivacyZone({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radiusM: zoneSize,
      });
      zones.reload();
    } catch (error) {
      Alert.alert('Couldn’t add the zone', errorMessage(error));
    } finally {
      setAddingZone(false);
    }
  };

  const removeZone = (zone: PrivacyZone) =>
    communityApi
      .deletePrivacyZone(zone.id)
      .then(zones.reload)
      .catch((error: unknown) => Alert.alert('Couldn’t remove the zone', errorMessage(error)));

  const quietOn = settings?.quietStart != null && settings.quietEnd != null;

  return (
    <Screen edges={['bottom']}>
      <AppText variant="label" tone="muted">
        Your profile
      </AppText>
      <Card>
        {user?.username && (
          <ListRow
            icon="person-circle-outline"
            title="View my profile"
            subtitle={`@${user.username}`}
            onPress={() =>
              router.push({
                pathname: '/community/user/[username]',
                params: { username: user.username ?? '' },
              })
            }
          />
        )}
        <TextField label="Name" value={displayName} onChangeText={setDisplayName} maxLength={40} />
        <TextField label="Bio" value={bio} onChangeText={setBio} maxLength={200} multiline />
        <Button
          label={savingProfile ? 'Saving…' : 'Save profile'}
          variant="secondary"
          onPress={saveProfile}
          disabled={savingProfile || displayName.trim() === ''}
        />
        <SwitchRow
          title="Private profile"
          subtitle="People must ask to follow you, and only followers see your workouts."
          value={user?.isPrivate ?? true}
          onValueChange={setPrivate}
        />
      </Card>

      <Card>
        <UsernameForm buttonLabel="Change username" />
      </Card>

      {settings && (
        <>
          <AppText variant="label" tone="muted">
            New workouts are shared with
          </AppText>
          <View style={styles.chips}>
            {VISIBILITY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={settings.defaultVisibility === option.value}
                onPress={() => change({ defaultVisibility: option.value })}
              />
            ))}
          </View>
          <AppText variant="caption" tone="muted">
            You can change it for each workout afterwards.
          </AppText>

          <AppText variant="label" tone="muted">
            Maps and times
          </AppText>
          <Card>
            <SwitchRow
              title="Hide the start and end of routes"
              subtitle="Trims about 200 m from each end, so nobody can see your front door."
              value={settings.trimRouteEnds}
              onValueChange={(value) => change({ trimRouteEnds: value })}
            />
            <SwitchRow
              title="Hide maps"
              subtitle="Others see your numbers, but no route."
              value={settings.hideMaps}
              onValueChange={(value) => change({ hideMaps: value })}
            />
            <SwitchRow
              title="Hide time of day"
              subtitle="Others see the date only."
              value={settings.hideStartTime}
              onValueChange={(value) => change({ hideStartTime: value })}
            />
          </Card>

          <AppText variant="label" tone="muted">
            Privacy zones
          </AppText>
          <Card>
            <AppText tone="muted">
              Parts of your routes inside a zone (around home or work, say) are never shown to
              others.
            </AppText>
            {zones.data?.zones.map((zone, index) => (
              <View key={zone.id} style={styles.zone}>
                <Icon name="shield-checkmark-outline" size={20} />
                <AppText style={styles.flex}>
                  Zone {index + 1} · {zone.radiusM} m
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove zone ${index + 1}`}
                  hitSlop={12}
                  onPress={() => removeZone(zone)}
                >
                  <Icon name="trash-outline" size={20} />
                </Pressable>
              </View>
            ))}
            <View style={styles.chips}>
              {ZONE_SIZES.map((size) => (
                <Chip
                  key={size}
                  label={`${size} m`}
                  selected={zoneSize === size}
                  onPress={() => setZoneSize(size)}
                />
              ))}
            </View>
            <Button
              label={addingZone ? 'Finding you…' : 'Add a zone where I am now'}
              variant="secondary"
              onPress={addZone}
              disabled={addingZone}
            />
          </Card>

          <AppText variant="label" tone="muted">
            Notify me about
          </AppText>
          <Card>
            <SwitchRow
              title="New followers and requests"
              value={settings.notifyFollows}
              onValueChange={(value) => change({ notifyFollows: value })}
            />
            <SwitchRow
              title="Kudos"
              value={settings.notifyKudos}
              onValueChange={(value) => change({ notifyKudos: value })}
            />
            <SwitchRow
              title="Comments"
              value={settings.notifyComments}
              onValueChange={(value) => change({ notifyComments: value })}
            />
            <SwitchRow
              title="Club news"
              value={settings.notifyClubs}
              onValueChange={(value) => change({ notifyClubs: value })}
            />
            <SwitchRow
              title="Challenges"
              value={settings.notifyChallenges}
              onValueChange={(value) => change({ notifyChallenges: value })}
            />
            <SwitchRow
              title="Quiet hours"
              subtitle="No push notifications overnight. They still show in your inbox."
              value={quietOn}
              onValueChange={(value) =>
                change(
                  value
                    ? { quietStart: 22 * 60, quietEnd: 7 * 60, timezone: deviceTimeZone() }
                    : { quietStart: null, quietEnd: null },
                )
              }
            />
            {quietOn && (
              <>
                <AppText variant="caption" tone="muted">
                  From
                </AppText>
                <Stepper
                  value={settings.quietStart ?? 0}
                  min={0}
                  max={23 * 60}
                  step={60}
                  onChange={(value) => change({ quietStart: value, timezone: deviceTimeZone() })}
                  accessibilityLabel="Quiet hours start"
                  format={hourLabel}
                />
                <AppText variant="caption" tone="muted">
                  Until
                </AppText>
                <Stepper
                  value={settings.quietEnd ?? 0}
                  min={0}
                  max={23 * 60}
                  step={60}
                  onChange={(value) => change({ quietEnd: value, timezone: deviceTimeZone() })}
                  accessibilityLabel="Quiet hours end"
                  format={hourLabel}
                />
              </>
            )}
          </Card>
        </>
      )}

      <Card>
        <ListRow
          icon="ban-outline"
          title="Blocked people"
          onPress={() => router.push('/community/blocked')}
        />
        {user?.isAdmin && (
          <ListRow
            icon="shield-outline"
            title="Moderation"
            subtitle="Open reports"
            onPress={() => router.push('/community/admin')}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  zone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
});
