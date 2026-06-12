// react-app/src/pages/PositiveNotificationsPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import logo from "../assets/mendly-logo.jpg";
import {
  getPositiveNotificationSettings,
  updatePositiveNotificationSettings,
  getMoodSeries,
  type SeriesPoint,
} from "../api/auth";
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";

// ===== platform / api =====
const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

// ===== local notification constants =====
const POSITIVE_CHANNEL_ID = "positive-notifications";
const POSITIVE_NOTIFICATION_IDS_START = 5000;
const POSITIVE_NOTIFICATION_COUNT = 30;

// ===== messages =====
const POSITIVE_MESSAGES: string[] = [
  "Take one slow deep breath. You’re doing better than you think 🌱",
  "Mini reset: roll your shoulders, unclench your jaw, sip some water 💧",
  "You’ve already handled so much. One small step is enough for now 💛",
  "Reminder: you are not alone. Reaching out is a strength, not a weakness 🤝",
  "Pause for 10 seconds and notice 3 things you can see around you 👀",
  "Your feelings matter. Treat yourself today like you would a close friend 💬",
  "Small progress still counts. What’s one tiny win you can do next? ✅",
  "You deserve rest, not just productivity. Take a gentle break when you can 💤",
  "Notice one thing you appreciate about yourself right now ✨",
  "You’re allowed to start again, as many times as you need 🌈",
  "You are stronger than this hard moment.",
  "A quiet step forward still counts.",
  "Protect your peace one choice at a time.",
  "You deserve patience from yourself too.",
  "A calmer moment can start with one breath.",
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRandomPositiveMessage(): string {
  return POSITIVE_MESSAGES[Math.floor(Math.random() * POSITIVE_MESSAGES.length)];
}

async function ensureLocalNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const perm = await LocalNotifications.requestPermissions();
  return perm.display === "granted";
}

async function ensurePositiveChannel() {
  if (!Capacitor.isNativePlatform()) return;

  await LocalNotifications.createChannel({
    id: POSITIVE_CHANNEL_ID,
    name: "Positive Notifications",
    description: "Encouraging reminders from Mendly",
    importance: 4,
    visibility: 1,
    vibration: true,
    lights: true,
  });
}

async function cancelScheduledPositiveNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const pending = await LocalNotifications.getPending();
  const ids = pending.notifications
    .filter(
      (n) =>
        n.id >= POSITIVE_NOTIFICATION_IDS_START &&
        n.id < POSITIVE_NOTIFICATION_IDS_START + POSITIVE_NOTIFICATION_COUNT + 10
    )
    .map((n) => ({ id: n.id }));

  if (ids.length > 0) {
    await LocalNotifications.cancel({ notifications: ids });
  }
}

async function schedulePositiveNotificationsOnDevice(
  frequencyMinutes: number,
  enabled: boolean
) {
  if (!Capacitor.isNativePlatform()) return;

  await cancelScheduledPositiveNotifications();

  if (!enabled) return;

  const granted = await ensureLocalNotificationPermission();
  if (!granted) {
    throw new Error("Notifications permission not granted on this device.");
  }

  await ensurePositiveChannel();

  const messages = shuffle(POSITIVE_MESSAGES);
  const now = Date.now();

  const notifications = Array.from({ length: POSITIVE_NOTIFICATION_COUNT }, (_, i) => {
    const at = new Date(now + frequencyMinutes * 60 * 1000 * (i + 1));
    const body = messages[i % messages.length];

    return {
      id: POSITIVE_NOTIFICATION_IDS_START + i,
      title: "Mendly",
      body,
      schedule: { at },
      channelId: POSITIVE_CHANNEL_ID,
      smallIcon: "ic_launcher_foreground",
      extra: {
        type: "positive",
        index: i,
      },
    };
  });

  await LocalNotifications.schedule({ notifications });
}

async function sendTestPositiveNotificationNow() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Test local notifications work on native Android/iOS only.");
  }

  const granted = await ensureLocalNotificationPermission();
  if (!granted) {
    throw new Error("Notifications permission not granted on this device.");
  }

  await ensurePositiveChannel();

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 900001,
        title: "Mendly Test Notification",
        body: getRandomPositiveMessage(),
        schedule: { at: new Date(Date.now() + 2000) },
        channelId: POSITIVE_CHANNEL_ID,

        smallIcon: "ic_launcher_foreground",
        largeIcon: "mendly_logo",
        iconColor: "#6BA7E6",

        extra: { type: "positive-test" },
      },
    ],
  });
}

const PositiveNotificationsPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const GREEN = "#10B981";

  // ===== STATE (notifications) =====
  const [enabled, setEnabled] = useState<boolean>(true);
  const [frequency, setFrequency] = useState<string>("60");
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // ===== STATE (weekly motivation / mood) =====
  const [moodLoading, setMoodLoading] = useState<boolean>(true);
  const [moodError, setMoodError] = useState<string | null>(null);
  const [series7, setSeries7] = useState<SeriesPoint[] | null>(null);

  function isoDateUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function prettyDayUTC(iso: string) {
    return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  }

  function sortAsc(arr: SeriesPoint[]) {
    return [...arr].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
  }

  function normalizeToEndingToday(
    source: SeriesPoint[] | null,
    length: number
  ): SeriesPoint[] {
    const map = new Map<string, number | null>();
    (source || []).forEach((p) => {
      const key = (p.date || "").slice(0, 10);
      map.set(key, p.avg_score ?? null);
    });

    const out: SeriesPoint[] = [];
    const end = new Date();
    for (let i = length - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
      );
      d.setUTCDate(d.getUTCDate() - i);
      const iso = isoDateUTC(d);
      out.push({
        date: iso,
        avg_score: map.has(iso) ? (map.get(iso) as number | null) : null,
        value: 0,
      });
    }
    return out;
  }

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const data = await getPositiveNotificationSettings();
        if (!isMounted) return;

        setEnabled(data.enabled);
        setFrequency(String(data.frequency_minutes));

        if (Capacitor.isNativePlatform()) {
          await schedulePositiveNotificationsOnDevice(
            data.frequency_minutes,
            data.enabled
          );
        }
      } catch (e: any) {
        console.error("Failed to load positive notification settings:", e);
        if (isMounted) {
          setStatusMsg(
            e?.message || "Could not load your settings, using defaults."
          );
        }
      } finally {
        if (isMounted) setLoadingSettings(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setMoodLoading(true);
        setMoodError(null);
        const raw7 = await getMoodSeries(7);
        const normalized = normalizeToEndingToday(sortAsc(raw7), 7);
        setSeries7(normalized);
      } catch (e: any) {
        console.error("Failed to load mood series:", e);
        setMoodError("Could not load your mood summary right now.");
        setSeries7(null);
      } finally {
        setMoodLoading(false);
      }
    })();
  }, []);

  const { avg7, hasData } = useMemo(() => {
    if (!series7 || !series7.length) {
      return { avg7: null as number | null, hasData: false };
    }
    const vals = series7
      .map((p) => p.avg_score)
      .filter((x): x is number => typeof x === "number");
    if (!vals.length) return { avg7: null, hasData: false };
    const sum = vals.reduce((a, b) => a + b, 0);
    return { avg7: Number((sum / vals.length).toFixed(1)), hasData: true };
  }, [series7]);

  const periodLabel =
    series7 && series7.length
      ? `${prettyDayUTC(series7[0].date)} — ${prettyDayUTC(
          series7[series7.length - 1].date
        )}`
      : null;

  const hasTodayData = useMemo(() => {
    if (!series7 || !series7.length) return false;
    const last = series7[series7.length - 1];
    return last.avg_score != null;
  }, [series7]);

  const buildNotes = () => {
    if (!hasData) {
      return {
        title: "Based on your last week",
        bullets: [
          "You haven’t logged many moods in the last week. That’s totally okay.",
          "Even one small check-in a day can help you notice patterns and take better care of yourself.",
          "Try a quick check-in today and use it as a tiny promise to yourself.",
        ],
        footer:
          "These notes are personal to your mood tracking. They aren’t a diagnosis — just gentle guidance. If things ever feel very heavy, it’s always okay to ask for professional help.",
      };
    }

    if (avg7 === null) {
      return {
        title: "Based on your last week",
        bullets: [
          "Your mood log has been a bit mixed, which is completely normal.",
          "Staying curious about how you feel — without judging it — is already a powerful step.",
          "Keep checking in with yourself; every small moment of awareness adds up over time.",
        ],
        footer:
          "If you ever notice your mood staying low for many days in a row, consider reaching out to someone you trust or to a professional for extra support.",
      };
    }

    if (avg7 <= 3) {
      return {
        title: "It looks like this week has been heavy",
        bullets: [
          "You’ve been carrying a lot emotionally. That says nothing bad about you — it just means you’re human.",
          "Right now, the goal isn’t to fix everything — it’s to make this moment a little more gentle.",
          "Tiny actions count: a short walk, texting one safe person, a few calm breaths, or even just drinking water.",
          "You deserve support. If things feel overwhelming, talking to a professional or someone you trust can really help.",
        ],
        footer:
          "These notes are based on a lower-than-usual mood this week. Please be kind to yourself — you’re doing the best you can with what you have.",
      };
    }

    if (avg7 <= 6) {
      return {
        title: "You’re moving through a mixed week",
        bullets: [
          "Your week seems to have had ups and downs — which is completely normal.",
          "Notice what helped on the better days: people, habits, music, sleep, or small routines.",
          "You can gently add a bit more of what helped, and a bit less of what drained you.",
          "You don’t have to be positive all the time — being honest with yourself is already progress.",
        ],
        footer:
          "These notes are based on an in-between mood week. Keep listening to yourself, and remember that slow, steady care can make a real difference over time.",
      };
    }

    return {
      title: "You’ve had some brighter days this week",
      bullets: [
        "Your recent mood has been on the positive side — that’s wonderful to see.",
        "Notice what has been supporting you: routines, people, boundaries, or choices that protect your energy.",
        "You can treat this as evidence that you’re capable of creating good days for yourself.",
        "Even when tougher days return, these last 7 days show that better moments are possible for you.",
      ],
      footer:
        "These notes are based on a higher 7-day mood average. Keep protecting what helps you feel well — your energy, time, boundaries, and rest all matter.",
    };
  };

  const notes = buildNotes();

  const handleUpdateClick = async () => {
    setSaving(true);
    setStatusMsg(null);

    try {
      const minutes = parseInt(frequency, 10);
      const safeMinutes = isNaN(minutes) ? 60 : minutes;

      await updatePositiveNotificationSettings({
        enabled,
        frequency_minutes: safeMinutes,
      });

      if (Capacitor.isNativePlatform()) {
        await schedulePositiveNotificationsOnDevice(safeMinutes, enabled);
      }

      setStatusMsg("Settings updated ✅");
    } catch (e: any) {
      console.error("Failed to update positive notifications:", e);
      setStatusMsg(e?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestClick = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await sendTestPositiveNotificationNow();
        setStatusMsg("Test notification scheduled ✅ Check your device in 2 seconds.");
        return;
      }

      // optional backend fallback for web/browser testing
      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setStatusMsg("Test notifications on browser need login.");
        return;
      }

      const body = getRandomPositiveMessage();

      const res = await fetch(`${API_BASE}/positive-notifications/send-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("send-test failed:", res.status, text);
        setStatusMsg("Failed to enqueue test notification.");
      } else {
        setStatusMsg("Test notification enqueued ✅ Check your device.");
      }
    } catch (err: any) {
      console.error("Error sending test notification:", err);
      setStatusMsg(err?.message || "Error sending test notification.");
    }
  };

  const screenStyle: React.CSSProperties = {
    height: "100vh",
    width: "100vw",
    margin: 0,
    padding: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
    backgroundColor: BLUE,
    fontFamily:
      '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const phoneStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    maxWidth: "450px",
    margin: "0 auto",
    backgroundColor: BLUE,
    borderRadius: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    position: "relative",
  };

  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 20,
    paddingBottom: 16,
    paddingInline: 16,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    height: "50px",
  };

  const iconBtn: React.CSSProperties = {
    position: "absolute",
    top: 14,
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    backgroundColor: "#3970aaff",
    color: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
  };

  const homeBtnStyle: React.CSSProperties = { ...iconBtn, left: 12 };
  const logoutBtnStyle: React.CSSProperties = { ...iconBtn, right: 12 };

  const bottomSectionStyle: React.CSSProperties = {
    flex: 1,
    padding: "0 0 16px 0",
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
    gap: 16,
    overflowY: "auto",
    overflowX: "hidden",
  };

  const innerContentStyle: React.CSSProperties = {
    width: "100%",
    padding: "0 22px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginTop: 3,
    gap: 16,
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: CREAM,
    borderRadius: 24,
    padding: "18px 18px 20px 18px",
    color: "#374151",
    boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
    boxSizing: "border-box",
  };

  const motivationCardStyle: React.CSSProperties = {
    width: "100%",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.16), rgba(91,95,239,0.28))",
    borderRadius: 20,
    padding: "14px 16px 16px 16px",
    color: "#f9fafb",
    boxShadow: "0 12px 30px rgba(15,23,42,0.45)",
    border: "1px solid rgba(249,250,251,0.18)",
    fontSize: 14,
    lineHeight: 1.6,
    boxSizing: "border-box",
    marginTop: 10,
  };

  const motivationHeaderRowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 4,
  };

  const motivationTitleStyle: React.CSSProperties = {
    fontSize: 17,
    fontWeight: 700,
  };

  const motivationChipStyle: React.CSSProperties = {
    padding: "2px 8px",
    borderRadius: 999,
    backgroundColor: "rgba(249,250,251,0.3)",
    color: "#f9fafb",
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const motivationSubRowStyle: React.CSSProperties = {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 6,
    fontSize: 11,
    color: "#e5e7eb",
  };

  const motivationErrorStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#fee2e2",
    marginTop: 4,
  };

  const notesTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    marginTop: 6,
    marginBottom: 6,
  };

  const bulletListStyle: React.CSSProperties = {
    listStyleType: "disc",
    paddingLeft: "1.3rem",
    margin: 0,
  };

  const bulletItemStyle: React.CSSProperties = {
    marginBottom: 6,
    fontSize: 13,
  };

  const footerTextStyle: React.CSSProperties = {
    marginTop: 10,
    fontSize: 11,
    color: "#e5e7eb",
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 8,
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "8px 10px",
    fontSize: 14,
    outline: "none",
  };

  const toggleRowStyle: React.CSSProperties = {
    marginTop: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const toggleLabelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
  };

  const toggleTrackStyle = (isOn: boolean): React.CSSProperties => ({
    width: 50,
    height: 28,
    borderRadius: 999,
    backgroundColor: isOn ? GREEN : "#d1d5db",
    display: "flex",
    alignItems: "center",
    padding: 3,
    boxSizing: "border-box",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  });

  const toggleThumbStyle = (isOn: boolean): React.CSSProperties => ({
    width: 22,
    height: 22,
    borderRadius: "50%",
    backgroundColor: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    transform: isOn ? "translateX(18px)" : "translateX(0)",
    transition: "transform 0.2s ease",
  });

  const helperTextStyle: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    color: "#6b7280",
  };

  const bottomNavStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: CREAM,
    borderRadius: 0,
    padding: "10px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxSizing: "border-box",
    boxShadow: "0 -2px 10px rgba(15,23,42,0.15)",
    height: 50,
  };

  const navItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#3565AF",
    fontWeight: 600,
  };

  const updateButtonStyle: React.CSSProperties = {
    marginTop: 16,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#F4C58F",
    border: "none",
    paddingBlock: 10,
    fontSize: 15,
    fontWeight: 600,
    color: "#3565AF",
    cursor: saving ? "wait" : "pointer",
  };

  const testButtonStyle: React.CSSProperties = {
    marginTop: 8,
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    border: "none",
    paddingBlock: 10,
    fontSize: 14,
    fontWeight: 500,
    color: "#111827",
    cursor: "pointer",
  };

  const statusMsgStyle: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  };

  const logoBlockStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  };

  const logoCircleStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
  };

  const logoImgStyle: React.CSSProperties = {
    width: "130%",
    height: "130%",
    objectFit: "cover",
  };

  const appNameStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#5F8DD0",
    letterSpacing: 0.5,
  };

  const describeFrequency = (value: string): string => {
    switch (value) {
      case "15":
        return "every 15 minutes";
      case "30":
        return "every 30 minutes";
      case "60":
        return "every hour";
      case "120":
        return "every 2 hours";
      case "240":
        return "every 4 hours";
      case "1440":
        return "once a day";
      default:
        return "regularly";
    }
  };

  if (loadingSettings) {
    return (
      <div style={screenStyle}>
        <div style={phoneStyle}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            Loading your settings…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        <div style={topSectionStyle}>
          <button
            type="button"
            style={homeBtnStyle}
            onClick={() => navigate("/journey")}
            aria-label="Back"
            title="Back"
          >
            🏠
          </button>

          <div style={logoBlockStyle}>
            <div style={logoCircleStyle}>
              <img src={logo} alt="Mendly logo" style={logoImgStyle} />
            </div>
            <div style={appNameStyle}>
              <strong>Mendly App</strong>
            </div>
          </div>

          <button
            type="button"
            style={logoutBtnStyle}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("access_token");
              navigate("/login", { replace: true });
            }}
            aria-label="Logout"
            title="Log out"
          >
            🚪
          </button>
        </div>

        <div style={bottomSectionStyle}>
          <div style={innerContentStyle}>
            <div style={motivationCardStyle}>
              <div style={motivationHeaderRowStyle}>
                <div style={motivationTitleStyle}>Your weekly motivation</div>
                {hasData && avg7 !== null && (
                  <div style={motivationChipStyle}>7-day avg: {avg7} / 10</div>
                )}
              </div>

              <div style={motivationSubRowStyle}>
                {periodLabel && <span>{periodLabel}</span>}
                {hasData && hasTodayData && <span>Today logged ✅</span>}
                {hasData && !hasTodayData && <span>No check-in today yet</span>}
              </div>

              {moodLoading && (
                <div style={{ fontSize: 12 }}>Loading your mood data…</div>
              )}

              {!moodLoading && moodError && (
                <div style={motivationErrorStyle}>{moodError}</div>
              )}

              {!moodLoading && !moodError && (
                <>
                  <div style={notesTitleStyle}>{notes.title}</div>
                  <ul style={bulletListStyle}>
                    {notes.bullets.map((t, i) => (
                      <li key={i} style={bulletItemStyle}>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div style={footerTextStyle}>
                    <strong>{notes.footer}</strong>
                  </div>
                </>
              )}
            </div>

            <div style={cardStyle}>
              <div>
                <div style={labelStyle}>
                  How often do you want to receive positive notifications?
                </div>
                <select
                  style={selectStyle}
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                  <option value="120">Every 2 hours</option>
                  <option value="240">Every 4 hours</option>
                  <option value="1440">Once a day</option>
                </select>
              </div>

              <div style={toggleRowStyle}>
                <div style={toggleLabelStyle}>
                  Positive notifications {enabled ? "ON" : "OFF"}
                </div>
                <div
                  style={toggleTrackStyle(enabled)}
                  onClick={() => setEnabled((prev) => !prev)}
                  aria-label="Toggle positive notifications"
                  role="switch"
                  aria-checked={enabled}
                >
                  <div style={toggleThumbStyle(enabled)} />
                </div>
              </div>

              <div style={helperTextStyle}>
                {enabled
                  ? `You will receive positive notifications ${describeFrequency(frequency)}.`
                  : "Positive notifications are turned off. Turn them on to start receiving them again."}
              </div>

              <button
                type="button"
                style={updateButtonStyle}
                onClick={handleUpdateClick}
                disabled={saving}
              >
                {saving ? "Updating…" : "Update"}
              </button>

              <button
                type="button"
                style={testButtonStyle}
                onClick={handleSendTestClick}
              >
                Send test positive notification
              </button>

              {statusMsg && <div style={statusMsgStyle}>{statusMsg}</div>}
            </div>
          </div>
        </div>

        <div style={bottomNavStyle}>
          <button
            type="button"
            style={navItemStyle}
            onClick={() => navigate("/profile")}
            aria-label="Profile"
          >
            <div style={{ fontSize: 22 }}>👤</div>
            <div>Profile</div>
          </button>

          <HappyPhotoMemoriesButton navItemStyle={navItemStyle} />

          <button
            type="button"
            style={navItemStyle}
            onClick={() => navigate("/chat")}
            aria-label="AI Chat"
          >
            <div style={{ fontSize: 22 }}>💬</div>
            <div>Ai Chat</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PositiveNotificationsPage;