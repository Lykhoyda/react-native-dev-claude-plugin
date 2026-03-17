import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import type { RootState } from '../store';
import { useThemeColors } from '../hooks/useThemeColors';
import { SearchResultItem } from '../components/SearchResultItem';

type Props = NativeStackScreenProps<RootStackParams, 'GlobalSearchModal'>;

type SearchCategory = 'task' | 'notification' | 'feed';

interface SearchItem {
  type: 'section-header' | SearchCategory;
  id: string;
  title: string;
  subtitle: string;
  category: SearchCategory;
  count?: number;
}

interface FeedPage {
  items: Array<{ id: string; title: string; body: string; author: string }>;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  const colors = useThemeColors();
  return (
    <View className={`mx-4 mb-1 mt-3 flex-row items-center justify-between`}>
      <Text className={`text-xs font-bold uppercase tracking-wide ${colors.muted}`}>{title}</Text>
      <Text className={`text-xs ${colors.muted}`}>{count}</Text>
    </View>
  );
}

export default function GlobalSearchModal({ navigation: modalNav }: Props) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const tasks = useSelector((state: RootState) => state.tasks.items);
  const notifications = useSelector((state: RootState) => state.notifications.items);

  const searchResults = useMemo(() => {
    if (!debouncedQuery) return [];
    const query = debouncedQuery.toLowerCase();
    const results: SearchItem[] = [];

    const matchedTasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query),
    );
    if (matchedTasks.length > 0) {
      results.push({
        type: 'section-header',
        id: 'header-tasks',
        title: 'Tasks',
        subtitle: '',
        category: 'task',
        count: matchedTasks.length,
      });
      for (const t of matchedTasks) {
        results.push({
          type: 'task',
          id: t.id,
          title: t.title,
          subtitle: `${t.priority} · ${t.done ? 'Done' : 'Active'}`,
          category: 'task',
        });
      }
    }

    const matchedNotifs = notifications.filter((n) =>
      n.title.toLowerCase().includes(query),
    );
    if (matchedNotifs.length > 0) {
      results.push({
        type: 'section-header',
        id: 'header-notifications',
        title: 'Notifications',
        subtitle: '',
        category: 'notification',
        count: matchedNotifs.length,
      });
      for (const n of matchedNotifs) {
        results.push({
          type: 'notification',
          id: n.id,
          title: n.title,
          subtitle: n.read ? 'Read' : 'Unread',
          category: 'notification',
        });
      }
    }

    const feedData = queryClient.getQueryData<{ pages: FeedPage[] }>(['feed']);
    const feedItems = feedData?.pages?.flatMap((p) => p.items) ?? [];
    const matchedFeed = feedItems.filter(
      (f) =>
        f.title.toLowerCase().includes(query) ||
        f.body.toLowerCase().includes(query),
    );
    if (matchedFeed.length > 0) {
      results.push({
        type: 'section-header',
        id: 'header-feed',
        title: 'Feed',
        subtitle: '',
        category: 'feed',
        count: matchedFeed.length,
      });
      for (const f of matchedFeed) {
        results.push({
          type: 'feed',
          id: f.id,
          title: f.title,
          subtitle: `by ${f.author}`,
          category: 'feed',
        });
      }
    }

    return results;
  }, [debouncedQuery, tasks, notifications, queryClient]);

  const totalCount = useMemo(
    () => searchResults.filter((r) => r.type !== 'section-header').length,
    [searchResults],
  );

  const onResultPress = useCallback(
    (category: string, _id: string) => {
      modalNav.goBack();
    },
    [modalNav],
  );

  const getItemType = useCallback((item: SearchItem) => item.type, []);

  const renderItem = useCallback(
    ({ item }: { item: SearchItem }) => {
      if (item.type === 'section-header') {
        return <SectionHeader title={item.title} count={item.count ?? 0} />;
      }
      return (
        <SearchResultItem
          id={item.id}
          title={item.title}
          subtitle={item.subtitle}
          category={item.category}
          highlight={debouncedQuery}
          onPress={onResultPress}
          testID={`search-result-${item.category}-${item.id}`}
        />
      );
    },
    [debouncedQuery, onResultPress],
  );

  return (
    <KeyboardAvoidingView
      testID="global-search-modal"
      className={`flex-1 ${colors.bg}`}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <TextInput
          testID="global-search-input"
          className={`flex-1 rounded-lg border ${colors.border} px-3 py-2 text-base ${colors.text} ${colors.card}`}
          placeholder="Search tasks, notifications, feed..."
          placeholderTextColor={colors.placeholderColor}
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        <Pressable
          testID="search-close-btn"
          className="ml-3 rounded-lg px-3 py-2"
          onPress={() => modalNav.goBack()}
        >
          <Text className={`text-base font-medium text-blue-500`}>Close</Text>
        </Pressable>
      </View>

      {debouncedQuery.length > 0 ? (
        <Text testID="search-result-count" className={`px-4 mb-2 text-xs ${colors.muted}`}>
          {totalCount > 0 ? `${totalCount} results` : 'No results'}
        </Text>
      ) : null}

      {!debouncedQuery ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text testID="search-empty-prompt" className={`text-center text-base ${colors.muted}`}>
            Search across tasks, notifications, and feed
          </Text>
        </View>
      ) : totalCount === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text testID="search-no-results" className={`text-center text-base ${colors.muted}`}>
            No results for "{debouncedQuery}"
          </Text>
        </View>
      ) : (
        <FlashList
          testID="search-results-list"
          data={searchResults}
          renderItem={renderItem}
          getItemType={getItemType}
          estimatedItemSize={56}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </KeyboardAvoidingView>
  );
}
