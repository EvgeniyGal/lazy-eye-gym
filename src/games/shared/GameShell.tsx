import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import type { NavigationAction } from 'expo-router/build/react-navigation/routers';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { insertSession } from '@/src/db/sessions';
import type { GameId } from '@/src/games/catalog';
import { useT } from '@/src/i18n/I18nProvider';
import { getLocalizedGame } from '@/src/i18n/localizeCatalog';
import { useAppStore } from '@/src/state/AppStore';
import { useColors } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/tokens';
import type { GameResult } from '../types';
import { AsteroidsGame } from '../asteroids/AsteroidsGame';
import { BreakerGame } from '../breaker/BreakerGame';
import { CandyGame } from '../candy/CandyGame';
import { InvadersGame } from '../invaders/InvadersGame';
import { MazeGame } from '../maze/MazeGame';
import { MinesweeperGame } from '../minesweeper/MinesweeperGame';
import { PongGame } from '../pong/PongGame';
import { SnakeGame } from '../snake/SnakeGame';
import { SolitaireGame } from '../solitaire/SolitaireGame';
import { SudokuGame } from '../sudoku/SudokuGame';
import { TetrisGame } from '../tetris/TetrisGame';
import { TwentyFortyEightGame } from '../twenty48/TwentyFortyEightGame';

