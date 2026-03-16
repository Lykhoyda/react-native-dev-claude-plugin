import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import { useThemeColors } from '../hooks/useThemeColors';
import type { TaskPriority } from '../store/slices/tasksSlice';

interface TasksState {
  items: Array<{ priority: TaskPriority; done: boolean }>;
}

const COLORS: Record<TaskPriority, string> = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

export default function DashboardScreen() {
  const colors = useThemeColors();
  const items = useSelector((state: { tasks: TasksState }) => state.tasks.items);
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParams>>();

  const stats = useMemo(() => {
    const counts: Record<TaskPriority, number> = { high: 0, medium: 0, low: 0 };
    let doneCount = 0;
    items.forEach((t) => {
      counts[t.priority]++;
      if (t.done) doneCount++;
    });
    return { counts, total: items.length, doneCount };
  }, [items]);

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const priorities: TaskPriority[] = ['high', 'medium', 'low'];

  let offset = 0;
  const segments = priorities.map((p) => {
    const pct = stats.total > 0 ? stats.counts[p] / stats.total : 0;
    const dashLength = pct * circumference;
    const seg = { priority: p, dashArray: `${dashLength} ${circumference - dashLength}`, offset, color: COLORS[p], count: stats.counts[p], pct };
    offset -= dashLength;
    return seg;
  });

  return (
    <View testID="dashboard-screen" className={`flex-1 ${colors.bg} px-4 pt-4`}>
      <Text className={`text-xl font-bold ${colors.text}`}>Dashboard</Text>
      <Text className={`mt-1 ${colors.muted}`}>{stats.total} tasks, {stats.doneCount} completed</Text>

      <View className="mt-6 items-center">
        <Svg testID="chart-pie" width={160} height={160} viewBox="0 0 160 160">
          <G rotation="-90" origin="80, 80">
            {segments.map((seg) => (
              <Circle
                key={seg.priority}
                testID={`chart-pie-slice-${seg.priority}`}
                cx={80}
                cy={80}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={20}
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.offset}
              />
            ))}
          </G>
          <SvgText x={80} y={85} textAnchor="middle" fontSize={20} fontWeight="bold" fill={colors.text === 'text-white' ? '#fff' : '#111'}>
            {stats.total}
          </SvgText>
        </Svg>
      </View>

      <View className="mt-6">
        {segments.map((seg) => (
          <Pressable
            key={seg.priority}
            testID={`chart-legend-${seg.priority}`}
            className={`mb-2 flex-row items-center rounded-lg p-3 ${colors.card}`}
            onPress={() => rootNav.navigate('Tabs', { screen: 'TasksTab' })}
          >
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: seg.color, marginRight: 12 }} />
            <Text className={`flex-1 font-medium ${colors.text}`}>
              {seg.priority.charAt(0).toUpperCase() + seg.priority.slice(1)}
            </Text>
            <Text className={`font-bold ${colors.text}`}>{seg.count}</Text>
            <Text className={`ml-2 text-sm ${colors.muted}`}>
              ({Math.round(seg.pct * 100)}%)
            </Text>
          </Pressable>
        ))}
      </View>

      <View testID="chart-bar" className="mt-6">
        <Text className={`mb-2 font-medium ${colors.text}`}>Completion Rate</Text>
        <View className={`h-6 rounded-full ${colors.card} overflow-hidden`}>
          <View
            style={{ width: `${stats.total > 0 ? (stats.doneCount / stats.total) * 100 : 0}%`, height: '100%', backgroundColor: '#22c55e', borderRadius: 12 }}
          />
        </View>
        <Text className={`mt-1 text-sm ${colors.muted}`}>
          {stats.doneCount}/{stats.total} done ({stats.total > 0 ? Math.round((stats.doneCount / stats.total) * 100) : 0}%)
        </Text>
      </View>
    </View>
  );
}
