import {
  Circle,
  Group,
  Path,
  Rect,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import React from 'react';

/** All collectible power kinds across Pong / Breaker / Invaders / Asteroids. */
export type PowerOrbKind =
  | 'grow'
  | 'shrink'
  | 'turbo'
  | 'reverse'
  | 'swap'
  | 'multi'
  | 'laser'
  | 'wide'
  | 'slow'
  | 'repulsor'
  | 'shield'
  | 'overdrive'
  | 'rocket'
  | 'bomb'
  | 'spray'
  | 'nova'
  | 'boost';

const BLINK_PERIOD = 0.45;

function halfDiskPath(cx: number, cy: number, r: number, side: 'left' | 'right') {
  const oval = Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2);
  return Skia.PathBuilder.Make()
    .moveTo(cx, cy - r)
    .arcToOval(oval, -90, side === 'left' ? -180 : 180, false)
    .close()
    .detach();
}

/** Literal silhouette cutouts punched through the orb fill. */
export function PowerGlyph({
  kind,
  cx,
  cy,
  cut,
}: {
  kind: PowerOrbKind;
  cx: number;
  cy: number;
  cut: string;
}) {
  if (kind === 'grow') {
    return (
      <Group>
        <RoundedRect x={cx - 9} y={cy - 2.5} width={18} height={5} r={1.5} color={cut} />
        <RoundedRect x={cx - 2.5} y={cy - 9} width={5} height={18} r={1.5} color={cut} />
      </Group>
    );
  }
  if (kind === 'shrink') {
    return <RoundedRect x={cx - 9} y={cy - 2.5} width={18} height={5} r={1.5} color={cut} />;
  }
  if (kind === 'turbo' || kind === 'boost' || kind === 'overdrive') {
    const bolt = Skia.PathBuilder.Make()
      .moveTo(cx + 2, cy - 10)
      .lineTo(cx - 4, cy)
      .lineTo(cx + 1, cy)
      .lineTo(cx - 2, cy + 10)
      .lineTo(cx + 5, cy + 1)
      .lineTo(cx + 0.5, cy + 1)
      .close()
      .detach();
    return <Path path={bolt} color={cut} />;
  }
  if (kind === 'reverse') {
    const up = Skia.PathBuilder.Make()
      .moveTo(cx, cy - 10)
      .lineTo(cx - 7, cy - 1)
      .lineTo(cx + 7, cy - 1)
      .close()
      .detach();
    const down = Skia.PathBuilder.Make()
      .moveTo(cx, cy + 10)
      .lineTo(cx - 7, cy + 1)
      .lineTo(cx + 7, cy + 1)
      .close()
      .detach();
    return (
      <Group>
        <Path path={up} color={cut} />
        <Path path={down} color={cut} />
      </Group>
    );
  }
  if (kind === 'wide') {
    return (
      <Group>
        <RoundedRect x={cx - 10} y={cy - 2} width={20} height={4} r={2} color={cut} />
        <RoundedRect x={cx - 10} y={cy - 6} width={3.5} height={12} r={1.5} color={cut} />
        <RoundedRect x={cx + 6.5} y={cy - 6} width={3.5} height={12} r={1.5} color={cut} />
      </Group>
    );
  }
  if (kind === 'slow') {
    const top = Skia.PathBuilder.Make()
      .moveTo(cx - 8, cy - 6)
      .lineTo(cx, cy - 1)
      .lineTo(cx + 8, cy - 6)
      .lineTo(cx + 5, cy - 6)
      .lineTo(cx, cy - 3)
      .lineTo(cx - 5, cy - 6)
      .close()
      .detach();
    const bot = Skia.PathBuilder.Make()
      .moveTo(cx - 8, cy + 1)
      .lineTo(cx, cy + 6)
      .lineTo(cx + 8, cy + 1)
      .lineTo(cx + 5, cy + 1)
      .lineTo(cx, cy + 4)
      .lineTo(cx - 5, cy + 1)
      .close()
      .detach();
    return (
      <Group>
        <Path path={top} color={cut} />
        <Path path={bot} color={cut} />
      </Group>
    );
  }
  if (kind === 'multi') {
    return (
      <Group>
        <Circle cx={cx - 6} cy={cy + 1} r={3.4} color={cut} />
        <Circle cx={cx + 6} cy={cy + 1} r={3.4} color={cut} />
        <Circle cx={cx} cy={cy - 5} r={3.4} color={cut} />
      </Group>
    );
  }
  if (kind === 'laser') {
    return (
      <Group>
        <RoundedRect x={cx - 6} y={cy - 9} width={4} height={18} r={1.5} color={cut} />
        <RoundedRect x={cx + 2} y={cy - 9} width={4} height={18} r={1.5} color={cut} />
        <RoundedRect x={cx - 7} y={cy - 10} width={6} height={3} r={1} color={cut} />
        <RoundedRect x={cx + 1} y={cy - 10} width={6} height={3} r={1} color={cut} />
      </Group>
    );
  }
  if (kind === 'repulsor') {
    return (
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx, cy - 9)
          .lineTo(cx + 8, cy + 1)
          .lineTo(cx + 3.5, cy + 1)
          .lineTo(cx + 3.5, cy + 9)
          .lineTo(cx - 3.5, cy + 9)
          .lineTo(cx - 3.5, cy + 1)
          .lineTo(cx - 8, cy + 1)
          .close()
          .detach()}
        color={cut}
      />
    );
  }
  if (kind === 'shield') {
    return (
      <Path
        path={Skia.PathBuilder.Make()
          .moveTo(cx, cy - 9)
          .lineTo(cx + 8, cy - 3)
          .lineTo(cx + 8, cy + 2)
          .lineTo(cx, cy + 10)
          .lineTo(cx - 8, cy + 2)
          .lineTo(cx - 8, cy - 3)
          .close()
          .detach()}
        color={cut}
      />
    );
  }
  if (kind === 'rocket') {
    return (
      <Group>
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx, cy - 10)
            .lineTo(cx + 5, cy - 2)
            .lineTo(cx + 3.5, cy - 2)
            .lineTo(cx + 3.5, cy + 5)
            .lineTo(cx - 3.5, cy + 5)
            .lineTo(cx - 3.5, cy - 2)
            .lineTo(cx - 5, cy - 2)
            .close()
            .detach()}
          color={cut}
        />
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx - 3.5, cy + 5)
            .lineTo(cx - 7, cy + 10)
            .lineTo(cx - 1, cy + 7)
            .close()
            .detach()}
          color={cut}
        />
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx + 3.5, cy + 5)
            .lineTo(cx + 7, cy + 10)
            .lineTo(cx + 1, cy + 7)
            .close()
            .detach()}
          color={cut}
        />
        <Rect x={cx - 1.5} y={cy + 5} width={3} height={4} color={cut} />
      </Group>
    );
  }
  if (kind === 'bomb') {
    return (
      <Group>
        <Circle cx={cx} cy={cy + 1.5} r={7} color={cut} />
        <Rect x={cx - 1.5} y={cy - 9} width={3} height={5} color={cut} />
        <Path
          path={Skia.PathBuilder.Make()
            .moveTo(cx, cy - 9)
            .lineTo(cx + 3, cy - 12)
            .lineTo(cx + 5, cy - 10)
            .lineTo(cx + 2, cy - 8)
            .close()
            .detach()}
          color={cut}
        />
      </Group>
    );
  }
  if (kind === 'spray') {
    return (
      <Group>
        <Rect x={cx - 1.5} y={cy - 9} width={3} height={14} color={cut} />
        <Rect x={cx - 7} y={cy - 6} width={3} height={11} color={cut} />
        <Rect x={cx + 4} y={cy - 6} width={3} height={11} color={cut} />
        <Circle cx={cx} cy={cy - 9} r={2.2} color={cut} />
        <Circle cx={cx - 5.5} cy={cy - 6} r={2} color={cut} />
        <Circle cx={cx + 5.5} cy={cy - 6} r={2} color={cut} />
      </Group>
    );
  }
  if (kind === 'nova') {
    return (
      <Group>
        <Circle cx={cx} cy={cy} r={3.5} color={cut} />
        <Rect x={cx - 1.2} y={cy - 10} width={2.4} height={6} color={cut} />
        <Rect x={cx - 1.2} y={cy + 4} width={2.4} height={6} color={cut} />
        <Rect x={cx - 10} y={cy - 1.2} width={6} height={2.4} color={cut} />
        <Rect x={cx + 4} y={cy - 1.2} width={6} height={2.4} color={cut} />
        <Rect x={cx - 7} y={cy - 7} width={3} height={3} color={cut} />
        <Rect x={cx + 4} y={cy - 7} width={3} height={3} color={cut} />
        <Rect x={cx - 7} y={cy + 4} width={3} height={3} color={cut} />
        <Rect x={cx + 4} y={cy + 4} width={3} height={3} color={cut} />
      </Group>
    );
  }
  // swap — opposing arrows (also used when half-disc rim is drawn)
  const left = Skia.PathBuilder.Make()
    .moveTo(cx - 10, cy)
    .lineTo(cx - 1, cy - 8)
    .lineTo(cx - 1, cy + 8)
    .close()
    .detach();
  const right = Skia.PathBuilder.Make()
    .moveTo(cx + 10, cy)
    .lineTo(cx + 1, cy - 8)
    .lineTo(cx + 1, cy + 8)
    .close()
    .detach();
  return (
    <Group>
      <Path path={left} color={cut} />
      <Path path={right} color={cut} />
    </Group>
  );
}

