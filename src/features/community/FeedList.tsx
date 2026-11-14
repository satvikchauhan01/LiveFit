import { type ReactElement, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import type { FeedResponse, SharedWorkout } from '@shared/api';

import { AppText } from '@/components/AppText';
import { errorMessage } from '@/features/account/apiClient';
import { colors, spacing } from '@/theme/tokens';

import { toggleKudos } from './kudos';
import { SharedWorkoutCard } from './SharedWorkoutCard';
import { useRemote } from './useRemote';

type Props = {
  /** Loads a page; `cursor` is null for the first one. */
  load: (cursor: string | null) => Promise<FeedResponse>;
  header?: ReactElement;
  empty: ReactElement;
};

/** A scrolling list of shared workouts with pull-to-refresh and "load more". */
export function FeedList({ load, header, empty }: Props) {
  const firstPage = useCallback(() => load(null), [load]);
  const remote = useRemote(firstPage);
  const [more, setMore] = useState<{ items: SharedWorkout[]; nextCursor: string | null } | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const items = [...(remote.data?.items ?? []), ...(more?.items ?? [])];
  const nextCursor = more ? more.nextCursor : (remote.data?.nextCursor ?? null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      remote.setData(await load(null));
      setMore(null);
    } catch (error) {
      setMoreError(errorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await load(nextCursor);
      setMore({ items: [...(more?.items ?? []), ...page.items], nextCursor: page.nextCursor });
      setMoreError(null);
    } catch (error) {
      setMoreError(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  };

  const replace = (updated: SharedWorkout) => {
    if (remote.data?.items.some((item) => item.id === updated.id)) {
      remote.setData({
        ...remote.data,
        items: remote.data.items.map((item) => (item.id === updated.id ? updated : item)),
      });
    } else if (more) {
      setMore({
        ...more,
        items: more.items.map((item) => (item.id === updated.id ? updated : item)),
      });
    }
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <SharedWorkoutCard workout={item} onKudos={(workout) => toggleKudos(workout, replace)} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        remote.data ? (
          empty
        ) : remote.error ? (
          <AppText tone="muted" style={styles.message}>
            {remote.error}
          </AppText>
        ) : (
          <ActivityIndicator color={colors.accent} style={styles.spinner} />
        )
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {loadingMore && <ActivityIndicator color={colors.accent} />}
          {moreError && (
            <AppText variant="caption" tone="danger" style={styles.message}>
              {moreError}
            </AppText>
          )}
        </View>
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  spinner: {
    paddingVertical: spacing.xxl,
  },
  message: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  footer: {
    paddingBottom: spacing.xxl,
  },
});
