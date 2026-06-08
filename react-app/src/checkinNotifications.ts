import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function setupDailyCheckinNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  const permission = await LocalNotifications.requestPermissions();

  if (permission.display !== "granted") {
    console.log("Notification permission not granted");
    return;
  }

  await LocalNotifications.cancel({
    notifications: [
      { id: 301 },
      { id: 302 },
      { id: 303 },
    ],
  });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 301,
        title: "Mendly check-in",
        body: "Good morning. How are you feeling today? Tap to do your daily check-in.",
        schedule: {
          on: {
            hour: 9,
            minute: 0,
          },
          repeats: true,
        },

        smallIcon: "ic_launcher_foreground",
        largeIcon: "mendly_logo",
        iconColor: "#6BA7E6",

        extra: {
          type: "checkin",
        },
      },
      {
        id: 302,
        title: "Mendly check-in",
        body: "Take a short moment for yourself. Tap to update your mood.",
        schedule: {
          on: {
            hour: 14,
            minute: 0,
          },
          repeats: true,
        },

        smallIcon: "ic_launcher_foreground",
        largeIcon: "mendly_logo",
        iconColor: "#6BA7E6",

        extra: {
          type: "checkin",
        },
      },
      {
        id: 303,
        title: "Mendly check-in",
        body: "Evening check-in: how was your day? Tap to record your mood.",
        schedule: {
          on: {
            hour: 20,
            minute: 0,
          },
          repeats: true,
        },

        smallIcon: "ic_launcher_foreground",
        largeIcon: "mendly_logo",
        iconColor: "#6BA7E6",

        extra: {
          type: "checkin",
        },
      },
    ],
  });

  console.log("Daily check-in notifications scheduled");
}