export function PowerOrb({
  kind,
  cx,
  cy,
  r,
  leftColor,
  rightColor,
  boardBg,
  blinkT,
}: {
  kind: PowerOrbKind;
  cx: number;
  cy: number;
  r: number;
  leftColor: string;
  rightColor: string;
  boardBg: string;
  /** Seconds — disc alternates left/right every ~0.45s. */
  blinkT: number;
}) {
  const useLeft = Math.floor(blinkT / BLINK_PERIOD) % 2 === 0;
  const fill = useLeft ? leftColor : rightColor;
  const pulse = 0.75 + 0.25 * Math.sin(blinkT * Math.PI * 2 / BLINK_PERIOD);

  if (kind === 'swap') {
    return (
      <Group opacity={pulse}>
        <Circle cx={cx} cy={cy} r={r + 3} color={fill} opacity={0.28} />
        <Path path={halfDiskPath(cx, cy, r, 'left')} color={leftColor} />
        <Path path={halfDiskPath(cx, cy, r, 'right')} color={rightColor} />
      </Group>
    );
  }

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={r + 3} color={fill} opacity={0.32} />
      <Circle cx={cx} cy={cy} r={r} color={fill} />
      <PowerGlyph kind={kind} cx={cx} cy={cy} cut={boardBg} />
    </Group>
  );
}
