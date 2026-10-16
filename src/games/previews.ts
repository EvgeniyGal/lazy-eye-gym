import type { ImageSourcePropType } from 'react-native';

import type { GameId } from './catalog';

/** Local FLUX-generated thumbnails for the Games hub. */
export const GAME_PREVIEWS: Record<GameId, ImageSourcePropType> = {
  '2048': require('../../assets/images/games/2048.png'),
  pong: require('../../assets/images/games/pong.png'),
  maze: require('../../assets/images/games/maze.png'),
  breaker: require('../../assets/images/games/breaker.png'),
  snake: require('../../assets/images/games/snake.png'),
  tetris: require('../../assets/images/games/tetris.png'),
  invaders: require('../../assets/images/games/invaders.png'),
  asteroids: require('../../assets/images/games/asteroids.png'),
};
