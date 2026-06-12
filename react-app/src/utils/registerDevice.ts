// react-app/src/utils/registerDevice.ts
import { Capacitor } from "@capacitor/core";
import { getFcmToken } from "./fcm";

const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

/**
 * Very simple platform detection so we can send "ios" or "android"
 * to the backend (which CHECKs platform IN ('android','ios')).
 */
function detectPlatform(): "android" | "ios" {
  // If we're not in a browser, just pretend "android"
  if (typeof navigator === "undefined") {
    return "android";
  }

  // Safe access to userAgent / vendor
  const uaParts: string[] = [];

  try {
    if (navigator.userAgent) uaParts.push(navigator.userAgent);
  } catch {
    /* ignore */
  }

  try {
    if (navigator.vendor) uaParts.push(navigator.vendor);
  } catch {
    /* ignore */
  }

  const ua = uaParts.join(" ") || "";

  // iOS (iPhone / iPad / iPod)
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "ios";
  }

  // Everything else we treat as "android" (includes desktop web)
  return "android";
}

/**
 * Get FCM token and send it to backend /devices/register.
 * Does nothing if user denies permission or FCM unsupported.
 */
export async function registerDeviceWithBackend(accessToken: string) {
  const fcmToken = await getFcmToken();
  if (!fcmToken) {
    // No token (user blocked notifications or FCM not available) → just skip
    console.warn("No FCM token available, skipping device registration");
    return;
  }

  const platform = detectPlatform(); // "ios" or "android"

  try {
    const res = await fetch(`${API_BASE}/devices/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fcm_token: fcmToken,
        platform, // now "ios" on iPhone/iPad, otherwise "android"
        app_version: "1.0.0",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("registerDeviceWithBackend failed:", res.status, text);
    } else {
      console.log("Device registered for push notifications");
    }
  } catch (err) {
    console.error("Error calling /devices/register:", err);
  }
}
