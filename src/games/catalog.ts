import type { EyeSide } from '@/src/anaglyph/color';

export type GameId = '2048' | 'pong' | 'maze' | 'breaker' | 'snake';

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
    title: '2048 Dichoptic',
    shortTitle: '2048',
    tag: 'STRATEGY & FUSION',
    category: 'spatial',
    blurb: 'Each number tile is randomly red or cyan — fuse both eyes to track merges.',
    dichopticSplit: {
      leftLabel: 'Random red tiles',
      rightLabel: 'Random cyan tiles',
    },
    recordLabel: 'Best score',
    metricLabel: 'Best tile',
    defaultSettings: {
      difficulty: 'medium',
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
    ],
  },
  {
    id: 'pong',
    title: 'Arcade Pong',
    shortTitle: 'Pong',
    tag: 'DYNAMIC TRACKING',
    category: 'reflex',
    blurb: 'Player paddle vs ball & rival — fuse both to win rallies.',
    dichopticSplit: {
      leftLabel: 'Player paddle',
      rightLabel: 'Ball & AI paddle',
    },
    recordLabel: 'Best score',
    metricLabel: 'Longest rally',
    defaultSettings: {
      speed: 1,
      paddleSize: 1,
      aiDifficulty: 'medium',
      paddleEye: 'left',
      ballEye: 'right',
    },
    fields: [
      {
        key: 'speed',
        label: 'Ball speed',
        type: 'slider',
        min: 0.6,
        max: 1.8,
        step: 0.1,
      },
      {
        key: 'paddleSize',
        label: 'Paddle size',
        type: 'slider',
        min: 0.7,
        max: 1.4,
        step: 0.1,
      },
      {
        key: 'aiDifficulty',
        label: 'AI difficulty',
        type: 'segment',
        options: [
          { label: 'Easy', value: 'easy' },
          { label: 'Medium', value: 'medium' },
          { label: 'Hard', value: 'hard' },
        ],
      },
      {
        key: 'paddleEye',
        label: 'Paddle eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      {
        key: 'ballEye',
        label: 'Ball / AI eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
    ],
  },
  {
    id: 'maze',
    title: 'Maze Chase',
    shortTitle: 'Maze',
    tag: 'SPATIAL PURSUIT',
    category: 'spatial',
    blurb: 'Pac-Man style maze: walls in one eye, dots & ghosts in the other.',
    dichopticSplit: {
      leftLabel: 'Maze walls',
      rightLabel: 'Dots, player & ghosts',
    },
    recordLabel: 'Best score',
    metricLabel: 'Mazes cleared',
    defaultSettings: {
      speed: 1,
      lives: 3,
      wallEye: 'left',
      actorEye: 'right',
    },
    fields: [
      {
        key: 'speed',
        label: 'Speed',
        type: 'slider',
        min: 0.7,
        max: 1.6,
        step: 0.1,
      },
      {
        key: 'lives',
        label: 'Lives',
        type: 'slider',
        min: 1,
        max: 5,
        step: 1,
      },
      {
        key: 'wallEye',
        label: 'Walls eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      {
        key: 'actorEye',
        label: 'Actors eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
    ],
  },
  {
    id: 'breaker',
    title: 'Brick Breaker',
    shortTitle: 'Breaker',
    tag: 'DEPTH & REFLEX',
    category: 'reflex',
    blurb: 'Paddle & walls vs ball & bricks for depth fusion drills.',
    dichopticSplit: {
      leftLabel: 'Paddle & walls',
      rightLabel: 'Ball & bricks',
    },
    recordLabel: 'Best score',
    metricLabel: 'Bricks cleared',
    defaultSettings: {
      rows: 4,
      ballSpeed: 1,
      paddleWidth: 1,
      paddleEye: 'left',
      brickEye: 'right',
    },
    fields: [
      {
        key: 'rows',
        label: 'Brick rows',
        type: 'slider',
        min: 3,
        max: 6,
        step: 1,
      },
      {
        key: 'ballSpeed',
        label: 'Ball speed',
        type: 'slider',
        min: 0.7,
        max: 1.7,
        step: 0.1,
      },
      {
        key: 'paddleWidth',
        label: 'Paddle width',
        type: 'slider',
        min: 0.7,
        max: 1.4,
        step: 0.1,
      },
      {
        key: 'paddleEye',
        label: 'Paddle eye',
        type: 'eye',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ],
      },
      {
        key: 'brickEye',
        label: 'Ball / bricks eye',
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
    blurb: 'Grid for one eye; snake body & food for the other.',
    dichopticSplit: {
      leftLabel: 'Grid',
      rightLabel: 'Snake & food',
    },
    recordLabel: 'Best length',
    metricLabel: 'Food eaten',
    defaultSettings: {
      speed: 1,
      gridSize: 16,
      wrap: false,
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
];

export function getGame(id: string): GameDefinition | undefined {
  return GAMES.find((g) => g.id === id);
}

export function gamesByCategory(category: GameCategory) {
  if (category === 'all') return GAMES;
  return GAMES.filter((g) => g.category === category);
}
