import React, { useCallback, useMemo, forwardRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import type { TaskItem, TaskPriority } from '../store/slices/tasksSlice';
import { toggleTask, cyclePriority, softDelete } from '../store/slices/tasksSlice';
import { PRIORITY_STYLES } from '../constants/taskStyles';
import { useThemeColors } from '../hooks/useThemeColors';

interface TaskBottomSheetProps {
  task: TaskItem | null;
  onDismiss: () => void;
}

const TaskBottomSheet = forwardRef<BottomSheet, TaskBottomSheetProps>(
  ({ task, onDismiss }, ref) => {
    const dispatch = useDispatch<AppDispatch>();
    const colors = useThemeColors();
    const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          testID="task-sheet-backdrop"
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    const handleDelete = useCallback(() => {
      if (task) {
        dispatch(softDelete(task.id));
        onDismiss();
      }
    }, [dispatch, task, onDismiss]);

    const pStyle = task ? PRIORITY_STYLES[task.priority] : PRIORITY_STYLES.medium;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onDismiss}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: '#999' }}
      >
        {task ? (
          <View testID="task-sheet" className="flex-1 px-6 pt-2">
            <View testID="task-sheet-handle" className="mb-4">
              <Text testID="task-sheet-title" className={`text-xl font-bold ${colors.text}`}>
                {task.title}
              </Text>
              {task.description ? (
                <Text className={`mt-2 text-sm ${colors.muted}`}>{task.description}</Text>
              ) : null}
            </View>

            <View className="mb-4">
              <Text className={`mb-2 text-sm font-medium ${colors.muted}`}>Priority</Text>
              <Pressable
                testID="task-sheet-priority"
                onPress={() => dispatch(cyclePriority(task.id))}
                className={`self-start rounded-full px-4 py-2 ${pStyle.bg}`}
              >
                <Text className={`font-medium ${pStyle.text}`}>{pStyle.label} (tap to cycle)</Text>
              </Pressable>
            </View>

            <View className="mb-4">
              <Text className={`mb-2 text-sm font-medium ${colors.muted}`}>Status</Text>
              <Pressable
                testID="task-sheet-done"
                onPress={() => dispatch(toggleTask(task.id))}
                className={`self-start rounded-full px-4 py-2 ${task.done ? 'bg-green-100' : 'bg-gray-100'}`}
              >
                <Text className={`font-medium ${task.done ? 'text-green-700' : 'text-gray-700'}`}>
                  {task.done ? 'Done' : 'Active'} (tap to toggle)
                </Text>
              </Pressable>
            </View>

            <Pressable
              testID="task-sheet-delete"
              onPress={handleDelete}
              className="mt-4 rounded-xl bg-red-500 py-3"
            >
              <Text className="text-center font-semibold text-white">Delete Task</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1" />
        )}
      </BottomSheet>
    );
  },
);

TaskBottomSheet.displayName = 'TaskBottomSheet';

export default TaskBottomSheet;
