// react-app/src/pages/MoodTrackPage.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { getMoodSeries, type SeriesPoint } from "../api/auth";
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";

const MoodTrackPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  // ---------- layout styles ----------
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
    borderRadius: 0, // ⬅️ rectangle
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    position: "relative",
  };

  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 18,
    paddingBottom: 14,
    paddingInline: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative", // ⬅️ no rounded bottom
    height: 45,
  };

  const iconBtn: React.CSSProperties = {
    position: "absolute",
    top: 12,
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
    gap: 4,
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
    fontSize: 26,
    color: "#5F8DD0",
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: BLUE,
    padding: "14px 0 16px 0", // ⬅️ smaller bottom padding
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    overflowY: "auto",
    overflowX: "hidden",
  };
  const contentInner: React.CSSProperties = {
    width: "92%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const sectionCard: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: "14px 14px 16px 14px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
  };
  const sectionTitle: React.CSSProperties = {
    fontWeight: 800,
    color: "#25364d",
  };
  const sectionNote: React.CSSProperties = {
    fontSize: 12,
    color: "#41536b",
    marginTop: 4,
    marginBottom: 10,
  };

  // bottom nav (rectangle like Journey)
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
    bottom: 70, // a bit above bottom nav
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

  // ---------- data ----------
  const [today, setToday] = useState<SeriesPoint[] | null>(null);
  const [raw7, setRaw7] = useState<SeriesPoint[] | null>(null);
  const [raw14, setRaw14] = useState<SeriesPoint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 🔼 state + ref for scroll-top visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const [s1, s7, s14] = await Promise.all([
          getMoodSeries(1),
          getMoodSeries(7),
          getMoodSeries(14),
        ]);
        setToday(sortAsc(s1));
        setRaw7(sortAsc(s7));
        setRaw14(sortAsc(s14));
      } catch (e: any) {
        setErr(e?.message || "Failed to load charts");
      }
    })();
  }, []);

  // ---------- helpers ----------
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
      // before pushing, compute the score
      const score =
        map.has(iso) ? (map.get(iso) as number | null) : null;

      out.push({
        date: iso,
        avg_score: score,
        value: score ?? 0,   // SeriesPoint.value required as number
      });
    }
    return out;
  }

  const series7 = useMemo(() => normalizeToEndingToday(raw7, 7), [raw7]);
  const series14 = useMemo(() => normalizeToEndingToday(raw14, 14), [raw14]);
  const todayPoint = useMemo(
    () => (today && today.length ? today[0] : null),
    [today]
  );

  function TodayGauge({ point }: { point: SeriesPoint | null }) {
    const max = 10;
    const v = point?.avg_score ?? 0;
    const pct = Math.max(0, Math.min(100, (v / max) * 100));
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 54,
            height: 200,
            borderRadius: 28,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(220,226,236,0.9))",
            boxShadow: "inset 0 2px 10px rgba(0,0,0,0.12)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 6,
              height: `calc(${pct}% - 16px)`,
              borderRadius: 4,
              background:
                "linear-gradient(180deg, rgba(107,167,230,0.6), rgba(57,112,170,0.9))",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: `calc(${pct}% - 16px)`,
              left: "50%",
              transform: "translate(-50%, 0)",
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "linear-gradient(180deg,#FFA94D,#FF7A1A)",
              boxShadow: "0 8px 14px rgba(0,0,0,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {v.toFixed(1)}
          </div>
        </div>

        <div>
          <div style={{ color: "#41536b", fontWeight: 700, marginBottom: 6 }}>
            Average mood today
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#132238" }}>
            {v.toFixed(1)} <span style={{ opacity: 0.75 }}>/ 10</span>
          </div>
          <div style={{ color: "#6b7a8b", marginTop: 4, fontSize: 13 }}>
            Based on today’s check-ins.
          </div>
          <div style={{ color: "#6b7a8b", marginTop: 4, fontSize: 12 }}>
            Date: {point ? prettyDayUTC(point.date) : "—"}
          </div>
        </div>
      </div>
    );
  }

  function ThermometerGrid({
    data,
    compact = false,
  }: {
    data: SeriesPoint[];
    compact?: boolean;
  }) {
    const max = 10;
    const tubeW = compact ? 14 : 28;
    const tubeH = compact ? 110 : 140;
    const tubeR = Math.round(tubeW / 2);
    const bubble = compact ? 18 : 26;
    const bubbleR = Math.round(bubble / 2);
    const gap = compact ? 4 : 8;
    const labelSize = compact ? 8 : 10;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.length}, 1fr)`,
          gap,
          alignItems: "end",
        }}
      >
        {data.map((d, i) => {
          const v = d.avg_score ?? null;
          const pct =
            v == null ? 0 : Math.max(0, Math.min(100, (v / max) * 100));
          return (
            <div key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  margin: "0 auto",
                  width: tubeW,
                  height: tubeH,
                  borderRadius: tubeR,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(220,226,236,0.95))",
                  boxShadow: "inset 0 2px 10px rgba(0,0,0,0.12)",
                  position: "relative",
                }}
                title={`${d.date}: ${v ?? "—"}`}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: compact ? 3 : 4,
                    height: `calc(${pct}% - ${bubble}px)`,
                    borderRadius: 4,
                    background:
                      "linear-gradient(180deg, rgba(107,167,230,0.6), rgba(57,112,170,0.9))",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: v == null ? 8 : `calc(${pct}% - ${bubbleR}px)`,
                    left: "50%",
                    transform: "translate(-50%, 0)",
                    width: bubble,
                    height: bubble,
                    borderRadius: bubbleR,
                    background:
                      v == null
                        ? "linear-gradient(180deg,#E5E7EB,#D1D5DB)"
                        : "linear-gradient(180deg,#FFA94D,#FF7A1A)",
                    color: v == null ? "#6B7280" : "white",
                    boxShadow: "0 6px 12px rgba(0,0,0,0.16)",
                    fontWeight: 800,
                    fontSize: compact ? 10 : 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {v == null ? "—" : v.toFixed(1)}
                </div>
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: labelSize,
                  color: "#4B5563",
                }}
              >
                {prettyDayUTC(d.date)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const avg7 =
    series7.length === 0
      ? null
      : (() => {
          const vals = series7
            .map((p) => p.avg_score)
            .filter((x) => typeof x === "number") as number[];
          return vals.length
            ? vals.reduce((a, b) => a + b, 0) / vals.length
            : null;
        })();
  const avg14 =
    series14.length === 0
      ? null
      : (() => {
          const vals = series14
            .map((p) => p.avg_score)
            .filter((x) => typeof x === "number") as number[];
          return vals.length
            ? vals.reduce((a, b) => a + b, 0) / vals.length
            : null;
        })();

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
            <span style={headerTitleStyle}>Mood Track</span>
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
          <div style={contentInner}>
            {err && (
              <div
                style={{
                  color: "#fde2e1",
                  background: "#8b2b2b",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                {err}
              </div>
            )}

            {/* TODAY */}
            <div style={sectionCard}>
              <div style={sectionTitle}>Your mood — Today</div>
              <div style={sectionNote}>Quick snapshot of your average mood.</div>
              <TodayGauge point={todayPoint} />
            </div>

            {/* LAST 7 DAYS */}
            <div style={sectionCard}>
              <div style={sectionTitle}>
                Your mood — last 7 days{" "}
                <span style={{ fontWeight: 600, color: "#516686" }}>
                  {avg7 != null ? `(7-day avg: ${avg7.toFixed(1)} / 10)` : ""}
                </span>
              </div>
              <div style={sectionNote}>
                {series7.length
                  ? `${prettyDayUTC(series7[0].date)} — ${prettyDayUTC(
                      series7[series7.length - 1].date
                    )}`
                  : "—"}
              </div>
              <ThermometerGrid data={series7} />
            </div>

            {/* LAST 14 DAYS */}
            <div style={sectionCard}>
              <div style={sectionTitle}>
                Your mood — last 14 days{" "}
                <span style={{ fontWeight: 600, color: "#516686" }}>
                  {avg14 != null ? `(14-day avg: ${avg14.toFixed(1)} / 10)` : ""}
                </span>
              </div>
              <div style={sectionNote}>
                {series14.length
                  ? `${prettyDayUTC(series14[0].date)} — ${prettyDayUTC(
                      series14[series14.length - 1].date
                    )}`
                  : "—"}
              </div>
              <ThermometerGrid data={series14} compact />
            </div>

            <button
              type="button"
              onClick={() => navigate("/analyze")}
              style={{
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                backgroundColor: "#2a5f97ff",
                color: CREAM,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
              }}
            >
              Analyze your mood
            </button>
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

export default MoodTrackPage;
