import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { listPsyClients, type PsyClient } from "../api/auth";
import PsyAvailabilityButton from "../components/PsyAvailabilityButton";

const PsychologistClientsPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BTN = "#2a5f97";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<PsyClient[]>([]);
  const [query, setQuery] = useState("");

  // ============== helpers ==============
  function genderLabel(g: number | null | undefined) {
    if (g === 1) return "Female";
    if (g === 2) return "Male";
    if (g === 3) return "Other";
    return "N/A";
  }

  function fmt(dt: string | null) {
    if (!dt) return "—";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString();
  }

  // ============== fetch ==============
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listPsyClients();
        setClients(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load clients");
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // ============== search ==============
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;

    const terms = q.split(/\s+/).filter(Boolean);

    return clients.filter((c) => {
      const haystack = [
        c.username ?? "",
        c.email ?? "",
        c.age != null ? String(c.age) : "",
        genderLabel(c.gender),
      ]
        .join(" ")
        .toLowerCase();

      return terms.every((t) => haystack.includes(t));
    });
  }, [clients, query]);

  // ============== styles ==============
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

  // header
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

  const brandSubtitle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 650,
    fontSize: 15,
    whiteSpace: "nowrap",
  };

  // content
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

  const searchWrap: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
  };

  const searchInputWrap: React.CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    padding: "12px 14px",
    boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
    border: "1px solid rgba(53,101,175,0.10)",
  };

  const searchStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    color: "#111827",
  };

  const clearBtn: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "none",
    cursor: query.trim() ? "pointer" : "default",
    backgroundColor: "rgba(53,101,175,0.12)",
    color: "#3565AF",
    fontWeight: 800,
    boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
    opacity: query.trim() ? 1 : 0.5,
  };

  const listGap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  // ✅ FIXED CLIENT CARD DESIGN (clean + not heavy)
  const card: React.CSSProperties = {
    background: "linear-gradient(180deg, rgba(245,233,217,1) 0%, rgba(245,233,217,0.92) 100%)",
    borderRadius: 22,
    padding: 14,
    color: "#0f172a",
    boxShadow: "0 14px 30px rgba(15,23,42,0.16)",
    border: "1px solid rgba(53,101,175,0.14)",
    position: "relative",
    overflow: "hidden",
  };

  // subtle blue accent strip on the left
  const accentStrip: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    background: "rgba(53,101,175,0.35)",
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginLeft: 4,
  };

  const nameStyle: React.CSSProperties = {
    margin: 0,
    fontWeight: 700,
    fontSize: 16,
    color: "#0f172a",
    lineHeight: 1.15,
  };

  const badge: React.CSSProperties = {
    backgroundColor: "rgba(42,95,151,0.12)",
    color: "#1f4d7a",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    border: "1px solid rgba(42,95,151,0.18)",
  };

  // info rows as “label + value” rows (no grid stiffness)
  const infoList: React.CSSProperties = {
    marginTop: 10,
    marginLeft: 4,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  const infoRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "baseline",
    flexWrap: "wrap",
    fontSize: 13,
    lineHeight: 1.35,
    color: "#111827",
  };

  const keyStyle: React.CSSProperties = {
    color: "#3565AF",
    fontWeight: 600,
    minWidth: 110,
  };

  const valStyle: React.CSSProperties = {
    fontWeight: 500,
    opacity: 0.95,
    wordBreak: "break-word",
    flex: "1 1 160px",
  };

  const actionRow: React.CSSProperties = {
    marginTop: 12,
    marginLeft: 4,
    display: "flex",
    gap: 10,
  };

  const primaryBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 12px",
    fontWeight: 700,
    cursor: "pointer",
    backgroundColor: BTN,
    color: CREAM,
    width: "100%",
    boxShadow: "0 10px 18px rgba(0,0,0,0.14)",
    whiteSpace: "nowrap",
  };

  // bottom nav
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
    fontWeight: 800,
    color: "#3565AF",
    cursor: "pointer",
    padding: "8px 10px",
    borderRadius: 999,
    backgroundColor: "transparent",
    border: "none",
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={headerRow}>
            <button type="button" style={iconBtn} onClick={() => navigate("/psy")} aria-label="Home" title="Home">
              🏠
            </button>

            <div style={brandRow}>
              <span style={tinyLogoStyle}>
                <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
              </span>
              <div style={brandTextWrap}>
                <div style={brandTitle}>Mendly App</div>
                <div style={brandSubtitle}>My Clients</div>
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
          <div style={heroCard}>
            <div style={searchWrap}>
              <div style={searchInputWrap}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>🔎</span>
                <input
                  style={searchStyle}
                  placeholder="Search by username or email..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <button
                type="button"
                style={clearBtn}
                onClick={() => setQuery("")}
                aria-label="Clear search"
                title="Clear"
                disabled={!query.trim()}
              >
                ✕
              </button>
            </div>
          </div>

          {loading && (
            <div style={{ color: "white", textAlign: "center", marginTop: 4, fontWeight: 700 }}>
              Loading...
            </div>
          )}

          {error && (
            <div style={{ color: "white", textAlign: "center", marginTop: 4, fontWeight: 700 }}>
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ color: "white", textAlign: "center", marginTop: 4, fontWeight: 700 }}>
              No clients found{query.trim() ? ` for “${query.trim()}”.` : " yet."}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div style={listGap}>
              {filtered.map((c) => (
                <div key={c.user_id} style={card}>
                  <div style={accentStrip} />

                  <div style={topRow}>
                    <h3 style={nameStyle}>{c.username}</h3>
                    <span style={badge}>
                      {c.appointments_count}{" "}
                      {c.appointments_count === 1 ? "session" : "sessions"}
                    </span>
                  </div>

                  <div style={infoList}>
                    <div style={infoRow}>
                      <div style={keyStyle}>Email</div>
                      <div style={valStyle}>{c.email ?? "—"}</div>
                    </div>

                    <div style={infoRow}>
                      <div style={keyStyle}>Age</div>
                      <div style={valStyle}>{c.age ?? "—"}</div>
                    </div>

                    <div style={infoRow}>
                      <div style={keyStyle}>Gender</div>
                      <div style={valStyle}>{genderLabel(c.gender)}</div>
                    </div>

                    <div style={infoRow}>
                      <div style={keyStyle}>Last appointment</div>
                      <div style={valStyle}>{fmt(c.last_appointment_at)}</div>
                    </div>
                  </div>

                  <div style={actionRow}>
                    <button
                      type="button"
                      style={primaryBtn}
                      onClick={() =>
                        navigate(`/psy/sessions?client=${encodeURIComponent(c.user_id)}`)
                      }
                    >
                      View Appointments
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        <div style={bottomNav}>
          <button type="button" style={navItem} onClick={() => navigate("/psy/profile")} aria-label="Profile">
            <span style={{ fontSize: 20 }}>👤</span> Profile
          </button>

          <PsyAvailabilityButton style={navItem} />
        </div>
      </div>
    </div>
  );
};

export default PsychologistClientsPage;
