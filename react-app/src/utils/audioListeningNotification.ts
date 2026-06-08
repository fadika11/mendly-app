// react-app/src/utils/audioListeningNotification.ts
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const AUDIO_LISTENING_NOTIFICATION_ID = 700001;
export const AUDIO_LISTENING_CHANNEL_ID = "mendly_audio_listening";

export async function ensureAudioNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  const current = await LocalNotifications.checkPermissions();

  if (current.display === "granted") {
    return true;
  }

  const requested = await LocalNotifications.requestPermissions();

  return requested.display === "granted";
}

export async function createAudioListeningChannel() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await LocalNotifications.createChannel({
      id: AUDIO_LISTENING_CHANNEL_ID,
      name: "Mendly audio",
      description: "Shows when Mendly is listening for audio mood analysis.",
      importance: 3,
      visibility: 1,
      sound: undefined,
      vibration: false,
      lights: false,
    });
  } catch (err) {
    console.warn("Could not create audio notification channel:", err);
  }
}

export async function showAudioListeningNotification() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const allowed = await ensureAudioNotificationPermission();

  if (!allowed) {
    console.warn("Notification permission was not granted.");
    return;
  }

  await createAudioListeningChannel();

  await LocalNotifications.cancel({
    notifications: [{ id: AUDIO_LISTENING_NOTIFICATION_ID }],
  });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: AUDIO_LISTENING_NOTIFICATION_ID,
        title: "Mendly is listening",
        body: "Tap to return to Mendly and stop the audio check-in.",
        largeBody:
          "Mendly is listening for your audio mood check-in. Tap to return to the app.",
        schedule: { at: new Date(Date.now() + 100) },
        channelId: AUDIO_LISTENING_CHANNEL_ID,

        smallIcon: "ic_launcher_foreground",
        largeIcon: "mendly_logo",
        iconColor: "#6BA7E6",

        ongoing: true,
        autoCancel: false,

        extra: {
          type: "audio-listening",
          routeWhenLoggedIn: "/journey",
          routeWhenLoggedOut: "/login",
        },
      },
    ],
  });
}

export async function hideAudioListeningNotification() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  await LocalNotifications.cancel({
    notifications: [{ id: AUDIO_LISTENING_NOTIFICATION_ID }],
  });
}