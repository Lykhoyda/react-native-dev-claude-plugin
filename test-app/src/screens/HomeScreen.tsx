import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { HomeStackParams, TabParams } from '../navigation/types';
import { useThemeColors } from '../hooks/useThemeColors';
import type { ThemeColors } from '../hooks/useThemeColors';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParams, 'HomeMain'>,
  BottomTabScreenProps<TabParams>
>;

function FeatureCard({ index, title, description, colors }: { index: number; title: string; description: string; colors: ThemeColors }) {
  return (
    <View testID={`home-feature-${index}`} className={`mb-3 rounded-lg p-4 ${colors.card}`}>
      <Text className={`text-base font-semibold ${colors.text}`}>{title}</Text>
      <Text className={`mt-1 text-sm ${colors.muted}`}>{description}</Text>
    </View>
  );
}

function FeatureList({ colors }: { colors: ThemeColors }) {
  const features = [
    { title: 'Component Tree', description: 'Tests cdp_component_tree with nested testIDs' },
    { title: 'Navigation State', description: 'Tests cdp_navigation_state across tabs and stacks' },
    { title: 'Store State', description: 'Tests cdp_store_state with Redux Toolkit slices' },
  ];

  return (
    <View testID="home-feature-list" className="mt-4">
      {features.map((f, i) => (
        <FeatureCard key={i} index={i} title={f.title} description={f.description} colors={colors} />
      ))}
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const colors = useThemeColors();

  return (
    <View testID="home-welcome" className={`flex-1 ${colors.bg} px-4 pt-4`}>
      <Text className={`text-2xl font-bold ${colors.text}`}>Welcome</Text>
      <Text className={`mt-1 ${colors.muted}`}>rn-dev-agent test fixture</Text>
      <FeatureList colors={colors} />
      <Pressable
        testID="home-feed-btn"
        className="mt-4 rounded-lg bg-blue-500 px-4 py-3"
        onPress={() => navigation.navigate('Feed')}
      >
        <Text className="text-center font-semibold text-white">Go to Feed</Text>
      </Pressable>
      <Pressable
        testID="go-to-dashboard"
        className="mt-3 rounded-lg bg-green-500 px-4 py-3"
        onPress={() => navigation.navigate('Dashboard')}
      >
        <Text className="text-center font-semibold text-white">Go to Dashboard</Text>
      </Pressable>
    </View>
  );
}
