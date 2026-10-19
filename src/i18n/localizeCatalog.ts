import type { GameCategory, GameDefinition, GameId, GameSettingField } from '@/src/games/catalog';
import { GAMES, getGame, gamesByCategory } from '@/src/games/catalog';

import type { TranslateOptions } from './i18n';

type TFn = (key: string, options?: TranslateOptions) => string;

function optionLabel(
  t: TFn,
  gameId: GameId,
  fieldKey: string,
  value: string,
  englishFallback: string,
): string {
  switch (value) {
    case 'easy':
      return t('common.easy');
    case 'medium':
      return t('common.medium');
    case 'hard':
      return t('common.hard');
    case 'extraHard':
      return t('common.extraHard');
    case 'small':
      return t('common.small');
    case 'normal':
      return t('common.normal');
    case 'large':
      return t('common.large');
    case 'extraLarge':
      return t('common.extraLarge');
    case 'left':
      return englishFallback.includes('/') ? t('common.leftRed') : t('common.left');
    case 'right':
      return englishFallback.includes('/') ? t('common.rightCyan') : t('common.right');
    default: {
      const specific = `catalog.${gameId}.option_${fieldKey}_${value}`;
      const translated = t(specific);
      if (translated && translated !== specific && !translated.includes('missing')) {
        return translated;
      }
      return englishFallback;
    }
  }
}

function localizeField(gameId: GameId, field: GameSettingField, t: TFn): GameSettingField {
  const label = t(`catalog.${gameId}.field_${field.key}`);
  if (field.type === 'segment') {
    return {
      ...field,
      label,
      options: field.options.map((opt) => ({
        value: opt.value,
        label: optionLabel(t, gameId, field.key, opt.value, opt.label),
      })),
    };
  }
  if (field.type === 'eye') {
    return {
      ...field,
      label,
      options: field.options.map((opt) => ({
        value: opt.value,
        label: optionLabel(t, gameId, field.key, opt.value, opt.label),
      })),
    };
  }
  return { ...field, label };
}

export function localizeGame(game: GameDefinition, t: TFn): GameDefinition {
  const id = game.id;
  return {
    ...game,
    title: t(`catalog.${id}.title`),
    shortTitle: t(`catalog.${id}.shortTitle`),
    tag: t(`catalog.${id}.tag`),
    blurb: t(`catalog.${id}.blurb`),
    dichopticSplit: {
      leftLabel: t(`catalog.${id}.leftLabel`),
      rightLabel: t(`catalog.${id}.rightLabel`),
    },
    recordLabel: t(`catalog.${id}.recordLabel`),
    metricLabel: t(`catalog.${id}.metricLabel`),
    fields: game.fields.map((field) => localizeField(id, field, t)),
  };
}

export function getLocalizedGame(id: string, t: TFn): GameDefinition | undefined {
  const game = getGame(id);
  return game ? localizeGame(game, t) : undefined;
}

export function getLocalizedGames(t: TFn): GameDefinition[] {
  return GAMES.map((game) => localizeGame(game, t));
}

export function getLocalizedGamesByCategory(category: GameCategory, t: TFn): GameDefinition[] {
  return gamesByCategory(category).map((game) => localizeGame(game, t));
}
