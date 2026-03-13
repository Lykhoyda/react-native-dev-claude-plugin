import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootState } from '../store';
import type { NotificationsStackParams } from '../navigation/types';
import { markRead, snoozeNotification } from '../store/slices/notificationsSlice';
import { useThemeColors } from '../hooks/useThemeColors';

const API_BASE = 'https://api.testapp.local';

const SNOOZE_OPTIONS: { key: string; label: string; ms: number; testID: string }[] = [
  { key: '1m', label: '1 min', ms: 60_000, testID: 'notif-snooze-1m' },
  { key: '5m', label: '5 min', ms: 300_000, testID: 'notif-snooze-5m' },
  { key: '15m', label: '15 min', ms: 900_000, testID: 'notif-snooze-15m' },
];

type Props = NativeStackScreenProps<NotificationsStackParams, 'NotificationDetail'>;

export default function NotificationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const dispatch = useDispatch();
  const colors = useThemeColors();
  const item = useSelector((state: RootState) =>
    state.notifications.items.find((i) => i.id === id),
  );

  useEffect(() => {
    if (__DEV__) {
      console.log(`[NotificationDetail] viewing notification ${id}`);
    }
  }, [id]);

  if (!item) {
    return (
      <View testID="notif-detail-empty" className={`flex-1 items-center justify-center ${colors.bg}`}>
        <Text className={`text-lg ${colors.muted}`}>Notification not found</Text>
        <Pressable
          testID="notif-detail-back-btn"
          className="mt-4 rounded-lg bg-blue-500 px-4 py-3"
          onPress={() => navigation.goBack()}
        >
          <Text className="text-center font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const handleMarkRead = () => {
    if (__DEV__) {
      console.log(`[NotificationDetail] marking ${id} as read`);
    }
    dispatch(markRead(id));
    fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  };

  const snoozedUntil = item.snoozedUntil;
  const isSnoozed = snoozedUntil !== null && snoozedUntil > Date.now();

  const handleSnooze = (durationMs: number) => {
    if (__DEV__) {
      console.log(`[Notifications] snoozed notification ${id} for ${durationMs} ms`);
    }
    dispatch(snoozeNotification({ id, snoozedUntil: Date.now() + durationMs }));
    navigation.goBack();
  };

  const formatRemaining = (ms: number): string => {
    const minutes = Math.ceil(ms / 60_000);
    return minutes <= 1 ? '< 1 min' : `${minutes} min`;
  };

  return (
    <View testID="notif-detail-container" className={`flex-1 ${colors.bg} px-4 pt-6`}>
      <Text testID="notif-detail-title" className={`text-2xl font-bold ${colors.text}`}>
        {item.title}
      </Text>

      <Text testID="notif-detail-body" className={`mt-4 text-base ${colors.muted}`}>
        This is the full detail view for notification #{id}. In a real app this
        would contain the complete notification content, timestamps, and related
        actions.
      </Text>

      <View testID="notif-detail-status" className="mt-4 flex-row items-center">
        <View
          className={`h-3 w-3 rounded-full ${item.read ? 'bg-gray-300' : 'bg-blue-500'}`}
        />
        <Text className={`ml-2 text-sm ${colors.muted}`}>
          {item.read ? 'Read' : 'Unread'}
        </Text>
      </View>

      {isSnoozed ? (
        <View testID="notif-snoozed-badge" className="mt-4 rounded-lg bg-amber-100 px-4 py-3">
          <Text className="text-center font-semibold text-amber-700">
            Snoozed — {formatRemaining(snoozedUntil - Date.now())} remaining
          </Text>
        </View>
      ) : (
        <View className="mt-4">
          <Text testID="notif-snooze-btn" className={`mb-2 font-semibold ${colors.text}`}>Snooze</Text>
          <View className="flex-row gap-2">
            {SNOOZE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                testID={opt.testID}
                className={`rounded-full px-4 py-1.5 ${colors.card}`}
                onPress={() => handleSnooze(opt.ms)}
              >
                <Text className={colors.text}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {!item.read && (
        <Pressable
          testID="notif-detail-mark-read-btn"
          className="mt-6 rounded-lg bg-green-500 px-4 py-3"
          onPress={handleMarkRead}
        >
          <Text className="text-center font-semibold text-white">Mark as Read</Text>
        </Pressable>
      )}

      <Pressable
        testID="notif-detail-back-btn"
        className={`mt-3 rounded-lg ${colors.card} px-4 py-3`}
        onPress={() => navigation.goBack()}
      >
        <Text className={`text-center font-semibold ${colors.text}`}>Back to List</Text>
      </Pressable>
    </View>
  );
}
