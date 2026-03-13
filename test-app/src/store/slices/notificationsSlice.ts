import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface NotificationItem {
  id: string;
  title: string;
  read: boolean;
  snoozedUntil: number | null;
}

interface NotificationsState {
  items: NotificationItem[];
  unreadCount: number;
}

const initialState: NotificationsState = {
  items: [
    { id: '1', title: 'Welcome to the test app', read: false, snoozedUntil: null },
    { id: '2', title: 'Your profile is set up', read: false, snoozedUntil: null },
    { id: '3', title: 'Try the Error Lab', read: true, snoozedUntil: null },
  ],
  unreadCount: 2,
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    markAllRead: (state) => {
      state.items.forEach((item) => { item.read = true; });
      state.unreadCount = 0;
    },
    markRead: (state, action: PayloadAction<string>) => {
      const item = state.items.find((i) => i.id === action.payload);
      if (item && !item.read) {
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    clearAll: (state) => {
      state.items = [];
      state.unreadCount = 0;
    },
    snoozeNotification: (state, action: PayloadAction<{ id: string; snoozedUntil: number }>) => {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.snoozedUntil = action.payload.snoozedUntil;
      }
    },
    unsnoozeNotification: (state, action: PayloadAction<string>) => {
      const item = state.items.find((i) => i.id === action.payload);
      if (item) {
        item.snoozedUntil = null;
      }
    },
  },
});

export const { markAllRead, markRead, clearAll, snoozeNotification, unsnoozeNotification } = notificationsSlice.actions;

const selectItems = (state: { notifications: NotificationsState }) => state.notifications.items;

export const selectUnreadCount = createSelector(
  [selectItems],
  (items) => items.filter((i) => !i.read).length,
);

export const selectVisibleNotifications = (state: { notifications: NotificationsState }) =>
  state.notifications.items.filter((i) => i.snoozedUntil === null || i.snoozedUntil <= Date.now());

export const selectSnoozedCount = (state: { notifications: NotificationsState }) =>
  state.notifications.items.filter((i) => i.snoozedUntil !== null && i.snoozedUntil > Date.now()).length;

export default notificationsSlice;
