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
      paddleEye: 'left',
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
        key: 'paddleEye',
        label: 'Paddle eye (start)',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
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
      speed: 1,
      gridSize: 16,
      wrap: false,
      sound: true,
      gridEye: 'left',
      snakeEye: 'right',
    },
    fields: [
      {
        key: 'speed',
        label: 'Speed',
        type: 'slider',
        min: 0.6,
        max: 1.8,
        step: 0.1,
      },
      {
        key: 'gridSize',
        label: 'Grid size',
        type: 'slider',
        min: 12,
        max: 20,
        step: 2,
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
      {
        key: 'gridEye',
        label: 'Grid eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      {
        key: 'snakeEye',
        label: 'Snake eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
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
      pieceEye: 'left',
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
        key: 'pieceEye',
        label: 'Falling piece eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
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
      leftLabel: 'Ship & shots (chosen eye)',
      rightLabel: 'Mixed aliens + focus outline',
    },
    recordLabel: 'Best score',
    metricLabel: 'Aliens destroyed',
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
