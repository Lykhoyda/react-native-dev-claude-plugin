import React, { memo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { HighlightedText } from './HighlightedText';
import { useThemeColors } from '../hooks/useThemeColors';

const CATEGORY_STYLES = {
  task: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Task' },
  notification: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Notif' },
  feed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Feed' },
} as const;

interface Props {
  id: string;
  title: string;
  subtitle: string;
  category: 'task' | 'notification' | 'feed';
  highlight: string;
  onPress: (category: string, id: string) => void;
  testID: string;
}

export const SearchResultItem = memo(function SearchResultItem({
  id,
  title,
  subtitle,
  category,
  highlight,
  onPress,
  testID,
}: Props) {
  const colors = useThemeColors();
  const catStyle = CATEGORY_STYLES[category];
  const handlePress = useCallback(() => onPress(category, id), [onPress, category, id]);

  return (
    <Pressable
      testID={testID}
      className={`mx-4 mb-2 flex-row items-center rounded-lg p-3 ${colors.card}`}
      style={{ borderCurve: 'continuous' }}
      onPress={handlePress}
    >
      <View className={`mr-3 rounded-full px-2 py-0.5 ${catStyle.bg}`}>
        <Text className={`text-xs font-medium ${catStyle.text}`}>{catStyle.label}</Text>
      </View>
      <View className="flex-1">
        <HighlightedText
          text={title}
          highlight={highlight}
          textClassName={`text-sm font-medium ${colors.text}`}
          highlightClassName="bg-yellow-200 font-bold"
          numberOfLines={1}
        />
        {subtitle.length > 0 ? (
          <Text className={`mt-0.5 text-xs ${colors.muted}`} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text className={`ml-2 text-lg ${colors.muted}`}>›</Text>
    </Pressable>
  );
});
