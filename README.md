# LazyEye Gym

Fully local React Native (Expo) MVP for dichoptic amblyopia training games on Android and iOS.

## Features

- Anaglyph glasses calibration (ported from [landing-page](https://github.com/EvgeniyGal/landing-page) logic)
- 5 Skia-powered dichoptic games: 2048, Pong, Maze Chase, Brick Breaker, Snake
- Per-game setup + local session history/records
- Offline-only (AsyncStorage + SQLite)

## Run

```bash
npm install
npm start
```

Then open in Expo Go / simulator (iOS or Android).

## Notes

- Wear red/cyan anaglyph glasses for Lazy-eye (3D ON) mode.
- This is a casual training tool, not a certified medical device.
