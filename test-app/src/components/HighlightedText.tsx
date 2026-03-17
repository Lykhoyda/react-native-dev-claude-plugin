import React, { memo } from 'react';
import { Text } from 'react-native';

interface Props {
  text: string;
  highlight: string;
  textClassName: string;
  highlightClassName: string;
  testID?: string;
  numberOfLines?: number;
}

export const HighlightedText = memo(function HighlightedText({
  text,
  highlight,
  textClassName,
  highlightClassName,
  testID,
  numberOfLines,
}: Props) {
  if (!highlight) {
    return (
      <Text testID={testID} className={textClassName} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const parts: { text: string; match: boolean }[] = [];
  const lower = text.toLowerCase();
  const queryLower = highlight.toLowerCase();
  let lastIndex = 0;

  let idx = lower.indexOf(queryLower);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), match: false });
    }
    parts.push({ text: text.slice(idx, idx + highlight.length), match: true });
    lastIndex = idx + highlight.length;
    idx = lower.indexOf(queryLower, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false });
  }

  return (
    <Text testID={testID} className={textClassName} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.match ? (
          <Text key={i} className={highlightClassName}>
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        ),
      )}
    </Text>
  );
});
