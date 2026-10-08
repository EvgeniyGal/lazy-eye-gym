import { eyeColor, type AnaglyphColors, type EyeSide } from './color';
import { segmentLetters, segmentSyllables, type TextSegment } from './segment';

export type ColoredSegment = TextSegment & {
  eye?: EyeSide;
  color?: string;
};

export function colorizeSegments(
  segments: TextSegment[],
  colors: AnaglyphColors,
  startEye: EyeSide = 'left',
): ColoredSegment[] {
  let nextEye: EyeSide = startEye;
  return segments.map((segment) => {
    if (segment.kind !== 'content') {
      return segment;
    }
    const eye = nextEye;
    nextEye = eye === 'left' ? 'right' : 'left';
    return {
      ...segment,
      eye,
      color: eyeColor(colors, eye),
    };
  });
}

export function dichopticLetters(text: string, colors: AnaglyphColors) {
  return colorizeSegments(segmentLetters(text), colors);
}

export function dichopticSyllables(text: string, colors: AnaglyphColors) {
  return colorizeSegments(segmentSyllables(text), colors);
}
