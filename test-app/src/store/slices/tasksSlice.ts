import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export type TaskFilter = 'all' | 'active' | 'done';

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
  synced: boolean;
}

interface TasksState {
  items: TaskItem[];
  filter: TaskFilter;
}

const initialState: TasksState = {
  items: [
    { id: '1', title: 'Review pull request', done: false, synced: true },
    { id: '2', title: 'Update documentation', done: false, synced: true },
    { id: '3', title: 'Fix navigation bug', done: true, synced: true },
  ],
  filter: 'all',
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    addTask: (state, action: PayloadAction<string>) => {
      const maxId = state.items.reduce((m, t) => Math.max(m, Number(t.id)), 0);
      state.items.unshift({
        id: String(maxId + 1),
        title: action.payload,
        done: false,
        synced: false,
      });
    },
    toggleTask: (state, action: PayloadAction<string>) => {
      const task = state.items.find((t) => t.id === action.payload);
      if (task) {
        task.done = !task.done;
        task.synced = false;
      }
    },
    removeTask: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
    setFilter: (state, action: PayloadAction<TaskFilter>) => {
      state.filter = action.payload;
    },
    markAllSynced: (state) => {
      state.items.forEach((t) => { t.synced = true; });
    },
  },
});

export const { addTask, toggleTask, removeTask, setFilter, markAllSynced } = tasksSlice.actions;

export const selectActiveTaskCount = createSelector(
  (state: { tasks: TasksState }) => state.tasks.items,
  (items) => items.filter((t) => !t.done).length,
);

export const selectFilteredTasks = createSelector(
  (state: { tasks: TasksState }) => state.tasks.items,
  (state: { tasks: TasksState }) => state.tasks.filter,
  (items, filter) => {
    if (filter === 'active') return items.filter((t) => !t.done);
    if (filter === 'done') return items.filter((t) => t.done);
    return items;
  },
);

export const selectUnsyncedCount = (state: { tasks: TasksState }) =>
  state.tasks.items.filter((t) => !t.synced).length;

export const selectCurrentFilter = (state: { tasks: TasksState }) =>
  state.tasks.filter;

export default tasksSlice;
