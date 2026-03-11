import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { HomeStackParams, TabParams } from '../navigation/types';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParams, 'HomeMain'>,
  BottomTabScreenProps<TabParams>
>;

function FeatureCard({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <View testID={`home-feature-${index}`} className="mb-3 rounded-lg bg-gray-100 p-4">
      <Text className="text-base font-semibold">{title}</Text>
      <Text className="mt-1 text-sm text-gray-600">{description}</Text>
    </View>
  );
}

function FeatureList() {
  const features = [
    { title: 'Component Tree', description: 'Tests cdp_component_tree with nested testIDs' },
    { title: 'Navigation State', description: 'Tests cdp_navigation_state across tabs and stacks' },
    { title: 'Store State', description: 'Tests cdp_store_state with Redux Toolkit slices' },
  ];

  return (
    <View testID="home-feature-list" className="mt-4">
      {features.map((f, i) => (
        <FeatureCard key={i} index={i} title={f.title} description={f.description} />
      ))}
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  return (
    <View testID="home-welcome" className="flex-1 bg-white px-4 pt-4">
      <Text className="text-2xl font-bold">Welcome</Text>
      <Text className="mt-1 text-gray-500">rn-dev-agent test fixture</Text>
      <FeatureList />
      <Pressable
        testID="home-feed-btn"
        className="mt-4 rounded-lg bg-blue-500 px-4 py-3"
        onPress={() => navigation.navigate('Feed')}
      >
        <Text className="text-center font-semibold text-white">Go to Feed</Text>
      </Pressable>
    </View>
  );
}
