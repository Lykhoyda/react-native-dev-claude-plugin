import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export interface ThemeColors {
  bg: string;
  text: string;
  card: string;
  border: string;
  muted: string;
  placeholderColor: string;
}

const lightColors: ThemeColors = {
  bg: 'bg-white',
  text: 'text-gray-900',
  card: 'bg-gray-100',
  border: 'border-gray-300',
  muted: 'text-gray-500',
  placeholderColor: '#6b7280',
};

const darkColors: ThemeColors = {
  bg: 'bg-gray-900',
  text: 'text-white',
  card: 'bg-gray-800',
  border: 'border-gray-700',
  muted: 'text-gray-400',
  placeholderColor: '#9ca3af',
};

export function useThemeColors(): ThemeColors {
  const theme = useSelector((state: RootState) => state.settings.theme);
  return theme === 'dark' ? darkColors : lightColors;
}
