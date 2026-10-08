import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { dichopticLetters } from '@/src/anaglyph/render';
import type { AnaglyphColors } from '@/src/anaglyph/color';
import { neutralForeground, type AnaglyphBackground } from '@/src/anaglyph/color';

export function DichopticText({
  text,
  colors,
  background = 'black',
  enabled = true,
  style,
}: {
  text: string;
  colors: AnaglyphColors;
  background?: AnaglyphBackground;
  enabled?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  if (!enabled) {
    return <Text style={style}>{text}</Text>;
  }
  const segments = dichopticLetters(text, colors);
  const neutral = neutralForeground(background);
  return (
    <Text style={style}>
      {segments.map((segment, index) => (
        <Text key={`${segment.text}-${index}`} style={{ color: segment.color ?? neutral }}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}
