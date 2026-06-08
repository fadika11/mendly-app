// react-app/src/pages/CheckInPage.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import thankYouImg from "../assets/thank-you.png"; // ⬅️ your image
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";

const CheckInPage: React.FC = () => {
  const navigate = useNavigate();

  // palette
  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  // ----- state -----
  const [note, setNote] = useState("");
  const [label, setLabel] = useState<string>("");
  const [emojiScore, setEmojiScore] = useState<number | null>(null); // ⬅️ emoji-only score
  const [listScore, setListScore] = useState<number | null>(null); // ⬅️ list-only score
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showThanks, setShowThanks] = useState(false);

  // emojis + meaning text
  const emojiScale = useMemo(
    () =>
      [
        { v: 1, e: "😞", meaning: "Very bad" },
        { v: 3, e: "☹️", meaning: "Bad" },
        { v: 5, e: "😐", meaning: "Neutral" },
        { v: 7, e: "🙂", meaning: "Okay" },
        { v: 9, e: "😊", meaning: "Good" },
        { v: 10, e: "😁", meaning: "Happy" },
      ] as const,
    []
  );

  // dropdown feelings -> its OWN scores (not tied to emoji selection)
  const DROPDOWN_SCORES: Record<string, number> = {
    anxious: 1,
    stressed: 3,
    tired: 5,
    calm: 7,
    excited: 9,
    happy: 10,
  };

  const currentEmoji =
    emojiScore != null ? emojiScale.find((item) => item.v === emojiScore) : undefined;

  // ===== shared styles =====
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
    maxWidth: 450,
    margin: "0 auto",
    backgroundColor: BLUE,
    borderRadius: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    position: "relative",
  };

  // ===== header =====
  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 20,
    paddingBottom: 16,
    paddingInline: 16,
    display: "flex",
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

  const titleBlockStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "center",
  };

  const smallLabelStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontSize: 14,
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

  const headerTitleStyle: React.CSSProperties = {
    fontFamily: '"Times New Roman", Georgia, serif',
    fontSize: 22,
    color: "#5F8DD0",
  };

  // ===== page body =====
  const contentStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: BLUE,
    padding: "18px 20px 16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    color: "#111827",
    overflowY: "auto",
  };

  const card: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: "16px 16px 18px 16px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
  };

  const card2: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: "16px 16px 18px 16px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
    marginTop:20,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: "#3565AF",
    marginBottom: 8,
  };

  const inputStyle: React.CSSProperties = {
    width: "90%",
    border: "1.5px solid #d6cbb9",
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  };

  const emojiRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "nowrap",
    overflowX: "auto",
    width: "100%",
  };

  const emojiBtn = (active: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    cursor: "pointer",
    border: active ? "2px solid #3565AF" : "1px solid #d6cbb9",
    background: active ? "#fff" : "#faf7f1",
    flexShrink: 0,
  });

  const emojiMeaningStyle: React.CSSProperties = {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  };

  const actionsRow: React.CSSProperties = {
    display: "flex",
    gap: 40,
    justifyContent: "center",
    marginTop: 10,
  };

  const pillBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    backgroundColor: "#2a5f97ff",
    color: CREAM,
    fontWeight: 700,
    cursor: "pointer",
    minWidth: 110,
  };

  // ===== bottom nav =====
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

  // --- thank-you overlay styles ---
  const thankScreenStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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

  // ----- helpers -----
  const anyFieldFilled =
    (note && note.trim().length > 0) ||
    label !== "" ||
    emojiScore !== null ||
    listScore !== null;

  const clearAll = () => {
    setNote("");
    setLabel("");
    setEmojiScore(null);
    setListScore(null);
    setMsg("Cleared ✨");
  };

  // ----- handlers -----

  // NOTE FIELD – when user types here, clear emoji & list
  const handleNoteChange: React.ChangeEventHandler<
      HTMLInputElement | HTMLTextAreaElement
    > = (e) => {
      const value = e.target.value;
      setNote(value);
      if (value.trim().length > 0) {
        setLabel("");
        setEmojiScore(null);
        setListScore(null);
      }
  };


  // EMOJI CLICK – when user picks emoji, clear note & list
  const handleEmojiClick = (value: number) => {
    setEmojiScore(value);
    setListScore(null);
    setNote("");
    setLabel("");
  };

  // SELECT CHANGE – when user picks from box, clear note & emoji,
  // and set listScore (but NOT emojiScore)
  const handleLabelChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const value = e.target.value;
    if (!value) {
      setLabel("");
      setListScore(null);
      return;
    }
    setLabel(value);
    setNote("");
    setEmojiScore(null);
    setListScore(DROPDOWN_SCORES[value] ?? null);
  };

  async function sendCheckin() {
    try {
      setSending(true);
      setMsg(null);

      // final numeric score we send to backend
      const finalScore = emojiScore ?? listScore ?? null;

      const { submitMoodCheckin } = await import("../api/auth");
      await submitMoodCheckin({
        score: finalScore,
        label: label || null,
        note: note.trim() || null,
      });

      // clear form
      setNote("");
      setLabel("");
      setEmojiScore(null);
      setListScore(null);
      setMsg(null);

      // show thank-you screen then navigate to journey
      setShowThanks(true);
      setTimeout(() => {
        navigate("/journey");
      }, 3000);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setSending(false);
    }
  }

  // ===== special "Thank You" screen =====
  if (showThanks) {
    return (
      <div style={screenStyle}>
        <div style={phoneStyle}>
          <div style={thankScreenStyle}>
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

            {/* loading dots under the circle */}
            <div style={dotsWrapperStyle}>
              <span style={{ ...dotBaseStyle, animationDelay: "0s" }} />
              <span style={{ ...dotBaseStyle, animationDelay: "0.2s" }} />
              <span style={{ ...dotBaseStyle, animationDelay: "0.4s" }} />
            </div>

            {/* keyframes for the dots animation */}
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
      </div>
    );
  }

  // ===== normal screen =====
  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* HEADER (centered) */}
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
            <span style={headerTitleStyle}>Check in</span>
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

        {/* CONTENT */}
        <div style={contentStyle}>
          {/* NOTE CARD */}
          <div style={card2}>
            <div style={labelStyle}>How do you feel today?</div>

            <textarea
              style={{
                ...inputStyle,
                minHeight: 52,      // ~2 lines height
                resize: "none",     // optional: prevent dragging
                paddingTop: 10,
                paddingBottom: 10,
                lineHeight: 1.4,
              }}
              rows={2}
              placeholder="Tell us in your own words"
              value={note}
              onChange={handleNoteChange}
            />
          </div>


          {/* EMOJI CARD */}
          <div style={card}>
            <div style={labelStyle}>
              Or choose an emoji that reflects your feeling
            </div>
            <div style={emojiRow}>
              {emojiScale.map((item) => (
                <button
                  key={item.v}
                  type="button"
                  style={emojiBtn(emojiScore === item.v)}
                  onClick={() => handleEmojiClick(item.v)}
                  aria-label={`score-${item.v}`}
                >
                  {item.e}
                </button>
              ))}
            </div>
            {currentEmoji && (
              <div style={emojiMeaningStyle}>
                You selected: <strong>{currentEmoji.meaning}</strong> (
                {currentEmoji.v}/10)
              </div>
            )}
          </div>

          {/* SELECT CARD */}
          <div style={card}>
            <div style={labelStyle}>Or choose a feeling from the list</div>
            <select
              style={{ ...inputStyle, background: "#fff" }}
              value={label}
              onChange={handleLabelChange}
            >
              <option value="">— Select feeling —</option>
              <option value="anxious">Anxious</option>
              <option value="stressed">Stressed</option>
              <option value="tired">Tired</option>
              <option value="calm">Calm</option>
              <option value="excited">Excited</option>
              <option value="happy">Happy</option>
            </select>

            {msg && (
              <div style={{ marginTop: 8, color: "#3565AF", fontWeight: 600 }}>
                {msg}
              </div>
            )}
          </div>

          {/* ACTIONS */}
          <div style={actionsRow}>
            <button
              type="button"
              style={pillBtn}
              onClick={clearAll}
              title="Clear all fields"
            >
              Cancel
            </button>

            <button
              type="button"
              style={{
                ...pillBtn,
                opacity: sending || !anyFieldFilled ? 0.7 : 1,
                cursor: sending || !anyFieldFilled ? "not-allowed" : "pointer",
              }}
              disabled={sending || !anyFieldFilled}
              onClick={sendCheckin}
              title={
                !anyFieldFilled ? "Fill note, emoji or feeling" : "Send check-in"
              }
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        {/* BOTTOM NAV */}
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

export default CheckInPage;
