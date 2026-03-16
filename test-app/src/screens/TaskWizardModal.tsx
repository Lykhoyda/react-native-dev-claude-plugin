import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation/types';
import type { AppDispatch } from '../store';
import type { TaskPriority } from '../store/slices/tasksSlice';
import { addTaskFull } from '../store/slices/tasksSlice';
import { PRIORITY_STYLES } from '../constants/taskStyles';
import { useThemeColors } from '../hooks/useThemeColors';
import StepIndicator from '../components/StepIndicator';

type Props = NativeStackScreenProps<RootStackParams, 'TaskWizard'>;

const AVAILABLE_TAGS = ['Bug', 'Feature', 'Chore'];

export default function TaskWizardModal({ navigation }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [titleError, setTitleError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const descRef = useRef<TextInput>(null);
  const mountedRef = useRef(true);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    mountedRef.current = false;
    timerRefs.current.forEach(clearTimeout);
  }, []);

  const hasFormData = title.length > 0 || description.length > 0;

  const animateToStep = useCallback((nextStep: number) => {
    Animated.timing(slideAnim, {
      toValue: -nextStep * screenWidth,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setStep(nextStep);
  }, [slideAnim, screenWidth]);

  const handleNext = useCallback(() => {
    if (step === 0) {
      if (title.trim().length < 3) {
        setTitleError('Title must be at least 3 characters');
        return;
      }
      setTitleError('');
    }
    animateToStep(step + 1);
  }, [step, title, animateToStep]);

  const handleBack = useCallback(() => {
    if (step === 0) {
      if (hasFormData) {
        Alert.alert('Discard changes?', 'Your progress will be lost.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]);
      } else {
        navigation.goBack();
      }
      return;
    }
    animateToStep(step - 1);
  }, [step, hasFormData, navigation, animateToStep]);

  const handleCreate = useCallback(() => {
    setCreating(true);
    const t1 = setTimeout(() => {
      dispatch(addTaskFull({
        title: title.trim(),
        description: description.trim(),
        priority,
        tags: selectedTags,
      }));
      if (!mountedRef.current) return;
      setCreating(false);
      setShowSuccess(true);
      const t2 = setTimeout(() => {
        if (mountedRef.current) navigation.goBack();
      }, 1200);
      timerRefs.current.push(t2);
    }, 600);
    timerRefs.current.push(t1);
  }, [dispatch, title, description, priority, selectedTags, navigation]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="wizard-modal"
      className={`flex-1 ${colors.bg}`}
    >
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-14 pb-2">
          <Pressable testID="wizard-back-btn" onPress={handleBack} className="p-2">
            <Text className={`text-base ${colors.text}`}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Text>
          </Pressable>
          <Text className={`text-lg font-semibold ${colors.text}`}>New Task</Text>
          <View className="w-16" />
        </View>

        <StepIndicator currentStep={step} totalSteps={3} />

        {/* Steps Container */}
        <Animated.View
          style={{
            flexDirection: 'row',
            width: screenWidth * 3,
            transform: [{ translateX: slideAnim }],
          }}
          className="flex-1"
        >
          {/* Step 1: Title & Description */}
          <View testID="wizard-step-1" style={{ width: screenWidth }} className="px-6">
            <Text className={`mb-2 text-sm font-medium ${colors.muted}`}>STEP 1 OF 3</Text>
            <Text className={`mb-6 text-xl font-bold ${colors.text}`}>Title & Description</Text>

            <Text className={`mb-1 text-sm ${colors.text}`}>Title *</Text>
            <TextInput
              testID="wizard-title-input"
              value={title}
              onChangeText={(t) => { setTitle(t); if (titleError) setTitleError(''); }}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.placeholderColor}
              returnKeyType="next"
              onSubmitEditing={() => descRef.current?.focus()}
              className={`mb-1 rounded-lg border px-4 py-3 text-base ${colors.card} ${colors.text} ${titleError ? 'border-red-500' : colors.border}`}
            />
            {titleError ? (
              <Text testID="wizard-title-error" className="mb-3 text-sm text-red-500">{titleError}</Text>
            ) : (
              <View className="mb-3" />
            )}

            <Text className={`mb-1 text-sm ${colors.text}`}>Description</Text>
            <TextInput
              ref={descRef}
              testID="wizard-desc-input"
              value={description}
              onChangeText={setDescription}
              placeholder="Add details (optional)"
              placeholderTextColor={colors.placeholderColor}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className={`rounded-lg border px-4 py-3 text-base ${colors.card} ${colors.text} ${colors.border}`}
              style={{ minHeight: 100 }}
            />
            <Text testID="wizard-char-count" className={`mt-1 text-right text-xs ${colors.muted}`}>
              {description.length}/500
            </Text>
          </View>

          {/* Step 2: Priority & Tags */}
          <View testID="wizard-step-2" style={{ width: screenWidth }} className="px-6">
            <Text className={`mb-2 text-sm font-medium ${colors.muted}`}>STEP 2 OF 3</Text>
            <Text className={`mb-6 text-xl font-bold ${colors.text}`}>Priority & Tags</Text>

            <Text className={`mb-3 text-sm font-medium ${colors.text}`}>Priority</Text>
            <View className="mb-6 flex-row gap-3">
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                const isActive = priority === p;
                const style = PRIORITY_STYLES[p];
                return (
                  <Pressable
                    key={p}
                    testID={`wizard-priority-${p}`}
                    onPress={() => setPriority(p)}
                    className={`rounded-full px-5 py-2.5 ${isActive ? style.bg : 'bg-gray-100'} ${isActive ? 'border-2 border-blue-500' : 'border border-gray-200'}`}
                  >
                    <Text className={`text-sm font-medium ${isActive ? style.text : 'text-gray-500'}`}>
                      {style.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className={`mb-3 text-sm font-medium ${colors.text}`}>Tags</Text>
            <View className="flex-row gap-3">
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    testID={`wizard-tag-${tag.toLowerCase()}`}
                    onPress={() => toggleTag(tag)}
                    className={`rounded-full px-5 py-2.5 ${isSelected ? 'bg-blue-500' : 'bg-gray-100'} ${isSelected ? 'border-2 border-blue-600' : 'border border-gray-200'}`}
                  >
                    <Text className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Step 3: Review & Confirm */}
          <View testID="wizard-step-3" style={{ width: screenWidth }} className="px-6">
            <Text className={`mb-2 text-sm font-medium ${colors.muted}`}>STEP 3 OF 3</Text>
            <Text className={`mb-6 text-xl font-bold ${colors.text}`}>Review & Create</Text>

            <View className={`rounded-xl border p-4 ${colors.card} ${colors.border}`}>
              <Text className={`mb-1 text-xs ${colors.muted}`}>Title</Text>
              <Text className={`mb-3 text-base font-semibold ${colors.text}`}>{title}</Text>

              {description.length > 0 && (
                <>
                  <Text className={`mb-1 text-xs ${colors.muted}`}>Description</Text>
                  <Text className={`mb-3 text-sm ${colors.text}`}>{description}</Text>
                </>
              )}

              <Text className={`mb-1 text-xs ${colors.muted}`}>Priority</Text>
              <View className={`mb-3 self-start rounded-full px-3 py-1 ${PRIORITY_STYLES[priority].bg}`}>
                <Text className={`text-sm font-medium ${PRIORITY_STYLES[priority].text}`}>
                  {PRIORITY_STYLES[priority].label}
                </Text>
              </View>

              {selectedTags.length > 0 && (
                <>
                  <Text className={`mb-1 text-xs ${colors.muted}`}>Tags</Text>
                  <View className="flex-row gap-2">
                    {selectedTags.map((tag) => (
                      <View key={tag} className="rounded-full bg-blue-100 px-3 py-1">
                        <Text className="text-sm text-blue-700">{tag}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Bottom Buttons */}
        <View className="px-6 pb-10 pt-4">
          {step < 2 ? (
            <Pressable
              testID="wizard-next-btn"
              onPress={handleNext}
              className="items-center rounded-xl bg-blue-500 py-4"
            >
              <Text className="text-base font-semibold text-white">Next</Text>
            </Pressable>
          ) : (
            <Pressable
              testID="wizard-create-btn"
              onPress={handleCreate}
              disabled={creating}
              className={`items-center rounded-xl py-4 ${creating ? 'bg-green-400' : 'bg-green-500'}`}
            >
              {creating ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-semibold text-white">Create Task</Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {/* Success Toast */}
      {showSuccess && (
        <View
          testID="wizard-success-toast"
          className="absolute bottom-24 left-6 right-6 items-center rounded-xl bg-green-500 py-3"
          style={{ elevation: 6 }}
        >
          <Text className="text-base font-semibold text-white">Task created!</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
