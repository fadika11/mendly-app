import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const POSITIVE_NOTIFICATION_IDS_START = 5000;
const POSITIVE_CHANNEL_ID = "positive-notifications";

const POSITIVE_MESSAGES = [
  "You are doing better than you think.",
  "One small step today is still progress.",
  "Your feelings matter.",
  "Take a deep breath. You’ve got this.",
  "Be kind to yourself today.",
  "Healing is not linear, and that is okay.",
  "You handled hard days before. You can handle this one too.",
  "Pause, breathe, and begin again.",
  "Small wins still count.",
  "You deserve peace and patience.",
  "Your effort matters, even if it feels small.",
  "You are allowed to rest.",
  "Every day is a new chance to reset.",
  "You are stronger than this moment.",
  "Your mind deserves kindness too.",
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

async function ensureNativeReady() {
  if (!Capacitor.isNativePlatform()) return false;

  const perm = await LocalNotifications.requestPermissions();

  if (perm.display !== "granted") {
    throw new Error("Notifications permission not granted");
  }

  await LocalNotifications.createChannel({
    id: POSITIVE_CHANNEL_ID,
    name: "Positive Notifications",
    description: "Encouraging reminders from Mendly",
    importance: 4,
    visibility: 1,
    sound: undefined,
    vibration: true,
    lights: true,
  });

  return true;
}

export async function cancelPositiveNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();

  const ids = pending.notifications
    .filter(
      (n) =>
        n.id >= POSITIVE_NOTIFICATION_IDS_START &&
        n.id < POSITIVE_NOTIFICATION_IDS_START + 1000
    )
    .map((n) => ({ id: n.id }));

  if (ids.length > 0) {
    await LocalNotifications.cancel({ notifications: ids });
  }
}

export async function schedulePositiveNotifications(
  frequencyMinutes: number,
  enabled: boolean
) {
  if (!enabled) {
    await cancelPositiveNotifications();
    return;
  }

  const ok = await ensureNativeReady();
  if (!ok) return;

  await cancelPositiveNotifications();

  const messages = shuffle(POSITIVE_MESSAGES);

  const now = new Date();
  const notifications = [];

  for (let i = 0; i < 30; i++) {
    const when = new Date(now.getTime() + frequencyMinutes * 60 * 1000 * (i + 1));
    const body = messages[i % messages.length];

    notifications.push({
      id: POSITIVE_NOTIFICATION_IDS_START + i,
      title: "Mendly",
      body,
      schedule: {
        at: when,
      },
      channelId: POSITIVE_CHANNEL_ID,
      smallIcon: "ic_stat_icon_config_sample",
      extra: {
        type: "positive",
        index: i,
      },
    });
  }

  await LocalNotifications.schedule({ notifications });
}

export async function sendTestPositiveNotification() {
  const ok = await ensureNativeReady();
  if (!ok) return;

  const body =
    POSITIVE_MESSAGES[Math.floor(Math.random() * POSITIVE_MESSAGES.length)];

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 900001,
        title: "Mendly Notification",
        body,
        schedule: {
          at: new Date(Date.now() + 2000),
        },
        channelId: POSITIVE_CHANNEL_ID,

        smallIcon: "ic_launcher_foreground",
        largeIcon: "mendly_logo",
        iconColor: "#6BA7E6",

        extra: {
          type: "positive",
          test: true,
        },
      },
    ],
  });
}