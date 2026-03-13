import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, Text, TextInput, Pressable } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootState, AppDispatch } from '../store';
import type { RootStackParams } from '../navigation/types';
import { updateProfile } from '../store/slices/userSlice';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = NativeStackScreenProps<RootStackParams, 'ProfileEditModal'>;

const BASE_URL = 'https://api.testapp.local';

export default function ProfileEditModal({ navigation }: Props) {
  const user = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const colors = useThemeColors();

  const emailRef = useRef<TextInput>(null);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');

  const validate = (): boolean => {
    let valid = true;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setNameError('Name must be at least 2 characters');
      valid = false;
    } else {
      setNameError('');
    }

    const atIndex = trimmedEmail.indexOf('@');
    if (atIndex < 1 || atIndex === trimmedEmail.length - 1) {
      setEmailError('Enter a valid email address');
      valid = false;
    } else {
      setEmailError('');
    }

    return valid;
  };

  const handleSave = () => {
    if (!validate()) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    dispatch(updateProfile({ name: trimmedName, email: trimmedEmail }));

    fetch(`${BASE_URL}/api/user/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName, email: trimmedEmail }),
    }).catch(() => {});

    navigation.goBack();
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      className={`flex-1 ${colors.bg} px-4 pt-4`}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text className={`text-xl font-bold ${colors.text}`}>Edit Profile</Text>
      <Text className={`mt-1 ${colors.muted}`}>Update your name and email</Text>

      <View className="mt-6">
        <Text className={`mb-1 text-sm font-medium ${colors.text}`}>Name</Text>
        <TextInput
          testID="edit-name-input"
          className={`rounded-lg border ${nameError ? 'border-red-500' : colors.border} px-3 py-2 text-base ${colors.text}`}
          placeholderTextColor={colors.placeholderColor}
          placeholder="Enter your name"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (nameError) setNameError('');
          }}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        {nameError ? (
          <Text testID="edit-name-error" className="mt-1 text-sm text-red-500">{nameError}</Text>
        ) : null}
      </View>

      <View className="mt-4">
        <Text className={`mb-1 text-sm font-medium ${colors.text}`}>Email</Text>
        <TextInput
          ref={emailRef}
          testID="edit-email-input"
          className={`rounded-lg border ${emailError ? 'border-red-500' : colors.border} px-3 py-2 text-base ${colors.text}`}
          placeholderTextColor={colors.placeholderColor}
          placeholder="Enter your email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (emailError) setEmailError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
        {emailError ? (
          <Text testID="edit-email-error" className="mt-1 text-sm text-red-500">{emailError}</Text>
        ) : null}
      </View>

      <Pressable
        testID="edit-save-btn"
        className="mt-6 rounded-lg bg-blue-500 px-4 py-3"
        onPress={handleSave}
      >
        <Text className="text-center font-semibold text-white">Save</Text>
      </Pressable>

      <Pressable
        testID="edit-cancel-btn"
        className={`mt-3 rounded-lg px-4 py-3 ${colors.card}`}
        onPress={handleCancel}
      >
        <Text className={`text-center font-semibold ${colors.text}`}>Cancel</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
