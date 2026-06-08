// react-app/src/pages/BreathTrainingPage.tsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";
// Images for each exercise
import breathing874Img from "../assets/breathing-874.jpg";            // 1
import diaphragmaticImg from "../assets/diaphragmatic-breathing.jpg"; // 2
import boxBreathingImg from "../assets/box-breathing.jpg";            // 3
import mindfulBreathingImg from "../assets/mindful-breathing.jpg";    // 4
import alternateNostrilImg from "../assets/alternate-nostril.jpg";    // 5
import guidedBreathingImg from "../assets/guided-breathing.jpg";      // 6

interface BreathExercise {
  key: string;
  title: string;
  route: string;
  image: string;
}

const EXERCISES: BreathExercise[] = [
  {
    key: "874",
    title: "4- 7- 8 Breathing",
    route: "/breathing/8-7-4",
    image: breathing874Img,
  },
  {
    key: "diaphragmatic",
    title: "Diaphragmatic (Belly) Breathing",
    route: "/breathing/diaphragmatic",
    image: diaphragmaticImg,
  },
  {
    key: "box",
    title: "Box Breathing (Square Breathing)",
    route: "/breathing/box",
    image: boxBreathingImg,
  },
  {
    key: "counting",
    title: "Counting Breaths (Rhythmic)",
    route: "/breathing/counting",
    image: mindfulBreathingImg,
  },
  {
    key: "nostril",
    title: "Alternate Nostril Breathing",
    route: "/breathing/alternate-nostril",
    image: alternateNostrilImg,
  },
  {
    key: "guided",
    title: "Guided Visualization Breathing",
    route: "/breathing/visualization",
    image: guidedBreathingImg,
  },
];

const BreathTrainingPage: React.FC = () => {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState<boolean>(true);

  // 🔼 scroll-to-top state + ref
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const PURPLE = "#5B5FEF";

  // ===== LAYOUT =====
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

  // ===== HEADER =====
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
    height: 50,
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

  // ===== CONTENT =====
  const contentStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: BLUE,
    padding: "0 20px 16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    color: "#111827",
    overflowY: "auto",
  };

  // small intro card at the top
  const introCardStyle: React.CSSProperties = {
    marginTop: 16,
    borderRadius: 22,
    padding: "16px 16px 18px 16px",
    boxShadow: "0 8px 20px rgba(15,23,42,0.35)",
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.7)",
    backgroundColor: "transparent",
    backdropFilter: "blur(4px)",
    position: "relative",
  };

  const introTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    marginBottom: 6,
    color: "#f9fafb",
  };

  const introTextStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: 1.4,
    color: "#e5e7eb",
  };

  const introCloseButtonStyle: React.CSSProperties = {
    position: "absolute",
    top: 8,
    right: 10,
    border: "none",
    background: "transparent",
    color: "#f9fafb",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
  };

  const introReopenButtonStyle: React.CSSProperties = {
    marginTop: 12,
    alignSelf: "center",
    borderRadius: 999,
    border: "none",
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#F4C58F",
    color: "#3565AF",
    boxShadow: "0 4px 10px rgba(15,23,42,0.3)",
  };

  const sectionTitleStyle: React.CSSProperties = {
    marginTop: 18,
    fontSize: 18,
    fontWeight: 700,
    color: "#f9fafb",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 15,
    color: "#e5e7eb",
    marginBottom: 4,
  };

  const listStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  };

  const exerciseCardButton: React.CSSProperties = {
    width: "100%",
    border: "none",
    padding: 0,
    background: "transparent",
    cursor: "pointer",
  };

  const exerciseCard: React.CSSProperties = {
    width: "100%",
    backgroundColor: CREAM,
    borderRadius: 22,
    padding: "14px 14px 16px 14px",
    boxShadow: "0 8px 20px rgba(15,23,42,0.18)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    boxSizing: "border-box",
  };

  // Box height follows image height
  const exerciseImageBox: React.CSSProperties = {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    marginBottom: 10,
  };

  const exerciseImageStyle: React.CSSProperties = {
    width: "100%",
    height: "auto",
    display: "block",
  };

  const exerciseTitle: React.CSSProperties = {
    backgroundColor: PURPLE,
    borderRadius: 999,
    padding: "8px 18px",
    color: "#f9fafb",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
    maxWidth: "100%",
    wordWrap: "break-word",
  };

  // ===== BOTTOM NAV =====
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

  // 🔼 scroll-to-top button style
  const scrollTopBtnStyle: React.CSSProperties = {
    position: "absolute",
    right: 20,
    bottom: 70,
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "none",
    backgroundColor: "#3970aaff",
    color: CREAM,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    zIndex: 10,
  };

  const handleTileClick = (route: string) => {
    navigate(route);
  };

  // 🔼 scroll to top handler
  const handleScrollTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* HEADER */}
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
            <span style={headerTitleStyle}>Breath Training</span>
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
        <div
          style={contentStyle}
          ref={contentRef}
          onScroll={(e) => {
            setShowScrollTop(e.currentTarget.scrollTop > 60);
          }}
        >
          {/* Intro explanation card (collapsible) */}
          {showIntro && (
            <div style={introCardStyle}>
              <button
                type="button"
                style={introCloseButtonStyle}
                onClick={() => setShowIntro(false)}
                aria-label="Hide introduction"
                title="Hide introduction"
              >
                ✕
              </button>
              <div style={introTitleStyle}>🫁 Breath in, Breath out 🫁</div>
              <div style={introTextStyle}>
                A gentle pause for your mind and body. Breathing exercises can
                calm your nervous system, release built-up stress, and help you
                regain emotional balance. They don’t require much time — just a
                few minutes of focused breathing can make a difference. Start
                with 2–5 minutes a day, and increase the duration as it becomes
                more comfortable. You can practice multiple times throughout the
                day or whenever you feel the need. Select a technique below and
                follow the guided steps at your own pace.
              </div>
            </div>
          )}

          {!showIntro && (
            <button
              type="button"
              style={introReopenButtonStyle}
              onClick={() => setShowIntro(true)}
            >
              💡 Show Breath Training intro
            </button>
          )}

          {/* Section title + description */}
          <div>
            <div style={sectionTitleStyle}>Choose a breathing exercise</div>
            <div style={subtitleStyle}>
              For more about any exercise from the exercises below tab on it and
              you will be ready to go.
            </div>
          </div>

          {/* List of exercises */}
          <div style={listStyle}>
            {EXERCISES.map((ex) => (
              <button
                key={ex.key}
                type="button"
                style={exerciseCardButton}
                onClick={() => handleTileClick(ex.route)}
              >
                <div style={exerciseCard}>
                  <div style={exerciseImageBox}>
                    <img
                      src={ex.image}
                      alt={ex.title}
                      style={exerciseImageStyle}
                    />
                  </div>
                  <div style={exerciseTitle}>{ex.title}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 🔼 SCROLL TO TOP BUTTON */}
        {showScrollTop && (
          <button
            type="button"
            style={scrollTopBtnStyle}
            onClick={handleScrollTop}
            aria-label="Back to top"
            title="Back to top"
          >
            ↑
          </button>
        )}

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

export default BreathTrainingPage;
