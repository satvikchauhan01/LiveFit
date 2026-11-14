import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChallengeKind } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { ACTIVITY_TYPES, type ActivityType } from '@/db/schema';
import { useAccountStore } from '@/features/account/accountStore';
import { ApiError, errorMessage } from '@/features/account/apiClient';
import { CHALLENGE_KIND_LABEL } from '@/features/community/challengeText';
import { communityApi } from '@/features/community/communityApi';
import { isProUser } from '@/features/pro/proStatus';
import { useProfile } from '@/features/profile/profileStore';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import { deviceTimeZone } from '@/lib/dates';
import { metersPerUnit, toKg } from '@/lib/units';
import { spacing } from '@/theme/tokens';

const KINDS: ChallengeKind[] = ['distance', 'duration', 'count', 'volume', 'hybrid'];

type StartChoice = 'today' | 'tomorrow' | 'monday';

/** Local midnight at the start of the chosen day. */
function startDate(choice: StartChoice): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (choice === 'tomorrow') date.setDate(date.getDate() + 1);
  if (choice === 'monday') date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7));
  return date;
}

function parseNumber(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function NewChallengeScreen() {
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();
  const profile = useProfile();
  const isPro = isProUser(useAccountStore((state) => state.user));

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ChallengeKind>('distance');
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState(5);
  const [count, setCount] = useState(10);
  const [volume, setVolume] = useState('');
  const [sessions, setSessions] = useState(4);
  const [start, setStart] = useState<StartChoice>('today');
  const [days, setDays] = useState(7);
  const [allowManual, setAllowManual] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const distanceValue = parseNumber(distance);
  const volumeValue = parseNumber(volume);
  const targetReady =
    kind === 'distance' || kind === 'hybrid'
      ? distanceValue !== null
      : kind === 'volume'
        ? volumeValue !== null
        : true;

  const toggleType = (type: ActivityType) =>
    setTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );

  const create = async () => {
    setSaving(true);
    setError(null);
    const startsAt = startDate(start);
    const endsAt = new Date(startsAt);
    endsAt.setDate(endsAt.getDate() + days);
    try {
      const challenge = await communityApi.createChallenge({
        title: title.trim(),
        kind,
        // A volume challenge only makes sense for strength workouts.
        activityTypes: kind === 'volume' ? ['strength'] : types,
        targetDistanceM:
          (kind === 'distance' || kind === 'hybrid') && distanceValue !== null
            ? distanceValue * metersPerUnit(profile.distanceUnit)
            : null,
        targetDurationS: kind === 'duration' ? hours * 3600 : null,
        targetCount: kind === 'count' ? count : null,
        targetVolumeKg:
          kind === 'volume' && volumeValue !== null ? toKg(volumeValue, profile.weightUnit) : null,
        targetStrengthSessions: kind === 'hybrid' ? sessions : null,
        startsAt: startsAt.getTime(),
        // The last millisecond of the final day.
        endsAt: endsAt.getTime() - 1,
        timezone: deviceTimeZone(),
        clubId: clubId ?? null,
        allowManual,
        isPublic,
      });
      router.replace({ pathname: '/community/challenge/[id]', params: { id: challenge.id } });
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === 'pro_required'
          ? 'Public challenges need LiveFit Pro.'
          : errorMessage(failure),
      );
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField
        label="Name"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        placeholder="November 100 km"
      />

      <AppText variant="label" tone="muted">
        Goal
      </AppText>
      <View style={styles.chips}>
        {KINDS.map((option) => (
          <Chip
            key={option}
            label={CHALLENGE_KIND_LABEL[option]}
            selected={kind === option}
            onPress={() => setKind(option)}
          />
        ))}
      </View>

      {(kind === 'distance' || kind === 'hybrid') && (
        <TextField
          label="Distance"
          value={distance}
          onChangeText={setDistance}
          keyboardType="decimal-pad"
          suffix={profile.distanceUnit}
        />
      )}
      {kind === 'duration' && (
        <Stepper
          value={hours}
          min={1}
          max={200}
          onChange={setHours}
          accessibilityLabel="Hours of training"
          format={(value) => `${value} h`}
        />
      )}
      {kind === 'count' && (
        <Stepper
          value={count}
          min={1}
          max={100}
          onChange={setCount}
          accessibilityLabel="Number of workouts"
          format={(value) => `${value} workouts`}
        />
      )}
      {kind === 'volume' && (
        <TextField
          label="Total weight lifted"
          value={volume}
          onChangeText={setVolume}
          keyboardType="decimal-pad"
          suffix={profile.weightUnit}
          hint="Weight × reps, added up over every set."
        />
      )}
      {kind === 'hybrid' && (
        <Stepper
          value={sessions}
          min={1}
          max={50}
          onChange={setSessions}
          accessibilityLabel="Strength sessions"
          format={(value) => `+ ${value} strength sessions`}
        />
      )}

      {kind !== 'volume' && (
        <>
          <AppText variant="label" tone="muted">
            {kind === 'hybrid' ? 'Activities that count for distance' : 'Activities that count'}
          </AppText>
          <View style={styles.chips}>
            {ACTIVITY_TYPES.filter((type) => kind !== 'hybrid' || type !== 'strength').map(
              (type) => (
                <Chip
                  key={type}
                  label={ACTIVITY_DISPLAY[type].label}
                  selected={types.includes(type)}
                  onPress={() => toggleType(type)}
                />
              ),
            )}
          </View>
          <AppText variant="caption" tone="muted">
            {types.length === 0 ? 'None picked: every activity counts.' : ' '}
          </AppText>
        </>
      )}

      <AppText variant="label" tone="muted">
        When
      </AppText>
      <View style={styles.chips}>
        <Chip label="Today" selected={start === 'today'} onPress={() => setStart('today')} />
        <Chip
          label="Tomorrow"
          selected={start === 'tomorrow'}
          onPress={() => setStart('tomorrow')}
        />
        <Chip
          label="Next Monday"
          selected={start === 'monday'}
          onPress={() => setStart('monday')}
        />
      </View>
      <Stepper
        value={days}
        min={1}
        max={90}
        onChange={setDays}
        accessibilityLabel="Length in days"
        format={(value) => `${value} ${value === 1 ? 'day' : 'days'}`}
      />

      <SwitchRow
        title="Count workouts typed in by hand"
        subtitle="Off: only workouts recorded live (GPS or set by set) count. Fairer for leaderboards."
        value={allowManual}
        onValueChange={setAllowManual}
      />
      {!clubId && (
        <SwitchRow
          title="Open to everyone"
          subtitle={
            isPro
              ? 'Anyone on LiveFit can find and join it.'
              : 'Public challenges are part of LiveFit Pro. Without it, people join with your invite code.'
          }
          value={isPublic}
          onValueChange={(value) => setIsPublic(value && isPro)}
        />
      )}

      {error && <AppText tone="danger">{error}</AppText>}
      <Button
        label={saving ? 'Creating…' : 'Create challenge'}
        onPress={create}
        disabled={saving || title.trim().length < 3 || !targetReady}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
