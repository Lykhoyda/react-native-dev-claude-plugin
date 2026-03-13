import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TasksStackParams } from '../navigation/types';
import {
  addTask,
  toggleTask,
  removeTask,
  setFilter,
  markAllSynced,
  cyclePriority,
  toggleSort,
  selectSortedFilteredTasks,
  selectUnsyncedCount,
  selectActiveTaskCount,
  selectCurrentFilter,
  selectCurrentSort,
} from '../store/slices/tasksSlice';
import type { TaskFilter, TaskItem, TaskPriority } from '../store/slices/tasksSlice';
import { useThemeColors } from '../hooks/useThemeColors';

const API_BASE = 'https://api.testapp.local';

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Med' },
  low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' },
};

type Props = NativeStackScreenProps<TasksStackParams, 'TasksMain'>;

export default function TasksScreen(_props: Props) {
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const filteredTasks = useSelector(selectSortedFilteredTasks);
  const currentFilter = useSelector(selectCurrentFilter);
  const currentSort = useSelector(selectCurrentSort);
  const unsyncedCount = useSelector(selectUnsyncedCount);
  const activeCount = useSelector(selectActiveTaskCount);
  const colors = useThemeColors();

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    dispatch(addTask(trimmed));
    setText('');
  };

  const handleSync = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: unsyncedCount }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      dispatch(markAllSynced());
    } catch (err) {
      if (__DEV__) console.error('[Tasks] sync failed:', err);
    }
  };

  const renderItem = useCallback(({ item }: { item: TaskItem }) => {
    const ps = PRIORITY_STYLES[item.priority];
    return (
      <View
        testID={`task-item-${item.id}`}
        className={`mb-2 flex-row items-center rounded-lg p-4 ${item.done ? colors.card : `${colors.bg} border ${colors.border}`}`}
      >
        <Pressable
          testID={`task-toggle-${item.id}`}
          className={`h-6 w-6 rounded-full border-2 items-center justify-center ${item.done ? 'border-green-500 bg-green-500' : colors.border}`}
          onPress={() => dispatch(toggleTask(item.id))}
        >
          {item.done && <Text className="text-xs text-white">✓</Text>}
        </Pressable>

        <Pressable
          testID={`task-priority-${item.id}`}
          className={`ml-2 rounded-full px-2 py-0.5 ${ps.bg}`}
          onPress={() => dispatch(cyclePriority(item.id))}
        >
          <Text className={`text-xs font-semibold ${ps.text}`}>{ps.label}</Text>
        </Pressable>

        <Text
          testID={`task-title-${item.id}`}
          className={`ml-2 flex-1 ${item.done ? colors.muted : colors.text} ${item.done ? 'line-through' : ''}`}
        >
          {item.title}
        </Text>

        {!item.synced && (
          <View testID={`task-unsynced-${item.id}`} className="mr-2 h-2 w-2 rounded-full bg-orange-400" />
        )}

        <Pressable
          testID={`task-remove-${item.id}`}
          className="ml-2 h-6 w-6 items-center justify-center rounded-full bg-red-100"
          onPress={() => dispatch(removeTask(item.id))}
        >
          <Text className="text-xs text-red-500">✕</Text>
        </Pressable>
      </View>
    );
  }, [dispatch, colors]);

  return (
    <View testID="task-screen" className={`flex-1 ${colors.bg} px-4 pt-4`}>
      <Text testID="task-header" className={`text-xl font-bold ${colors.text}`}>
        Tasks ({activeCount} active)
      </Text>

      <View className="mt-3 flex-row gap-2">
        <TextInput
          testID="task-input"
          className={`flex-1 rounded-lg border ${colors.border} px-3 py-2 ${colors.text}`}
          placeholder="Add a task..."
          placeholderTextColor={colors.placeholderColor}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          testID="task-add-btn"
          className="rounded-lg bg-blue-500 px-4 py-2 justify-center"
          onPress={handleAdd}
        >
          <Text className="font-semibold text-white">Add</Text>
        </Pressable>
      </View>

      <View testID="task-filters" className="mt-3 flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            testID={`task-filter-${f.key}`}
            className={`rounded-full px-4 py-1.5 ${currentFilter === f.key ? 'bg-blue-500' : colors.card}`}
            onPress={() => dispatch(setFilter(f.key))}
          >
            <Text className={currentFilter === f.key ? 'font-semibold text-white' : colors.text}>
              {f.label}
            </Text>
          </Pressable>
        ))}
        <Pressable
          testID="task-sort-btn"
          className={`rounded-full px-4 py-1.5 ${currentSort === 'priority' ? 'bg-purple-500' : colors.card}`}
          onPress={() => dispatch(toggleSort())}
        >
          <Text
            testID="task-sort-label"
            className={currentSort === 'priority' ? 'font-semibold text-white' : colors.text}
          >
            {currentSort === 'priority' ? 'Sort: Priority' : 'Sort: Default'}
          </Text>
        </Pressable>
      </View>

      {filteredTasks.length === 0 ? (
        <View testID="task-empty" className="flex-1 items-center justify-center">
          <Text className={`text-lg ${colors.muted}`}>
            {currentFilter === 'all' ? 'No tasks yet' : `No ${currentFilter} tasks`}
          </Text>
        </View>
      ) : (
        <FlatList
          testID="task-list"
          className="mt-4"
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View className="pb-4 pt-2">
        <Pressable
          testID="task-sync-btn"
          className={`rounded-lg px-4 py-3 ${unsyncedCount > 0 ? 'bg-indigo-500' : 'bg-gray-300'}`}
          onPress={handleSync}
          disabled={unsyncedCount === 0}
        >
          <Text className="text-center font-semibold text-white">
            {unsyncedCount > 0 ? `Sync ${unsyncedCount} change${unsyncedCount > 1 ? 's' : ''}` : 'All synced'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
