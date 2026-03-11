import React, { useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { setLoading, setItems, setError } from '../store/slices/feedSlice';
import type { FeedItem } from '../store/slices/feedSlice';

const API_BASE = 'https://api.testapp.local';

export default function FeedScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error } = useSelector((state: RootState) => state.feed);

  const fetchFeed = useCallback(async (triggerError = false) => {
    dispatch(setLoading(true));
    try {
      const url = triggerError ? `${API_BASE}/api/feed?error=true` : `${API_BASE}/api/feed`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json();
        dispatch(setError(body.message ?? 'Request failed'));
        return;
      }
      const data: FeedItem[] = await res.json();
      dispatch(setItems(data));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [dispatch]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  const renderItem = ({ item, index }: { item: FeedItem; index: number }) => (
    <View testID={`feed-item-${index}`} className="mb-3 rounded-lg bg-gray-100 p-4">
      <Text className="font-semibold">{item.title}</Text>
      <Text className="mt-1 text-sm text-gray-600">{item.body}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-white px-4 pt-4">
      {loading && (
        <View testID="feed-loading" className="items-center py-8">
          <ActivityIndicator size="large" />
        </View>
      )}

      {error && (
        <View testID="feed-error" className="rounded-lg bg-red-100 p-4">
          <Text className="text-red-700">{error}</Text>
          <Pressable
            testID="feed-retry-btn"
            className="mt-2 rounded bg-red-500 px-3 py-2"
            onPress={() => fetchFeed()}
          >
            <Text className="text-center text-white">Retry</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}

      <Pressable
        testID="feed-trigger-error-btn"
        className="mt-4 rounded-lg bg-orange-500 px-4 py-3"
        onPress={() => fetchFeed(true)}
      >
        <Text className="text-center font-semibold text-white">Trigger Error</Text>
      </Pressable>
    </View>
  );
}
