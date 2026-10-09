import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AppPrefs } from '@/src/anaglyph/types';

const CHANNEL_ID = 'lazyeye-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Training reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  void Device.isDevice;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return (
    asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function cancelReminderNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith('lazyeye-reminder'))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
}

function content() {
  return {
    title: 'Time for LazyEye Gym?',
    body: 'A short dichoptic session when you are ready — play any game you like.',
    sound: true as const,
    ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
  };
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
  // Align so gaps are 2 days from the first upcoming slot
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

  await ensureAndroidChannel();
  await cancelReminderNotifications();

  if (!prefs.remindersEnabled) {
    return { ok: true };
  }

  const allowed = await requestPermission();
  if (!allowed) {
    return { ok: false, message: 'Notification permission was denied.' };
  }

  const hour = Math.min(23, Math.max(0, Math.round(prefs.reminderHour)));
  const minute = Math.min(59, Math.max(0, Math.round(prefs.reminderMinute)));

  try {
    if (prefs.reminderFrequency === 'daily') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'lazyeye-reminder-daily',
        content: content(),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    } else if (prefs.reminderFrequency === 'weekly') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'lazyeye-reminder-weekly',
        content: content(),
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
          content: content(),
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
            content: content(),
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
