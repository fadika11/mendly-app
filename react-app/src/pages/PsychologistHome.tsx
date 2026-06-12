// react-app/src/pages/PsychologistHomePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { Capacitor } from "@capacitor/core";
import PsyAvailabilityButton from "../components/PsyAvailabilityButton";

const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

const PsychologistHomePage: React.FC = () => {
  const navigate = useNavigate();

  // Theme
  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BTN = "#2a5f97";
  const BTN_TXT = "#f5e9d9";

  // optional: greet name from /auth/me (also used for profile completion check)
  const [psyName, setPsyName] = useState<string>("");

  // ===== Posts (psychologist tips) =====
  const psyTips: string[] = [
    "Start sessions with a quick check-in: mood, safety, and a small goal.",
    "Document key themes and interventions right after the session while details are fresh.",
    "Track progress using simple measures (e.g., goals met, distress 0–10, functional changes).",
    "Review pending client requests early to reduce wait time and anxiety for clients.",
    "Confirm boundaries and communication expectations (messages, emergencies, response times).",
    "Use short homework: one small exercise is better than many overwhelming tasks.",
    "Summarize the session in 2–3 sentences and agree on next steps before ending.",
    "Watch for burnout signals: schedule short breaks and protect admin time blocks.",
    "When unsure, consult supervision or evidence-based guidelines—don’t carry it alone.",
    "Celebrate micro-wins with clients to reinforce motivation and hope.",
    "Keep consent clear when sharing exercises or tools through the app.",
    "Use your dashboard as a routine: requests → sessions/notes → follow-ups.",
  ];

  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // ===== screen =====
  const screenStyle: React.CSSProperties = {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    backgroundColor: BLUE,
    fontFamily:
      '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const phoneStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 450,
    height: "100%",
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  };

  // ===== header =====
  const headerStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    padding: "14px 16px",
    boxShadow: "0 6px 18px rgba(15,23,42,0.12)",
    boxSizing: "border-box",
  };

  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const iconBtn: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    backgroundColor: "#3970aaff",
    color: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    boxShadow: "0 10px 22px rgba(0,0,0,0.14)",
    flex: "0 0 auto",
  };

  const brandRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    flex: 1,
    minWidth: 0,
  };

  const tinyLogoStyle: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: CREAM,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
    flex: "0 0 auto",
  };

  const tinyLogoImgStyle: React.CSSProperties = {
    width: "150%",
    height: "150%",
    objectFit: "cover",
  };

  const brandTextWrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1.05,
    minWidth: 0,
  };

  const brandTitle: React.CSSProperties = {
    color: "#3565AF",
    fontWeight: 700,
    fontSize: 18,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  // ===== content =====
  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: "14px 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    boxSizing: "border-box",
  };

  const heroCard: React.CSSProperties = {
    backgroundColor: "rgba(245,233,217,0.22)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: 24,
    padding: 14,
    boxShadow: "0 14px 32px rgba(15,23,42,0.14)",
    backdropFilter: "blur(6px)",
  };

  const heroTop: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const helloText: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 750,
    color: "rgba(255,255,255,0.95)",
  };

  const quoteBox: React.CSSProperties = {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 22,
    padding: "14px 14px",
    textAlign: "center",
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 1.35,
    color: "#0f172a",
    border: "1px solid rgba(255,255,255,0.25)",
    boxShadow: "0 12px 24px rgba(15,23,42,0.12)",
  };

  // ✅ two cards SAME width as sessions card
  const quickGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    width: "100%",
  };

  const actionCard: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 14,
    boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "1px solid rgba(53,101,175,0.10)",
    width: "100%", // ✅ force same width inside grid
    minWidth: 0,   // ✅ prevent overflow shrinking weirdness
    boxSizing: "border-box",
  };

  const actionTop: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  const actionIcon: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(53,101,175,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    boxShadow: "0 10px 20px rgba(0,0,0,0.10)",
    flex: "0 0 auto",
  };

  const actionTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: "#1f2937",
    lineHeight: 1.15,
  };

  const actionSub: React.CSSProperties = {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 750,
    color: "#3565AF",
    lineHeight: 1.25,
  };

  const actionBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 16,
    backgroundColor: BTN,
    color: BTN_TXT,
    padding: "12px 12px",
    fontSize: 14,
    fontWeight: 750,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
    whiteSpace: "nowrap",
    width: "100%",
  };

  const actionBtn2: React.CSSProperties = {
    border: "none",
    borderRadius: 16,
    backgroundColor: BTN,
    color: BTN_TXT,
    padding: "12px 12px",
    fontSize: 13.4,
    fontWeight: 750,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
    whiteSpace: "nowrap",
  };

  const wideCard: React.CSSProperties = {
    ...actionCard,
  };

  // ===== Posts card (Journey-style) =====
  const postsCard: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 22,
    padding: "14px 16px",
    color: "#374151",
    boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
    border: "1px solid rgba(53,101,175,0.10)",
    boxSizing: "border-box",
  };

  const postsHeaderRow: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  };

  const postsTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    color: "#3565AF",
  };

  const postsSubTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 12,
    fontWeight: 850,
    color: "#111827",
    opacity: 0.9,
  };

  const bulletListStyle: React.CSSProperties = {
    listStyleType: "disc",
    paddingLeft: "1.2rem",
    margin: 0,
  };

  const bulletItemStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 750,
    opacity: 0.95,
    lineHeight: 1.45,
    color: "#0f172a",
  };

  const helperPauseStyle: React.CSSProperties = {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 700,
    opacity: 0.65,
    color: "#111827",
  };

  // ===== bottom nav =====
  const bottomNav: React.CSSProperties = {
    backgroundColor: CREAM,
    padding: "10px 22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 -2px 12px rgba(15,23,42,0.15)",
    height: 52,
    boxSizing: "border-box",
  };

  const navItem: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 16,
    fontWeight: 900,
    color: "#3565AF",
    cursor: "pointer",
    padding: "8px 10px",
    borderRadius: 999,
    backgroundColor: "transparent",
    border: "none",
  };

  // ===== auth + profile completion =====
  useEffect(() => {
    const run = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return navigate("/login", { replace: true });

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return navigate("/login", { replace: true });

      const data = await res.json();

      setPsyName(String(data?.username ?? ""));

      const p = data.psychologist_profile;
      const missing = !p || !p.specialty || !p.workplace || !p.city;

      if (data.role === "psychologist" && missing) {
        navigate("/psy/complete-profile", { replace: true });
      }
    };

    run();
  }, [navigate]);

  const helloLabel = useMemo(() => {
    const name = (psyName || "").trim();
    return name ? `Welcome back, ${name}` : "Welcome back";
  }, [psyName]);

  // ===== auto-rotate tips every 5 seconds (when not paused) =====
  useEffect(() => {
    if (isPaused) return;

    const id = window.setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % psyTips.length);
    }, 5000);

    return () => window.clearInterval(id);
  }, [isPaused, psyTips.length]);

  const handleHoldStart = () => setIsPaused(true);
  const handleHoldEnd = () => setIsPaused(false);

  const secondTipIndex = (currentTipIndex + 1) % psyTips.length;
  const thirdTipIndex = (secondTipIndex + 1) % psyTips.length;

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={headerRow}>
            <button
              type="button"
              style={iconBtn}
              onClick={() => navigate("/psy")}
              aria-label="Home"
              title="Home"
            >
              🏠
            </button>

            <div style={brandRow}>
              <span style={tinyLogoStyle}>
                <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
              </span>
              <div style={brandTextWrap}>
                <div style={brandTitle}>Mendly App</div>
              </div>
            </div>

            <button
              type="button"
              style={iconBtn}
              onClick={() => {
                localStorage.removeItem("access_token");
                navigate("/login", { replace: true });
              }}
              aria-label="Logout"
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={contentStyle}>
          {/* HERO */}
          <div style={heroCard}>
            <div style={heroTop}>
              <div>
                <p style={helloText}>{helloLabel}</p>
              </div>

              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  backgroundColor: "rgba(53,101,175,0.10)",
                  border: "1px solid rgba(53,101,175,0.12)",
                  color: "#3565AF",
                  fontWeight: 950,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                🗓️ Today
              </div>
            </div>

            <div style={quoteBox}>
              “To give people the opportunity for a healthy tomorrow!”
            </div>
          </div>

          {/* QUICK ACTIONS (2 cards, same width as sessions card) */}
          <div style={quickGrid}>
            <div style={actionCard}>
              <div style={actionTop}>
                <div style={actionIcon}>👥</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={actionTitle}>My Clients</h3>
                  <div style={actionSub}>View clients and connections</div>
                </div>
              </div>
              <button style={actionBtn} onClick={() => navigate("/psy/clients")}>
                Review Clients
              </button>
            </div>

            <div style={actionCard}>
              <div style={actionTop}>
                <div style={actionIcon}>📥</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={actionTitle}>Client Requests</h3>
                  <div style={actionSub}>Pending requests</div>
                </div>
              </div>
              <button style={actionBtn2} onClick={() => navigate("/psy/requests")}>
                Review Requests
              </button>
            </div>
          </div>

          {/* SESSIONS (full width) */}
          <div style={wideCard}>
            <div style={actionTop}>
              <div style={actionIcon}>📝</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={actionTitle}>My Sessions & Notes</h3>
                <div style={actionSub}>Document sessions and track progress</div>
              </div>
            </div>
            <button style={actionBtn} onClick={() => navigate("/psy/sessions")}>
              Review Sessions & Notes
            </button>
          </div>

          {/* POSTS (Journey-style rotating tips; tap & hold to pause) */}
          <div
            style={postsCard}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
          >
            <div style={postsHeaderRow}>
              <h3 style={postsTitle}>Today’s Focus</h3>
              <p style={postsSubTitle}>✅ Checklist</p>
            </div>

            <ul style={bulletListStyle}>
              <li style={bulletItemStyle}>{psyTips[currentTipIndex]}</li>
              <li style={bulletItemStyle}>{psyTips[secondTipIndex]}</li>
              <li style={bulletItemStyle}>{psyTips[thirdTipIndex]}</li>
            </ul>

            <div style={helperPauseStyle}>
              {isPaused ? "Release to keep exploring more tips." : "Tap & hold to pause these tips."}
            </div>
          </div>
        </div>

        {/* BOTTOM NAV */}
        <div style={bottomNav}>
          <button
            type="button"
            style={navItem}
            onClick={() => navigate("/psy/profile")}
            aria-label="Profile"
          >
            <span style={{ fontSize: 20 }}>👤</span> Profile
          </button>
          <PsyAvailabilityButton style={navItem} />
        </div>
      </div>
    </div>
  );
};

export default PsychologistHomePage;
