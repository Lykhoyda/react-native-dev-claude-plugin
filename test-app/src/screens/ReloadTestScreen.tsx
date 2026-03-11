import React, { useRef } from 'react';
import { View, Text, Pressable } from 'react-native';

let mountCount = 0;

export default function ReloadTestScreen() {
  const countRef = useRef(++mountCount);

  return (
    <View className="flex-1 items-center justify-center bg-white px-4">
      <Text className="text-xl font-bold">Reload Test</Text>
      <Text testID="reload-counter" className="mt-4 text-4xl font-bold text-blue-500">
        {countRef.current}
      </Text>
      <Text className="mt-2 text-gray-500">Mount count (resets on full reload)</Text>
      <Pressable
        testID="reload-btn"
        className="mt-6 rounded-lg bg-blue-500 px-6 py-3"
        onPress={() => {}}
      >
        <Text className="text-center font-semibold text-white">Manual Reload (use cdp_reload)</Text>
      </Pressable>
    </View>
  );
}
