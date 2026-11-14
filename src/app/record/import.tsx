import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { Screen } from '@/components/Screen';
import { GPS_ACTIVITY_TYPES, type GpsActivityType } from '@/db/schema';
import { useProfile } from '@/features/profile/profileStore';
import { bestEfforts } from '@/features/tracking/bestEfforts';
import { type GpxWorkout, parseGpx } from '@/features/tracking/gpx';
import { analyzeTrack } from '@/features/tracking/pipeline';
import { ACTIVITY_DISPLAY } from '@/features/workouts/activities';
import {
  createFinishedWorkout,
  insertPauses,
  insertTrackPoints,
} from '@/features/workouts/workoutRepository';
import { defaultWorkoutTitle } from '@/features/workouts/workoutTitle';
import { estimateCalories } from '@/lib/calories';
import { formatDistance, formatDuration, formatWorkoutDate } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/** A guess from average speed, for files that don't say what they are. */
function guessActivity(distanceM: number, durationMs: number): GpsActivityType {
  const kmh = durationMs > 0 ? distanceM / 1000 / (durationMs / 3_600_000) : 0;
  if (kmh > 16) return 'cycle';
  if (kmh > 7) return 'run';
  return 'walk';
}

type Loaded = { gpx: GpxWorkout; startedAt: number; endedAt: number };

/** Brings in a route from a watch, another app, or a GPX exported from LiveFit. */
export default function ImportGpxScreen() {
  const profile = useProfile();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [type, setType] = useState<GpsActivityType>('run');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    try {
      const xml = await new File(result.assets[0].uri).text();
      // Other apps don't record GPS accuracy; assume a decent fix so points aren't dropped.
      const gpx = parseGpx(xml, { defaultAccuracyM: 5 });
      if (gpx.points.length < 2) {
        Alert.alert('No route found', 'This file doesn’t contain a track with timed points.');
        return;
      }
      const startedAt = gpx.startedAt ?? gpx.points[0].t;
      const endedAt = gpx.endedAt ?? gpx.points[gpx.points.length - 1].t;
      setLoaded({ gpx, startedAt, endedAt });
      const preview = analyzeTrack({
        activity: 'run',
        startedAt,
        endAt: endedAt,
        points: gpx.points,
        pauses: gpx.pauses,
      });
      setType(gpx.activity ?? guessActivity(preview.distanceM, preview.movingMs));
    } catch (error) {
      Alert.alert('Couldn’t read the file', String(error));
    }
  };

  const save = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      const { gpx, startedAt, endedAt } = loaded;
      const track = analyzeTrack({
        activity: type,
        startedAt,
        endAt: endedAt,
        points: gpx.points,
        pauses: gpx.pauses,
      });
      const saved = await createFinishedWorkout({
        type,
        source: 'import',
        startedAt,
        endedAt,
        elapsedS: Math.round(track.elapsedMs / 1000),
        movingS: Math.round(track.movingMs / 1000),
        distanceM: track.distanceM,
        elevationGainM: Math.round(track.elevationGainM),
        caloriesEst: estimateCalories({
          activity: type,
          movingS: track.movingMs / 1000,
          distanceM: track.distanceM,
          weightKg: profile.weightKg,
        }),
        extras: JSON.stringify({ bestEfforts: bestEfforts(track) }),
        title: gpx.name.trim() || defaultWorkoutTitle(type, startedAt),
      });
      await insertTrackPoints(saved.id, gpx.points);
      await insertPauses(saved.id, gpx.pauses);
      router.dismissAll();
      router.replace({ pathname: '/workout/[id]', params: { id: saved.id } });
    } catch (error) {
      setBusy(false);
      Alert.alert('Couldn’t import', String(error));
    }
  };

  if (!loaded) {
    return (
      <Screen edges={['bottom']}>
        <AppText tone="muted">
          Pick a .gpx file: an export from LiveFit, a sports watch, or another app. The route, time
          and distance are brought in as a new workout.
        </AppText>
        <Button label="Choose GPX file" onPress={pick} />
      </Screen>
    );
  }

  const { gpx, startedAt, endedAt } = loaded;
  const preview = analyzeTrack({
    activity: type,
    startedAt,
    endAt: endedAt,
    points: gpx.points,
    pauses: gpx.pauses,
  });

  return (
    <Screen edges={['bottom']}>
      <Card>
        <AppText variant="title">{gpx.name || 'Imported route'}</AppText>
        <AppText tone="muted">{formatWorkoutDate(startedAt)}</AppText>
        <AppText>
          {formatDistance(preview.distanceM, profile.distanceUnit)} ·{' '}
          {formatDuration(preview.movingMs)} · {gpx.points.length} points
        </AppText>
      </Card>

      <View style={styles.group}>
        <AppText variant="label" tone="muted">
          What was it?
        </AppText>
        <View style={styles.chips}>
          {GPS_ACTIVITY_TYPES.map((activity) => (
            <Chip
              key={activity}
              label={ACTIVITY_DISPLAY[activity].label}
              selected={type === activity}
              onPress={() => setType(activity)}
            />
          ))}
        </View>
      </View>

      <Button label={busy ? 'Importing…' : 'Import workout'} onPress={save} disabled={busy} />
      <Button label="Choose another file" variant="ghost" onPress={pick} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
