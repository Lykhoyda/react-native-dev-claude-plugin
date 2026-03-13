import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootState } from '../store';
import type { ProfileStackParams, TabParams, RootStackParams } from '../navigation/types';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParams, 'ProfileMain'>,
  CompositeScreenProps<
    BottomTabScreenProps<TabParams>,
    NativeStackScreenProps<RootStackParams>
  >
>;

export default function ProfileScreen({ navigation }: Props) {
  const user = useSelector((state: RootState) => state.user);
  const colors = useThemeColors();

  return (
    <View className={`flex-1 ${colors.bg} px-4 pt-4`}>
      <View testID="profile-avatar" className="mb-4 h-20 w-20 rounded-full bg-gray-200" />
      <Text testID="profile-name" className={`text-xl font-bold ${colors.text}`}>{user.name}</Text>
      <Text testID="profile-email" className={`mt-1 ${colors.muted}`}>{user.email}</Text>

      <Pressable
        testID="profile-edit-btn"
        className="mt-6 rounded-lg bg-blue-500 px-4 py-3"
        onPress={() => navigation.navigate('ProfileEditModal')}
      >
        <Text className="text-center font-semibold text-white">Edit Profile</Text>
      </Pressable>

      <Pressable
        testID="profile-settings-btn"
        className={`mt-3 rounded-lg px-4 py-3 ${colors.card}`}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text className={`text-center font-semibold ${colors.text}`}>Settings</Text>
      </Pressable>
    </View>
  );
}
