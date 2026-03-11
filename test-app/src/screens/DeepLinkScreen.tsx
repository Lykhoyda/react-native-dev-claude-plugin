import React from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParams, 'DeepLink'>;

export default function DeepLinkScreen({ route }: Props) {
  const { id } = route.params;

  return (
    <View className="flex-1 items-center justify-center bg-white px-4">
      <Text className="text-xl font-bold">Deep Link Target</Text>
      <Text testID="deeplink-id" className="mt-4 text-lg">ID: {id}</Text>
      <Text testID="deeplink-params" className="mt-2 text-gray-500">
        Params: {JSON.stringify(route.params)}
      </Text>
    </View>
  );
}
