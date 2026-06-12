// react-app/src/pages/Phq2Page.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import thankYouImg from "../assets/thank-you.png";
import { Capacitor } from "@capacitor/core";

type PhqAnswer = 0 | 1 | 2 | 3;

const SCALE_OPTIONS = [
  { value: 0 as PhqAnswer, label: "Not at all" },
  { value: 1 as PhqAnswer, label: "Several days" },
  { value: 2 as PhqAnswer, label: "More than half the days" },
  { value: 3 as PhqAnswer, label: "Nearly every day" },
];

const QUESTIONS_PHQ2 = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed or hopeless",
];

type NextAction = "home" | "phq9" | null;

// 🔹 Backend base URL (same pattern as other pages)
const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

const Phq2Page: React.FC = () => {
  const [answers, setAnswers] = useState<(PhqAnswer | null)[]>([null, null]);
  const [error, setError] = useState<string | null>(null);
  const [showThanks, setShowThanks] = useState(false);
  const [nextAction, setNextAction] = useState<NextAction>(null);
  const [showPhq9Intro, setShowPhq9Intro] = useState(false);
  const navigate = useNavigate();

  const handleChange = (index: number, value: PhqAnswer) => {
    const copy = [...answers];
    copy[index] = value;
    setAnswers(copy);
  };

  const handleSubmit = async () => {
    if (answers.some((a) => a === null)) {
      setError("Please answer all questions.");
      return;
    }

    const total = (answers as PhqAnswer[]).reduce<number>(
      (sum, v) => sum + v,
      0
    );

    setError(null);

    // 🔹 send to backend
    try {
      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setError("You must be logged in to submit this questionnaire.");
        return;
      }

      const res = await fetch(`${API_BASE}/screenings/phq2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "PHQ-2",
          totalScore: total,
          answers,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("PHQ-2 submit failed:", res.status, text);
        setError("Could not save your answers. Please try again.");
        return;
      }

      // optional: still keep localStorage for debugging / fallback
      window.localStorage.setItem(
        "phq_last_screen_date",
        new Date().toISOString().slice(0, 10)
      );
    } catch (e) {
      console.error("Error submitting PHQ-2:", e);
      setError("Could not save your answers. Please try again.");
      return;
    }

    // decide what should happen AFTER the thank-you screen
    const action: NextAction = total >= 3 ? "phq9" : "home";
    setNextAction(action);
    setShowThanks(true);
  };

  // After thank-you screen finishes
  useEffect(() => {
    if (!showThanks || !nextAction) return;

    const id = window.setTimeout(() => {
      setShowThanks(false);
      if (nextAction === "home") {
        navigate("/journey");
      } else if (nextAction === "phq9") {
        setShowPhq9Intro(true); // show popup explaining PHQ-9
      }
      setNextAction(null);
    }, 3000);

    return () => window.clearTimeout(id);
  }, [showThanks, nextAction, navigate]);

  // ===== STYLES =====
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    margin: 0,
    padding: 0,
    backgroundColor: "#e5e7eb",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily:
      '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: "relative",
  };

  const cardStyle: React.CSSProperties = {
    marginTop: 24,
    marginBottom: 32,
    width: "100%",
    maxWidth: 900,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    boxShadow: "0 10px 30px rgba(15,23,42,0.15)",
    padding: "24px 24px 20px 24px",
    boxSizing: "border-box",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    color: "#1f2937",
    marginBottom: 8,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 1.5,
    marginBottom: 16,
  };

  const bulletListStyle: React.CSSProperties = {
    margin: "0 0 18px 18px",
    padding: 0,
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 1.5,
  };

  const headerBarStyle: React.CSSProperties = {
    backgroundColor: "#f9fafb",
    borderTop: "1px solid #e5e7eb",
    borderBottom: "1px solid #e5e7eb",
    padding: "10px 12px",
    display: "grid",
    gridTemplateColumns: "2.4fr repeat(4, 1fr)",
    alignItems: "center",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  };

  const headerLeftStyle: React.CSSProperties = {
    paddingRight: 8,
  };

  const headerCellStyle: React.CSSProperties = {
    textAlign: "center",
  };

  const questionRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "2.4fr repeat(4, 1fr)",
    alignItems: "stretch",
    borderBottom: "1px solid #e5e7eb",
  };

  const questionTextCell: React.CSSProperties = {
    padding: "12px 12px",
    fontSize: 14,
    color: "#111827",
  };

  const optionCellBase: React.CSSProperties = {
    padding: "10px 8px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const optionPillBase: React.CSSProperties = {
    width: "100%",
    maxWidth: 80,
    borderRadius: 999,
    border: "1px solid #d1d5db",
    backgroundColor: "#ffffff",
    padding: "6px 0",
    fontSize: 13,
    fontWeight: 500,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
  };

  const optionPillSelected: React.CSSProperties = {
    ...optionPillBase,
    borderColor: "#facc15",
    backgroundColor: "#fef9c3",
  };

  const scoreBarOuter: React.CSSProperties = {
    marginTop: 18,
    marginBottom: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
  };

  const scoreBarInner: React.CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: "#fbbf24",
  };

  const interpretationCard: React.CSSProperties = {
    marginTop: 12,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 13,
    color: "#0f172a",
  };

  const interpretationTitle: React.CSSProperties = {
    fontWeight: 700,
    marginBottom: 4,
  };

  // thank-you screen styles (copied from CheckInPage style language)
  const thankWrapper: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "#6BA7E6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
  };

  const thankInner: React.CSSProperties = {
    width: "100%",
    maxWidth: 450,
    height: "100%",
    maxHeight: 900,
    backgroundColor: "#6BA7E6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  const dotsWrapperStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 40,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 8,
  };

  const dotBaseStyle: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#0744ecff",
    opacity: 0.3,
    animationName: "dotPulse",
    animationDuration: "1s",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  };

  // popup styles for PHQ-9 intro
  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  };

  const modalStyle: React.CSSProperties = {
    width: "88%",
    maxWidth: 360,
    backgroundColor: "#f9fafb",
    borderRadius: 24,
    padding: "20px 18px 18px 18px",
    boxShadow: "0 18px 40px rgba(15,23,42,0.35)",
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
    padding: "10px 16px",
    borderRadius: 20,
    border: "none",
    backgroundColor: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  };

  // ===== thank-you screen =====
  if (showThanks) {
    return (
      <div style={thankWrapper}>
        <div style={thankInner}>
          <img
            src={thankYouImg}
            alt="Thank you"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          <div style={dotsWrapperStyle}>
            <span style={{ ...dotBaseStyle, animationDelay: "0s" }} />
            <span style={{ ...dotBaseStyle, animationDelay: "0.2s" }} />
            <span style={{ ...dotBaseStyle, animationDelay: "0.4s" }} />
          </div>

          <style>
            {`
              @keyframes dotPulse {
                0%, 80%, 100% {
                  transform: scale(0.6);
                  opacity: 0.3;
                }
                40% {
                  transform: scale(1);
                  opacity: 1;
                }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Patient Health Questionnaire-2 (PHQ-2)</h1>

          <p style={subtitleStyle}>
            The PHQ-2 inquires about the frequency of depressed mood and loss of
            interest over the past two weeks. It uses the first two items of the
            PHQ-9.
          </p>

          <ul style={bulletListStyle}>
            <li>
              The purpose of the PHQ-2 is to screen for depression in a{" "}
              <strong>first-step</strong> approach.
            </li>
            <li>
              Patients who screen positive should be further evaluated with the
              PHQ-9 or other assessments.
            </li>
          </ul>

          <div style={subtitleStyle}>
            <strong>Over the last 2 weeks</strong>, how often have you been
            bothered by the following problems?
          </div>

          {/* table header */}
          <div style={headerBarStyle}>
            <div style={headerLeftStyle}></div>
            {SCALE_OPTIONS.map((opt) => (
              <div key={opt.value} style={headerCellStyle}>
                {opt.label}
              </div>
            ))}
          </div>

          {/* questions */}
          {QUESTIONS_PHQ2.map((q, i) => (
            <div key={i} style={questionRowStyle}>
              <div style={questionTextCell}>
                <strong>{i + 1}.</strong> {q}
              </div>

              {SCALE_OPTIONS.map((opt) => {
                const isSelected = answers[i] === opt.value;
                const label =
                  opt.value === 0 ? "0" : `+${opt.value as number | string}`;
                return (
                  <div key={opt.value} style={optionCellBase}>
                    <div
                      style={isSelected ? optionPillSelected : optionPillBase}
                      onClick={() => handleChange(i, opt.value)}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {error && (
            <p style={{ color: "#b91c1c", marginTop: 10, fontSize: 13 }}>
              {error}
            </p>
          )}

          <div style={{ marginTop: 16, textAlign: "left" }}>
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                padding: "8px 16px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Send
            </button>
          </div>

          {/* score bar & interpretation box (visual) */}
          <div style={scoreBarOuter}>
            <div style={scoreBarInner} />
          </div>

          <div style={interpretationCard}>
            <div style={interpretationTitle}>Interpretation</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>PHQ-2 total score ranges from 0 to 6.</li>
              <li>
                A score of <strong>3 or greater</strong> is commonly used as the
                cutpoint for a positive depression screen.
              </li>
              <li>
                Positive screens should be followed by the PHQ-9 or another
                clinical assessment to evaluate for depressive disorder.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* PHQ-9 intro popup shown only when needed */}
      {showPhq9Intro && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalTitleStyle}>A few more questions</div>
            <div style={modalBodyStyle}>
              Based on your answers, we’d like to offer you a slightly longer
              questionnaire (PHQ-9). It helps understand your mood in more
              detail.
            </div>
            <div style={modalNoteStyle}>
              This is still a screening tool, not a diagnosis. You can always
              discuss the results with a mental-health professional.
            </div>
            <button
              type="button"
              style={modalBtnStyle}
              onClick={() => {
                setShowPhq9Intro(false);
                navigate("/phq9");
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Phq2Page;
