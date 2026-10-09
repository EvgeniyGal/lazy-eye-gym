import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AppPrefs } from '@/src/anaglyph/types';

const CHANNEL_ID = 'lazyeye-reminders';

type NotificationsModule = typeof import('expo-notifications');

function isExpoGo() {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web' || isExpoGo()) {
    return null;
  }
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

function atHourMinute(base: Date, hour: number, minute: number) {
  const d = new Date(base);
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function nextEvery2DayDates(hour: number, minute: number, count: number) {
  const now = new Date();
  let cursor = atHourMinute(now, hour, minute);
  if (cursor.getTime() <= now.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const dates: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i * 2);
    dates.push(d);
  }
  return dates;
}

export async function syncReminders(prefs: AppPrefs): Promise<{ ok: boolean; message?: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, message: 'Reminders are available on iOS and Android.' };
  }

  if (isExpoGo()) {
    // expo-notifications throws on import in Expo Go (SDK 53+). Prefs still save.
    return {
      ok: false,
      message:
        'Reminder preferences are saved. Scheduling needs a development build (not available in Expo Go).',
    };
  }

  const Notifications = await loadNotifications();
  if (!Notifications) {
    return {
      ok: false,
      message: 'Notifications are unavailable on this install. Use a development build.',
    };
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Training reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith('lazyeye-reminder'))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );

  if (!prefs.remindersEnabled) {
    return { ok: true };
  }

  const current = await Notifications.getPermissionsAsync();
  let allowed =
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!allowed) {
    const asked = await Notifications.requestPermissionsAsync();
    allowed =
      asked.granted ||
      asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (!allowed) {
    return { ok: false, message: 'Notification permission was denied.' };
  }

  const hour = Math.min(23, Math.max(0, Math.round(prefs.reminderHour)));
  const minute = Math.min(59, Math.max(0, Math.round(prefs.reminderMinute)));
  const content = {
    title: 'Time for LazyEye Gym?',
    body: 'A short dichoptic session when you are ready — play any game you like.',
    sound: true as const,
    ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
  };

  try {
    if (prefs.reminderFrequency === 'daily') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'lazyeye-reminder-daily',
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    } else if (prefs.reminderFrequency === 'weekly') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'lazyeye-reminder-weekly',
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 1,
          hour,
          minute,
        },
      });
    } else if (prefs.reminderFrequency === 'weekdays') {
      for (let weekday = 2; weekday <= 6; weekday += 1) {
        await Notifications.scheduleNotificationAsync({
          identifier: `lazyeye-reminder-weekday-${weekday}`,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour,
            minute,
          },
        });
      }
    } else {
      const dates = nextEvery2DayDates(hour, minute, 8);
      await Promise.all(
        dates.map((date, index) =>
          Notifications.scheduleNotificationAsync({
            identifier: `lazyeye-reminder-every2days-${index}`,
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date,
            },
          }),
        ),
      );
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not schedule reminder.';
    return { ok: false, message };
  }
}
