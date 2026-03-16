import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const scales = useRef(
    Array.from({ length: totalSteps }, () => new Animated.Value(1)),
  ).current;

  useEffect(() => {
    scales.forEach((scale, i) => {
      Animated.spring(scale, {
        toValue: i === currentStep ? 1.4 : 1,
        useNativeDriver: true,
        friction: 6,
      }).start();
    });
  }, [currentStep, scales]);

  return (
    <View testID="wizard-step-indicator" className="flex-row items-center justify-center py-4">
      {scales.map((scale, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <View
                className={`h-0.5 w-8 ${i <= currentStep ? 'bg-blue-500' : 'bg-gray-300'}`}
              />
            )}
            <Animated.View
              style={{ transform: [{ scale }] }}
              className={`h-3 w-3 rounded-full ${
                isActive ? 'bg-blue-500' : isCompleted ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}
