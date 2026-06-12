import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import heroImage from "../assets/peace-quote.png";
import {
  getMoodSeries,
  uploadAudioForMood,
  type SeriesPoint,
} from "../api/auth";
import { AudioMonitor } from "../plugins/AudioMonitor";
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";
import { Capacitor } from "@capacitor/core";

const LOW_MOOD_THRESHOLD = 2;
const MEMORY_LOW_MOOD_THRESHOLD = 3;

const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

interface HappyMemory {
  memory_id: string;
  image_url: string;
  caption: string | null;
  memory_date: string | null;
  created_at: string;
}

const JourneyOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  const moodTips: string[] = [
    "Notice how your sleep affects your mood.",
    "Track how different foods make you feel.",
    "Write down how movement or exercise changes your emotions.",
    "Pay attention to how time with people impacts your mood.",
    "Name your emotions — it can reduce their intensity.",
    "Look for patterns between your daily habits and how you feel.",
    "Use what you learn to make choices that support your well-being.",
  ];

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [series14, setSeries14] = useState<SeriesPoint[] | null>(null);
  const [loadingMood, setLoadingMood] = useState<boolean>(true);
  const [moodError, setMoodError] = useState<string | null>(null);

  const [lastPhq2Date, setLastPhq2Date] = useState<string | null>(null);
  const [lastPhotoMemoriesDate, setLastPhotoMemoriesDate] = useState<string | null>(null);
  const [screeningStatusLoaded, setScreeningStatusLoaded] = useState<boolean>(false);

  const [showScreeningIntro, setShowScreeningIntro] = useState(false);

  const [photoReminder, setPhotoReminder] = useState<{
    image_url: string;
    caption: string | null;
    message: string;
  } | null>(null);

  const [showAutoMemoriesOverlay, setShowAutoMemoriesOverlay] = useState(false);
  const [autoMemories, setAutoMemories] = useState<HappyMemory[]>([]);
  const [autoMemoriesLoading, setAutoMemoriesLoading] = useState(false);
  const [autoMemoriesError, setAutoMemoriesError] = useState<string | null>(null);

  const [fullScreenAutoMemory, setFullScreenAutoMemory] = useState<{
    src: string;
    caption: string | null;
  } | null>(null);

  // ===== Native audio recording + analysis state =====
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [voiceText, setVoiceText] = useState<string>("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastAudioResult, setLastAudioResult] = useState<{
    ok: boolean;
    emotion?: string;
    confidence?: number;
    mendly_state?: string;
    message?: string;
    score_saved?: number;
    label_saved?: string;
    mood_source?: string;
  } | null>(null);

  const nativeRecordingRef = useRef(false);

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  };

  const refreshMoodSeries = async () => {
    try {
      setLoadingMood(true);
      const data = await getMoodSeries(14);
      setSeries14(data);
      setMoodError(null);
    } catch (err) {
      console.error("Failed to refresh mood series", err);
      setMoodError("Failed to refresh mood data");
    } finally {
      setLoadingMood(false);
    }
  };

  const handleStartListening = async () => {
    try {
      setVoiceError(null);
      setVoiceText("Starting native recording...");
      setLastAudioResult(null);

      setVoiceText("Starting native recording...");
      await AudioMonitor.startRecording();
      nativeRecordingRef.current = true;
      setIsListening(true);
      setVoiceText("Listening... you can speak now.");
    } catch (err: any) {
      console.error("[audio] native start failed", err);
      setVoiceText("");
      setIsListening(false);
      nativeRecordingRef.current = false;
      setVoiceError(err?.message || "Could not start native audio recording.");
    }
  };

  const handleStopListening = async () => {
    try {
      setVoiceError(null);

      if (!nativeRecordingRef.current) {
        setIsListening(false);
        setVoiceText("");
        return;
      }

      setVoiceText("Stopping recording...");
      const recorded = await AudioMonitor.stopRecording();

      nativeRecordingRef.current = false;
      setIsListening(false);

      if (!recorded?.base64) {
        throw new Error("Recorded audio was empty.");
      }

      const blob = base64ToBlob(recorded.base64, recorded.mimeType || "audio/mp4");

      if (!blob.size) {
        throw new Error("Recorded audio file is empty.");
      }

      setIsAnalyzingAudio(true);
      setVoiceText("Uploading and analyzing audio...");

      const result = await uploadAudioForMood(
        blob,
        recorded.fileName || "mood-recording.m4a"
      );
      console.log("[audio] backend result:", result);

      setLastAudioResult(result);

      if (result.ok) {
        setVoiceText(
          `Detected: ${result.emotion ?? "unknown"} • score saved: ${result.score_saved ?? "-"}`
        );
        await refreshMoodSeries();
      } else {
        setVoiceText("");
        setVoiceError(result.message || "Audio analysis failed.");
      }
    } catch (err: any) {
      console.error("[audio] native stop/upload failed", err);
      setVoiceText("");
      setVoiceError(err?.message || "Could not process recorded audio.");
      setIsListening(false);
      nativeRecordingRef.current = false;
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  useEffect(() => {
    return () => {
      nativeRecordingRef.current = false;
    };
  }, []);

  // --- fetch last 14-day mood series once ---
  useEffect(() => {
    let cancelled = false;

    const fetchMood = async () => {
      try {
        setLoadingMood(true);
        const data = await getMoodSeries(14);
        if (!cancelled) {
          setSeries14(data);
          setMoodError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load mood series", err);
          setMoodError("Failed to load mood data");
        }
      } finally {
        if (!cancelled) {
          setLoadingMood(false);
        }
      }
    };

    fetchMood();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- fetch screening status ---
  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const token = window.localStorage.getItem("access_token");
        if (!token) {
          if (!cancelled) setScreeningStatusLoaded(true);
          return;
        }

        const res = await fetch(`${API_BASE}/screenings/status`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          console.error("Failed to fetch screening status:", res.status);
          if (!cancelled) setScreeningStatusLoaded(true);
          return;
        }

        const data: {
          last_phq2_date: string | null;
          last_photo_memory_date: string | null;
        } = await res.json();

        if (!cancelled) {
          setLastPhq2Date(data.last_phq2_date);
          setLastPhotoMemoriesDate(data.last_photo_memory_date);
          setScreeningStatusLoaded(true);
        }
      } catch (err) {
        console.error("Error fetching screening status:", err);
        if (!cancelled) setScreeningStatusLoaded(true);
      }
    };

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const markMemoriesPopupShownToday = async () => {
    try {
      const token = window.localStorage.getItem("access_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/screenings/photo-popup-seen`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const today = new Date().toISOString().slice(0, 10);
        setLastPhotoMemoriesDate(today);
      }
    } catch (err) {
      console.error("Failed to mark memories popup as seen", err);
    }
  };

  const openAutoMemoriesPopup = async () => {
    try {
      const token = window.localStorage.getItem("access_token");
      if (!token) return;

      setAutoMemoriesLoading(true);
      setAutoMemoriesError(null);

      const res = await fetch(`${API_BASE}/photo-memories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Failed to load auto memories", res.status);
        setAutoMemoriesError("Could not load your happy memories.");
        return;
      }

      const data: HappyMemory[] = await res.json();
      if (data.length > 0) {
        setAutoMemories(data);
        setShowAutoMemoriesOverlay(true);
        await markMemoriesPopupShownToday();
      }
    } catch (err) {
      console.error("Error loading auto memories", err);
      setAutoMemoriesError("Could not load your happy memories.");
    } finally {
      setAutoMemoriesLoading(false);
    }
  };

  // --- decide when to show PHQ intro and when to show memories popup ---
  useEffect(() => {
    if (loadingMood || !screeningStatusLoaded) return;
    if (!series14 || series14.length === 0) return;

    const numericValues = series14
      .map((p) => p.avg_score)
      .filter((v): v is number => typeof v === "number");

    if (!numericValues.length) return;

    const rawAvg =
      numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
    const avg = Number(rawAvg.toFixed(1));

    const today = new Date().toISOString().slice(0, 10);

    const lastScreenDate =
      lastPhq2Date && typeof lastPhq2Date === "string"
        ? lastPhq2Date.slice(0, 10)
        : null;

    const lastMemoriesDate =
      lastPhotoMemoriesDate && typeof lastPhotoMemoriesDate === "string"
        ? lastPhotoMemoriesDate.slice(0, 10)
        : null;

    const alreadyScreenedToday = lastScreenDate === today;
    const alreadySawMemoriesToday = lastMemoriesDate === today;

    if (avg <= LOW_MOOD_THRESHOLD && !alreadyScreenedToday) {
      setShowScreeningIntro(true);
      return;
    }

    if (avg <= MEMORY_LOW_MOOD_THRESHOLD && !alreadySawMemoriesToday) {
      void openAutoMemoriesPopup();
    }
  }, [
    loadingMood,
    screeningStatusLoaded,
    series14,
    lastPhq2Date,
    lastPhotoMemoriesDate,
  ]);

  useEffect(() => {
    if (isPaused) return;

    const id = window.setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % moodTips.length);
    }, 5000);

    return () => window.clearInterval(id);
  }, [isPaused, moodTips.length]);

  useEffect(() => {
    if (!screeningStatusLoaded) return;

    const today = new Date().toISOString().slice(0, 10);
    const lastMemoriesDate =
      lastPhotoMemoriesDate && typeof lastPhotoMemoriesDate === "string"
        ? lastPhotoMemoriesDate.slice(0, 10)
        : null;

    const alreadySawMemoriesToday = lastMemoriesDate === today;
    if (alreadySawMemoriesToday) {
      return;
    }
  }, [screeningStatusLoaded, lastPhotoMemoriesDate]);

  const handleHoldStart = () => setIsPaused(true);
  const handleHoldEnd = () => setIsPaused(false);

  const secondTipIndex = (currentTipIndex + 1) % moodTips.length;
  const thirdTipIndex = (secondTipIndex + 1) % moodTips.length;

  
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
    height: "30px",
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
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
  };

  const homeBtnStyle: React.CSSProperties = { ...iconBtn, left: 12 };
  const logoutBtnStyle: React.CSSProperties = { ...iconBtn, right: 12 };

  const titleBlockStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
  };

  const smallLabelStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontSize: 20,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const tinyLogoStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: CREAM,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const tinyLogoImgStyle: React.CSSProperties = {
    width: "130%",
    height: "130%",
    objectFit: "cover",
  };

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
    gap: 16,
    alignItems: "center",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: CREAM,
    borderRadius: 24,
    padding: "14px 16px 16px 16px",
    color: "#374151",
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.18)",
    boxSizing: "border-box",
  };

  const heroImageCard: React.CSSProperties = {
    width: "100%",
    height: 150,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const heroMediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const actionBtn: React.CSSProperties = {
    border: "none",
    cursor: "pointer",
    borderRadius: 999,
    backgroundColor: "#2a5f97ff",
    color: CREAM,
    padding: "12px 14px",
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)",
    fontWeight: 700,
    width: "100%",
    fontSize: 14,
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
    boxShadow: "0 -2px 10px rgba(15, 23, 42, 0.15)",
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
    fontSize: 13,
  };

  const bulletListStyle: React.CSSProperties = {
    listStyleType: "disc",
    paddingLeft: "1.2rem",
    margin: 0,
  };

  const bulletItemStyle: React.CSSProperties = {
    fontSize: 13,
    opacity: 0.9,
    lineHeight: 1.4,
  };

  const helperPauseStyle: React.CSSProperties = {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.65,
  };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    backdropFilter: "blur(6px)",
  };

  const modalStyle: React.CSSProperties = {
    width: "88%",
    maxWidth: 360,
    backgroundColor: CREAM,
    borderRadius: 24,
    padding: "20px 18px 18px 18px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
    color: "#111827",
    boxSizing: "border-box",
    textAlign: "left",
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
  };

  const modalBodyStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.5,
    marginBottom: 12,
  };

  const modalNoteStyle: React.CSSProperties = {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 14,
  };

  const modalBtnStyle: React.CSSProperties = {
    ...actionBtn,
    width: "100%",
    paddingBlock: 10,
  };

  const memoriesOverlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 45,
    backdropFilter: "blur(8px)",
  };

  const memoriesModalStyle: React.CSSProperties = {
    width: "94%",
    maxWidth: 420,
    maxHeight: "82%",
    background:
      "linear-gradient(145deg, #fef9c3 0%, #f5e9d9 35%, #e0ecff 100%)",
    borderRadius: 26,
    padding: "14px 14px 16px 14px",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.5)",
    color: "#111827",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const memoriesHeaderRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  };

  const smallIconBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
    cursor: "pointer",
    boxShadow: "0 3px 8px rgba(15, 23, 42, 0.15)",
  };


  const memoriesGrid: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    marginTop: 4,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
    gap: 8,
    paddingRight: 2,
  };

  const memoriesCard: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.18)",
    display: "flex",
    flexDirection: "column",
    minHeight: 165,
  };

  const memoriesImgWrapper: React.CSSProperties = {
    width: "100%",
    height: 90,
    overflow: "hidden",
    cursor: "pointer",
  };

  const memoriesImg: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  const memoriesBody: React.CSSProperties = {
    padding: "4px 6px 6px 6px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };


  const fullScreenOverlay: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 55,
  };

  const fullScreenInner: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    maxWidth: 450,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: 12,
    boxSizing: "border-box",
  };

  const fullScreenImgWrapper: React.CSSProperties = {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 20px 45px rgba(0,0,0,0.7)",
  };

  const fullScreenImg: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    backgroundColor: "black",
  };

  const fullScreenCaption: React.CSSProperties = {
    marginTop: 10,
    color: "#e5e9eb",
    fontSize: 14,
    textAlign: "center",
  };

  const fullScreenCloseBtn: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    border: "none",
    borderRadius: 999,
    width: 34,
    height: 34,
    backgroundColor: "rgba(15,23,42,0.9)",
    color: "#f9fafb",
    cursor: "pointer",
    fontSize: 18,
    boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
  };

  const micBtnStyle: React.CSSProperties = {
    position: "absolute",
    right: 16,
    bottom: 70,
    width: 52,
    height: 52,
    borderRadius: 999,
    border: "none",
    cursor: isAnalyzingAudio ? "default" : "pointer",
    backgroundColor: isListening ? "#dc2626" : "#2563eb",
    color: "#f9fafb",
    fontSize: 22,
    boxShadow: "0 12px 26px rgba(0,0,0,0.25)",
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: isAnalyzingAudio ? 0.7 : 1,
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        <div style={topSectionStyle}>
          <button
            type="button"
            style={homeBtnStyle}
            onClick={() => navigate("/journey")}
            aria-label="Home"
            title="Home"
          >
            🏠
          </button>

          <div style={titleBlockStyle}>
            <div style={smallLabelStyle}>
              <span style={tinyLogoStyle}>
                <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
              </span>
              Mendly App
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
          <div style={heroImageCard}>
            <img
              src={heroImage}
              alt="You have the power to protect your peace"
              style={heroMediaStyle}
            />
          </div>

          <div style={innerContentStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                width: "100%",
              }}
            >
              <button
                type="button"
                style={{ ...actionBtn, paddingBlock: 14 }}
                onClick={() => navigate("/breath")}
              >
                Breath Training
              </button>

              <button
                type="button"
                style={{ ...actionBtn, paddingBlock: 14 }}
                onClick={() => navigate("/mood-track")}
              >
                Mood Track
              </button>

              <button
                type="button"
                style={{ ...actionBtn, paddingBlock: 14 }}
                onClick={() => navigate("/support")}
              >
                Find support
              </button>

              <button
                type="button"
                style={{ ...actionBtn, paddingBlock: 14 }}
                onClick={() => navigate("/psychologists")}
              >
                Find a Psychologist
              </button>
            </div>

            <button
              type="button"
              style={{ ...actionBtn, marginTop: 4 }}
              onClick={() => navigate("/check-in")}
            >
              Daily Check in
            </button>

            <button
              type="button"
              style={{ ...actionBtn, marginTop: 4 }}
              onClick={() => navigate("/positive")}
            >
              Positive Notifications / Motivation Notes
            </button>

            <button
              type="button"
              style={{ ...actionBtn, marginTop: 4 }}
              onClick={() => navigate("/control-circle")}
            >
              Circle of Control
            </button>

            <div
              style={{ ...cardStyle }}
              onMouseDown={handleHoldStart}
              onMouseUp={handleHoldEnd}
              onMouseLeave={handleHoldEnd}
              onTouchStart={handleHoldStart}
              onTouchEnd={handleHoldEnd}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Posts</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Why Mood Tracking Works
              </div>
              <ul style={bulletListStyle}>
                <li style={bulletItemStyle}>{moodTips[currentTipIndex]}</li>
                <li style={bulletItemStyle}>{moodTips[secondTipIndex]}</li>
                <li style={bulletItemStyle}>{moodTips[thirdTipIndex]}</li>
              </ul>
              <div style={helperPauseStyle}>
                {isPaused
                  ? "Release to keep exploring more tips."
                  : "Tap & hold to pause these tips."}
              </div>
              {moodError && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#b91c1c",
                  }}
                >
                  {moodError}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={bottomNavStyle}>
          <div
            style={navItemStyle}
            onClick={() => navigate("/profile")}
            role="button"
            aria-label="Profile"
          >
            <div style={{ fontSize: 22 }}>👤</div>
            <div>Profile</div>
          </div>

          <HappyPhotoMemoriesButton navItemStyle={navItemStyle} />

          <div
            style={navItemStyle}
            onClick={() => navigate("/chat")}
            role="button"
            aria-label="AI Chat"
          >
            <div style={{ fontSize: 22 }}>💬</div>
            <div>Ai Chat</div>
          </div>
        </div>

        {showScreeningIntro && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              <div style={modalTitleStyle}>Short wellbeing check</div>
              <div style={modalBodyStyle}>
                We noticed that your mood has been a bit low over the last couple
                of weeks. We’d like to offer you a very short questionnaire (2
                quick questions) to better understand how you’ve been feeling.
              </div>
              <div style={modalNoteStyle}>
                This is not a diagnosis. It’s a screening tool to help you and,
                if you choose, your care team. You can stop using the app at any
                time.
              </div>
              <button
                type="button"
                style={modalBtnStyle}
                onClick={() => {
                  setShowScreeningIntro(false);
                  navigate("/phq2");
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {photoReminder && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 35,
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                width: "88%",
                maxWidth: 360,
                backgroundColor: CREAM,
                borderRadius: 24,
                padding: "18px 16px 16px 16px",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
                color: "#111827",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  borderRadius: 18,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <img
                  src={photoReminder.image_url}
                  alt="Happy memory"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {photoReminder.message}
              </div>
              {photoReminder.caption && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#4b5563",
                    marginBottom: 10,
                  }}
                >
                  “{photoReminder.caption}”
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPhotoReminder(null);
                  void markMemoriesPopupShownToday();
                }}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 16px",
                  backgroundColor: "#2a5f97ff",
                  color: CREAM,
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showAutoMemoriesOverlay && (
          <div style={memoriesOverlayStyle}>
            <div style={memoriesModalStyle}>
              <div style={memoriesHeaderRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span role="img" aria-label="sparkles">
                    ✨
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    A few moments to remember
                  </span>
                </div>
                <button
                  type="button"
                  style={smallIconBtn}
                  onClick={() => setShowAutoMemoriesOverlay(false)}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#4b5563",
                  marginBottom: 4,
                }}
              >
                When things feel heavy, it can help to look back at moments that
                made you smile. Here are some of yours. 💙
              </div>

              {autoMemoriesLoading ? (
                <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 8 }}>
                  Loading your memories…
                </div>
              ) : autoMemoriesError ? (
                <div style={{ marginTop: 4, fontSize: 11, color: "#b91c1c" }}>
                  {autoMemoriesError}
                </div>
              ) : autoMemories.length === 0 ? (
                <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 8 }}>
                  You don&apos;t have any saved memories yet. You can add some
                  from the camera button below. 📷
                </div>
              ) : (
                <div style={memoriesGrid}>
                  {autoMemories.map((m) => {
                    const imgSrc = m.image_url.startsWith("http")
                      ? m.image_url
                      : `${API_BASE}${m.image_url.startsWith("/") ? "" : "/"}${m.image_url}`;
                    return (
                      <div key={m.memory_id} style={memoriesCard}>
                        <div
                          style={memoriesImgWrapper}
                          onClick={() =>
                            setFullScreenAutoMemory({
                              src: imgSrc,
                              caption: m.caption,
                            })
                          }
                        >
                          <img
                            src={imgSrc}
                            alt={m.caption ?? "Happy memory"}
                            style={memoriesImg}
                          />
                        </div>
                        <div style={memoriesBody}>
                          {m.caption && (
                            <div style={{ fontSize: 11 }}>“{m.caption}”</div>
                          )}
                          {m.memory_date && (
                            <div style={{ fontSize: 10, color: "#4b5563" }}>
                              {m.memory_date}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {fullScreenAutoMemory && (
          <div style={fullScreenOverlay}>
            <div style={fullScreenInner}>
              <button
                type="button"
                style={fullScreenCloseBtn}
                onClick={() => setFullScreenAutoMemory(null)}
                aria-label="Close"
              >
                ✕
              </button>
              <div style={fullScreenImgWrapper}>
                <img
                  src={fullScreenAutoMemory.src}
                  alt={fullScreenAutoMemory.caption ?? "Happy memory"}
                  style={fullScreenImg}
                />
              </div>
              {fullScreenAutoMemory.caption && (
                <div style={fullScreenCaption}>
                  “{fullScreenAutoMemory.caption}”
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          style={micBtnStyle}
          onClick={() => (isListening ? handleStopListening() : handleStartListening())}
          aria-label="Record mood audio"
          title={isListening ? "Stop recording" : "Start recording"}
          disabled={isAnalyzingAudio}
        >
          {isListening ? "⏹️" : "🎙️"}
        </button>

        {(voiceText || voiceError || lastAudioResult || isAnalyzingAudio) && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: 128,
              zIndex: 60,
              backgroundColor: "rgba(15,23,42,0.85)",
              color: "#f9fafb",
              borderRadius: 14,
              padding: "10px 12px",
              fontSize: 12,
              boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
            }}
          >
            {isListening && (
              <div style={{ marginBottom: 6, opacity: 0.9 }}>
                <strong>Status:</strong> Recording from microphone...
              </div>
            )}

            {isAnalyzingAudio && (
              <div style={{ marginBottom: 6, opacity: 0.9 }}>
                <strong>Status:</strong> Uploading and analyzing your audio...
              </div>
            )}

            {voiceText && (
              <div>
                <strong>Audio:</strong> {voiceText}
              </div>
            )}

            {lastAudioResult?.ok && (
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                <strong>Saved mood:</strong> {lastAudioResult.label_saved} • score{" "}
                {lastAudioResult.score_saved}
              </div>
            )}

            {voiceError && (
              <div style={{ marginTop: 6, color: "#fecaca" }}>{voiceError}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JourneyOverviewPage;