export function GameShell({ gameId }: { gameId: GameId }) {
  const colors = useColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
        },
        hud: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        hudCenter: {
          flex: 1,
          alignItems: 'center',
        },
        hudTitle: {
          fontWeight: '700',
          fontSize: 16,
        },
        hudMeta: {
          fontSize: 12,
          marginTop: 2,
        },
        canvasWrap: {
          flex: 1,
        },
        modalRoot: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
          gap: spacing.md,
        },
        overlayTitle: {
          fontSize: 24,
          fontWeight: '800',
        },
        overlayMeta: {
          fontSize: 14,
          textAlign: 'center',
        },
        primaryBtn: {
          marginTop: spacing.md,
          backgroundColor: colors.primary,
          borderRadius: 999,
          paddingHorizontal: 28,
          paddingVertical: 14,
          minWidth: 220,
          alignItems: 'center',
        },
        primaryBtnText: {
          color: colors.onPrimary,
          fontWeight: '800',
        },
        secondaryBtn: {
          borderRadius: 999,
          borderWidth: 1.5,
          paddingHorizontal: 28,
          paddingVertical: 14,
          minWidth: 220,
          alignItems: 'center',
        },
        secondaryBtnText: {
          fontWeight: '700',
        },
      }),
    [colors],
  );
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { palette, activeProfile, getGameSettings, setGameSettings, prefs } = useAppStore();
  const { t } = useT();
  const game = useMemo(() => getLocalizedGame(gameId, t)!, [gameId, t]);
  const settings = getGameSettings(gameId);
  const soundOn = Boolean(settings.sound ?? true) && prefs.soundEffects;

  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [metric, setMetric] = useState(0);
  const [ended, setEnded] = useState<GameResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [allowLeave, setAllowLeave] = useState(false);
  const startedAt = useRef(new Date().toISOString());
  const startMs = useRef(Date.now());
  const savedRef = useRef(false);
  const pendingLeaveAction = useRef<NavigationAction | null>(null);
  const pausedBeforeLeave = useRef(false);

  const boardBg = palette.background;
  const opticalBg = activeProfile.background;
  const onLight = opticalBg === 'white';
  // HUD/modal chrome follows optical board contrast — never app light/dark theme tokens.
  const hudFg = onLight ? '#111111' : palette.neutral;
  const hudMuted = onLight ? '#444444' : 'rgba(255,255,255,0.65)';
  const hudBtnBg = onLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const overlayBg = onLight
    ? 'rgba(244,244,244,0.92)'
    : opticalBg === 'gray'
      ? 'rgba(42,42,42,0.92)'
      : 'rgba(6,14,32,0.9)';
  const secondaryBorder = onLight ? '#333333' : 'rgba(255,255,255,0.35)';
  const modalPadStyle = {
    backgroundColor: overlayBg,
    paddingBottom: spacing.xl + insets.bottom,
    paddingTop: spacing.xl + insets.top,
  };

  const canvasH = Math.max(280, height - insets.top - insets.bottom - 120);

  const onScore = useCallback((s: number, m: number) => {
    setScore(s);
    setMetric(m);
  }, []);

  const onGameOver = useCallback(
    async (result: GameResult) => {
      setEnded(result);
      setPaused(true);
      setLeaveOpen(false);
      pendingLeaveAction.current = null;
      if (savedRef.current) return;
      savedRef.current = true;
      await insertSession({
        gameId,
        startedAt: startedAt.current,
        endedAt: new Date().toISOString(),
        score: result.score,
        bestMetric: result.bestMetric,
        durationSec: result.durationSec,
        settingsJson: JSON.stringify(settings),
        profileSnapshotJson: JSON.stringify({
          profile: activeProfile,
        }),
      });
    },
    [activeProfile, gameId, settings],
  );

  const startFreshRun = useCallback(() => {
    savedRef.current = false;
    startedAt.current = new Date().toISOString();
    startMs.current = Date.now();
    setEnded(null);
    setPaused(false);
    setScore(0);
    setMetric(0);
    setLeaveOpen(false);
    setAllowLeave(false);
    pendingLeaveAction.current = null;
    setRunId((id) => id + 1);
  }, []);

  useEffect(() => {
    savedRef.current = false;
    startedAt.current = new Date().toISOString();
    startMs.current = Date.now();
    setEnded(null);
    setPaused(false);
    setScore(0);
    setMetric(0);
    setLeaveOpen(false);
    setAllowLeave(false);
    pendingLeaveAction.current = null;
    setRunId((id) => id + 1);
  }, [gameId]);

  const openLeavePrompt = useCallback(() => {
    if (ended || leaveOpen) return;
    pausedBeforeLeave.current = paused;
    setPaused(true);
    setLeaveOpen(true);
  }, [ended, leaveOpen, paused]);

  usePreventRemove(ended === null && !allowLeave, ({ data }) => {
    pendingLeaveAction.current = data.action;
    openLeavePrompt();
  });

  useEffect(() => {
    if (!allowLeave) return;
    const action = pendingLeaveAction.current;
    pendingLeaveAction.current = null;
    if (action) {
      navigation.dispatch(action);
    } else {
      router.back();
    }
  }, [allowLeave, navigation, router]);

  const stayInGame = useCallback(() => {
    setLeaveOpen(false);
    pendingLeaveAction.current = null;
    setPaused(pausedBeforeLeave.current);
  }, []);

  const leaveGame = useCallback(() => {
    setLeaveOpen(false);
    setAllowLeave(true);
  }, []);

  const restartFromLeave = useCallback(() => {
    pendingLeaveAction.current = null;
    startFreshRun();
  }, [startFreshRun]);

  const Scene = useMemo(() => {
    switch (gameId) {
      case '2048':
        return TwentyFortyEightGame;
      case 'pong':
        return PongGame;
      case 'maze':
        return MazeGame;
      case 'breaker':
        return BreakerGame;
      case 'snake':
        return SnakeGame;
      case 'tetris':
        return TetrisGame;
      case 'invaders':
        return InvadersGame;
      case 'asteroids':
        return AsteroidsGame;
      case 'minesweeper':
        return MinesweeperGame;
      case 'sudoku':
        return SudokuGame;
      case 'solitaire':
        return SolitaireGame;
      case 'candy':
        return CandyGame;
      default:
        return TwentyFortyEightGame;
    }
  }, [gameId]);

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          backgroundColor: boardBg,
        },
      ]}
    >
      <View style={styles.hud}>
        <Pressable
          onPress={() => {
            if (ended) {
              router.back();
              return;
            }
            openLeavePrompt();
          }}
          style={[styles.iconBtn, { backgroundColor: hudBtnBg }]}
        >
          <Ionicons name="close" size={22} color={hudFg} />
        </Pressable>
        <View style={styles.hudCenter}>
          <Text style={[styles.hudTitle, { color: hudFg }]}>{game.shortTitle}</Text>
          <Text style={[styles.hudMeta, { color: hudMuted }]}>
            {t('gameShell.scoreLine', { score, metricLabel: game.metricLabel, metric })}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            setGameSettings(gameId, {
              ...settings,
              sound: !(settings.sound ?? true),
            })
          }
          style={[styles.iconBtn, { backgroundColor: hudBtnBg, marginRight: 8 }]}
          accessibilityLabel={soundOn ? t('gameShell.mute') : t('gameShell.unmute')}
        >
          <Ionicons
            name={Boolean(settings.sound ?? true) ? 'volume-high' : 'volume-mute'}
            size={20}
            color={hudFg}
          />
        </Pressable>
        <Pressable
          onPress={() => {
            if (leaveOpen || ended) return;
            setPaused((p) => !p);
          }}
          style={[styles.iconBtn, { backgroundColor: hudBtnBg }]}
        >
          <Ionicons name={paused && !ended && !leaveOpen ? 'play' : 'pause'} size={20} color={hudFg} />
        </Pressable>
      </View>

      <View style={[styles.canvasWrap, { height: canvasH, backgroundColor: boardBg }]}>
        <Scene
          key={runId}
          gameId={gameId}
          width={width}
          height={canvasH}
          palette={palette}
          settings={settings}
          paused={paused || !!ended || leaveOpen}
          onScore={onScore}
          onGameOver={onGameOver}
        />
      </View>

      {/* Modal sits above Skia canvases — absolute sibling overlays can end up under native Skia. */}
      <Modal visible={leaveOpen && !ended} transparent animationType="fade" onRequestClose={stayInGame}>
        <View style={[styles.modalRoot, modalPadStyle]}>
          <Text style={[styles.overlayTitle, { color: hudFg }]}>{t('gameShell.leaveTitle')}</Text>
          <Text style={[styles.overlayMeta, { color: hudMuted }]}>{t('gameShell.leaveMessage')}</Text>
          <Pressable style={styles.primaryBtn} onPress={stayInGame}>
            <Text style={styles.primaryBtnText}>{t('gameShell.stay')}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: secondaryBorder }]}
            onPress={restartFromLeave}
          >
            <Text style={[styles.secondaryBtnText, { color: hudFg }]}>{t('gameShell.startAgain')}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: secondaryBorder }]}
            onPress={leaveGame}
          >
            <Text style={[styles.secondaryBtnText, { color: hudFg }]}>{t('gameShell.leave')}</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={!!ended} transparent animationType="fade" onRequestClose={() => router.back()}>
        <View style={[styles.modalRoot, modalPadStyle]}>
          <Text style={[styles.overlayTitle, { color: hudFg }]}>{t('gameShell.sessionComplete')}</Text>
          {ended ? (
            <Text style={[styles.overlayMeta, { color: hudMuted }]}>
              {t('gameShell.overlayMeta', {
                score: ended.score,
                metricLabel: game.metricLabel,
                metric: ended.bestMetric,
                duration: ended.durationSec,
              })}
            </Text>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={startFreshRun}>
            <Text style={styles.primaryBtnText}>{t('gameShell.startAgain')}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: secondaryBorder }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryBtnText, { color: hudFg }]}>{t('gameShell.backToSetup')}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
