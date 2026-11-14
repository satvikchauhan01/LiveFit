import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { SharedWorkout, WorkoutComment } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useAccountStore } from '@/features/account/accountStore';
import { errorMessage } from '@/features/account/apiClient';
import { Avatar } from '@/features/community/Avatar';
import { communityApi } from '@/features/community/communityApi';
import { toggleKudos } from '@/features/community/kudos';
import { RemoteState } from '@/features/community/RemoteState';
import { reportContent } from '@/features/community/report';
import { SharedWorkoutCard } from '@/features/community/SharedWorkoutCard';
import { openProfile } from '@/features/community/UserRow';
import { useRemote } from '@/features/community/useRemote';
import { formatTimeAgo } from '@/lib/format';
import { spacing } from '@/theme/tokens';

type Loaded = { workout: SharedWorkout; comments: WorkoutComment[]; loadedAt: number };

export default function SharedWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useAccountStore((state) => state.user?.id);
  const remote = useRemote(
    useCallback(async (): Promise<Loaded> => {
      const [workout, { comments }] = await Promise.all([
        communityApi.sharedWorkout(id),
        communityApi.comments(id),
      ]);
      return { workout, comments, loadedAt: Date.now() };
    }, [id]),
  );
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const data = remote.data;
  const isMine = data?.workout.owner.id === myId;

  const send = async () => {
    setSending(true);
    try {
      await communityApi.addComment(id, draft.trim());
      setDraft('');
      remote.reload();
    } catch (error) {
      Alert.alert('Couldn’t post your comment', errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const commentMenu = (comment: WorkoutComment) => {
    const isOwn = comment.user.id === myId;
    Alert.alert('Comment', comment.body, [
      ...(comment.canDelete
        ? [
            {
              text: 'Delete',
              style: 'destructive' as const,
              onPress: () =>
                communityApi
                  .deleteComment(comment.id)
                  .then(remote.reload)
                  .catch((error: unknown) => Alert.alert('Couldn’t delete', errorMessage(error))),
            },
          ]
        : []),
      ...(!isOwn ? [{ text: 'Report', onPress: () => reportContent('comment', comment.id) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerRight:
            data && !isMine
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Report this workout"
                    hitSlop={12}
                    onPress={() => reportContent('workout', id)}
                  >
                    <Icon name="flag-outline" />
                  </Pressable>
                )
              : undefined,
        }}
      />
      <RemoteState remote={remote} />
      {data && (
        <>
          <SharedWorkoutCard
            workout={data.workout}
            openOnPress={false}
            mapHeight={260}
            onKudos={(workout) =>
              toggleKudos(workout, (updated) => remote.setData({ ...data, workout: updated }))
            }
          />

          <AppText variant="label" tone="muted">
            Comments
          </AppText>
          {data.comments.length === 0 && <AppText tone="muted">No comments yet.</AppText>}
          {data.comments.map((comment) => (
            <Pressable
              key={comment.id}
              onLongPress={() => commentMenu(comment)}
              accessibilityHint="Long press for options"
              style={styles.comment}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${comment.user.displayName}'s profile`}
                onPress={() => openProfile(comment.user.username)}
              >
                <Avatar name={comment.user.displayName || comment.user.username} size={32} />
              </Pressable>
              <View style={styles.flex}>
                <AppText variant="caption" tone="muted">
                  {comment.user.displayName || comment.user.username} ·{' '}
                  {formatTimeAgo(comment.createdAt, data.loadedAt)}
                </AppText>
                <AppText>{comment.body}</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Comment options"
                hitSlop={8}
                onPress={() => commentMenu(comment)}
              >
                <Icon name="ellipsis-horizontal" size={18} />
              </Pressable>
            </Pressable>
          ))}

          <TextField
            label="Add a comment"
            value={draft}
            onChangeText={setDraft}
            maxLength={500}
            multiline
          />
          <Button
            label={sending ? 'Posting…' : 'Post comment'}
            onPress={send}
            disabled={sending || draft.trim() === ''}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  comment: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  flex: {
    flex: 1,
  },
});
