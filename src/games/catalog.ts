import type { EyeSide } from '@/src/anaglyph/color';

export type GameId =
  | '2048'
  | 'pong'
  | 'maze'
  | 'breaker'
  | 'snake'
  | 'tetris'
  | 'invaders'
  | 'asteroids';

export type GameCategory = 'all' | 'reflex' | 'spatial';

export type GameSettingField =
  | { key: string; label: string; type: 'segment'; options: { label: string; value: string }[] }
  | { key: string; label: string; type: 'slider'; min: number; max: number; step: number }
  | { key: string; label: string; type: 'toggle' }
  | { key: string; label: string; type: 'eye'; options: { label: string; value: EyeSide }[] };

export type GameDefinition = {
  id: GameId;
  title: string;
  shortTitle: string;
  tag: string;
  category: GameCategory;
  blurb: string;
  dichopticSplit: { leftLabel: string; rightLabel: string };
  recordLabel: string;
  metricLabel: string;
  defaultSettings: Record<string, string | number | boolean>;
  fields: GameSettingField[];
};

export const GAMES: GameDefinition[] = [
  {
    id: '2048',
    title: '2048',
    shortTitle: '2048',
    tag: 'STRATEGY & FUSION',
    category: 'spatial',
    blurb: 'Pick a grid eye; tiles use the other eye on your optical background with transparent digits.',
    dichopticSplit: {
      leftLabel: 'Grid (chosen eye)',
      rightLabel: 'Tiles (other eye)',
    },
    recordLabel: 'Best score',
    metricLabel: 'Best tile',
    defaultSettings: {
      difficulty: 'medium',
      sound: true,
      gridEye: 'left',
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Difficulty',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Medium', value: 'medium' },
          { label: 'Hard', value: 'hard' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
      {
        key: 'gridEye',
        label: 'Grid colour (glasses)',
        type: 'eye',
        options: [
          { label: 'Left / Red', value: 'left' },
          { label: 'Right / Cyan', value: 'right' },
        ],
      },
    ],
  },
  {
    id: 'pong',
    title: 'Arcade Pong',
    shortTitle: 'Pong',
    tag: 'DYNAMIC TRACKING',
    category: 'reflex',
    blurb:
      'Level presets plus mid-court power orbs (+ grow, − shrink rival, bolt turbo, ⇅ reverse, ↔ swap colours) either side can grab.',
    dichopticSplit: {
      leftLabel: 'Player paddle (swaps in play)',
      rightLabel: 'Ball, AI & orbs (swaps in play)',
    },
    recordLabel: 'Best score',
    metricLabel: 'Longest rally',
    defaultSettings: {
      difficulty: 'easy',
      sound: true,
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Level',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'maze',
    title: 'Maze Chase',
    shortTitle: 'Maze',
    tag: 'SPATIAL PURSUIT',
    category: 'spatial',
    blurb:
      'Camera follows Pac-Man; ghosts have classic shapes and some flicker between glass colours.',
    dichopticSplit: {
      leftLabel: 'Maze walls',
      rightLabel: 'Pellets, fruit, Pac-Man & ghosts',
    },
    recordLabel: 'Best score',
    metricLabel: 'Level reached',
    defaultSettings: {
      difficulty: 'easy',
      maze: 'classic',
      scale: 'normal',
      sound: true,
      channels: 'wallsLeft',
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Difficulty',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'maze',
        label: 'Maze',
        type: 'segment',
        options: [
          { label: 'Classic', value: 'classic' },
          { label: 'Lanes', value: 'lanes' },
          { label: 'Isles', value: 'islands' },
          { label: 'Coil', value: 'coil' },
          { label: 'Keep', value: 'keep' },
        ],
      },
      {
        key: 'scale',
        label: 'Scale',
        type: 'segment',
        options: [
          { label: 'Small', value: 'small' },
          { label: 'Normal', value: 'normal' },
          { label: 'Large', value: 'large' },
        ],
      },
      {
        key: 'channels',
        label: 'Colours',
        type: 'segment',
        options: [
          { label: 'Walls L · Actors R', value: 'wallsLeft' },
          { label: 'Walls R · Actors L', value: 'wallsRight' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'breaker',
    title: 'Brick Breaker',
    shortTitle: 'Breaker',
    tag: 'DEPTH & REFLEX',
    category: 'reflex',
    blurb: '15 stages, mixed-eye HP bricks with borders, and Pong-style power orbs (including colour swap).',
    dichopticSplit: {
      leftLabel: 'Paddle & walls (swappable)',
      rightLabel: 'Mixed bricks, balls & orbs',
    },
    recordLabel: 'Best score',
    metricLabel: 'Bricks cleared',
    defaultSettings: {
      difficulty: 'easy',
      sound: true,
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Level',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'snake',
    title: 'Snake Fusion',
    shortTitle: 'Snake',
    tag: 'TRACKING & STRATEGY',
    category: 'spatial',
    blurb: 'Normal, golden & shrink food, combo scoring, and obstacles on the snake eye.',
    dichopticSplit: {
      leftLabel: 'Grid',
      rightLabel: 'Snake, food & hazards',
    },
    recordLabel: 'Best length',
    metricLabel: 'Food eaten',
    defaultSettings: {
      difficulty: 'easy',
      boardSize: 'large',
      wrap: false,
      sound: true,
      channels: 'gridLeft',
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Difficulty',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'boardSize',
        label: 'Board size',
        type: 'segment',
        options: [
          { label: 'Small', value: 'small' },
          { label: 'Large', value: 'large' },
          { label: 'Extra large', value: 'extraLarge' },
        ],
      },
      {
        key: 'channels',
        label: 'Colours',
        type: 'segment',
        options: [
          { label: 'Grid L · Snake R', value: 'gridLeft' },
          { label: 'Grid R · Snake L', value: 'gridRight' },
        ],
      },
      {
        key: 'wrap',
        label: 'Wrap edges',
        type: 'toggle',
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'tetris',
    title: 'Tetris',
    shortTitle: 'Tetris',
    tag: 'SPATIAL & TIMING',
    category: 'spatial',
    blurb: 'Classic stack-and-clear — each tetromino has its own dichoptic colour (eye + strength).',
    dichopticSplit: {
      leftLabel: 'I / T / Z / L (or flipped)',
      rightLabel: 'O / S / J (or flipped)',
    },
    recordLabel: 'Best score',
    metricLabel: 'Lines cleared',
    defaultSettings: {
      difficulty: 'easy',
      sound: true,
      gridEye: 'left',
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Level',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'gridEye',
        label: 'Grid colour',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'invaders',
    title: 'Space Invaders',
    shortTitle: 'Invaders',
    tag: 'TRACKING & AIM',
    category: 'reflex',
    blurb: 'Shoot a mixed-eye alien wave; focus targets pulse on the opposite eye for priority kills.',
    dichopticSplit: {
      leftLabel: 'Ship & shots',
      rightLabel: 'Mixed aliens + focus outline',
    },
    recordLabel: 'Best score',
    metricLabel: 'Aliens destroyed',
    defaultSettings: {
      difficulty: 'easy',
      sound: true,
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Level',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    shortTitle: 'Asteroids',
    tag: 'PHYSICS & FUSION',
    category: 'spatial',
    blurb: 'Rotate, thrust, and blast mixed-eye rocks — size and border weight differ; opacity follows glass settings.',
    dichopticSplit: {
      leftLabel: 'Ship & shots (chosen eye)',
      rightLabel: 'Mixed asteroids',
    },
    recordLabel: 'Best score',
    metricLabel: 'Rocks destroyed',
    defaultSettings: {
      difficulty: 'easy',
      sound: true,
      shipEye: 'left',
    },
    fields: [
      {
        key: 'difficulty',
        label: 'Level',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Hard', value: 'hard' },
          { label: 'Extra hard', value: 'extraHard' },
        ],
      },
      {
        key: 'sound',
        label: 'Game sounds',
        type: 'toggle',
      },
      {
        key: 'shipEye',
        label: 'Ship eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
    ],
  },
];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}

export function gamesByCategory(category: GameCategory) {
  if (category === 'all') return GAMES;
  return GAMES.filter((g) => g.category === category);
}
