import React from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootState } from '../store';
import type { ProfileStackParams } from '../navigation/types';
import { toggleTheme, setLanguage } from '../store/slices/settingsSlice';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = NativeStackScreenProps<ProfileStackParams, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const dispatch = useDispatch();
  const settings = useSelector((state: RootState) => state.settings);
  const colors = useThemeColors();

  return (
    <View className={`flex-1 ${colors.bg} px-4 pt-4`}>
      <Text className={`text-xl font-bold ${colors.text}`}>Settings</Text>

      <View className="mt-6 flex-row items-center justify-between">
        <Text className={`text-base ${colors.text}`}>Theme</Text>
        <Pressable
          testID="settings-theme-toggle"
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.theme === 'dark' }}
          className={`rounded-lg px-4 py-2 ${colors.card}`}
          onPress={() => dispatch(toggleTheme())}
        >
          <Text testID="settings-theme-label" className={`font-semibold ${colors.text}`}>
            {settings.theme === 'dark' ? 'Dark' : 'Light'}
          </Text>
        </Pressable>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className={`text-base ${colors.text}`}>Language (DE)</Text>
        <Switch
          testID="settings-language-toggle"
          value={settings.language === 'de'}
          onValueChange={(value) => { dispatch(setLanguage(value ? 'de' : 'en')); }}
        />
      </View>

      <Pressable
        testID="settings-reload-btn"
        className={`mt-6 rounded-lg px-4 py-3 ${colors.card}`}
        onPress={() => navigation.navigate('ReloadTest')}
      >
        <Text className={`text-center font-semibold ${colors.text}`}>Reload Test</Text>
      </Pressable>
    </View>
  );
}
