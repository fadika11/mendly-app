import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import {
  listPsyAppointments,
  type PsyAppointment,
} from "../api/auth";
import PsyAvailabilityButton from "../components/PsyAvailabilityButton";

const PsychologistSessionsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BTN = "#2a5f97";
  const BTN_TXT = "#f5e9d9";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<PsyAppointment[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");


  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openIntake, setOpenIntake] = useState<null | { title: string; json: string | null }>(null);

  const qs = new URLSearchParams(location.search);
  const clientParam = qs.get("client");

  const screenStyle: React.CSSProperties = {
    height: "100vh",
    width: "100vw",
    display: "flex",
    justifyContent: "center",
    backgroundColor: BLUE,
    fontFamily: '"Poppins", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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

  const headerStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    padding: "20px 16px 16px",
    height: 40,
  };

  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    height: 44,
  };

  const roundBtn: React.CSSProperties = {
    position: "absolute",
    top: 0,
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#3970aaff",
    color: CREAM,
    fontSize: 20,
    cursor: "pointer",
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

  const brandTextWrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1.05,
  };

  const brandTitle: React.CSSProperties = {
    color: "#3565AF",
    fontWeight: 700,
    fontSize: 18,
  };

  const brandSubtitle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 640,
    fontSize: 15,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
  };

  const panel: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 18,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const inputStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    borderRadius: 999,
    padding: "10px 12px",
    backgroundColor: "rgba(255,255,255,0.9)",
    fontSize: 13,
    flex: 1,
  };

  const selectStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    borderRadius: 999,
    padding: "10px 12px",
    backgroundColor: "rgba(255,255,255,0.9)",
    fontSize: 13,
    cursor: "pointer",
    minWidth: 100,
  };

  const pillBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    backgroundColor: BTN,
    color: BTN_TXT,
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  };

  const card: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 14,
    color: "#0f172a",
    boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const label: React.CSSProperties = {
    fontWeight: 900,
    color: "#3565AF",
    fontSize: 12,
    marginBottom: 3,
  };

  const actionRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
  };

  const smallBtn: React.CSSProperties = {
    flex: 1,
    border: "none",
    borderRadius: 999,
    padding: "10px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    backgroundColor: BTN,
    color: CREAM,
  };

  const ghostBtn: React.CSSProperties = {
    ...smallBtn,
    backgroundColor: "rgba(53,101,175,0.14)",
    color: "#3565AF",
  };

  const bottomNav: React.CSSProperties = {
    backgroundColor: CREAM,
    padding: "12px 12px",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
  };

  const navItem: React.CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 14,
    fontWeight: 800,
    color: "#3565AF",
    cursor: "pointer",
    border: "none",
    backgroundColor: "transparent",
  };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };

  const modalStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85vh",
    overflowY: "auto",
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const modalTitle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 900,
    color: "#3565AF",
    textAlign: "center",
  };

  function badgeStyle(status: string): React.CSSProperties {
    const s = (status || "").toLowerCase();
    const bg =
      s === "approved"
        ? "#16a34a"
        : s === "requested"
        ? "#f59e0b"
        : s === "rejected" || s === "canceled"
        ? "#ef4444"
        : s === "completed"
        ? "#334155"
        : "#64748b";

    return {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 999,
      padding: "6px 10px",
      fontWeight: 900,
      fontSize: 11,
      backgroundColor: bg,
      color: "white",
      whiteSpace: "nowrap",
      minWidth: 92,
      textTransform: "capitalize",
    };
  }

  function genderLabel(g: number | null | undefined) {
    if (g === 1) return "Female";
    if (g === 2) return "Male";
    if (g === 3) return "Other";
    return "N/A";
  }

  function formatDbDateTime(dt: string | null) {
    if (!dt) return "—";

    const raw = String(dt);

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
    if (match) {
      const [, y, m, d, hh, mm] = match;
      return `${d}/${m}/${y}, ${hh}:${mm}`;
    }

    return raw;
  }

  function safePretty(jsonStr: string | null) {
    if (!jsonStr) return "No intake attached.";
    try {
      const obj = JSON.parse(jsonStr);
      return JSON.stringify(obj, null, 2);
    } catch {
      return jsonStr;
    }
  }

  async function loadAppointments() {
    try {
      setLoading(true);
      setError(null);
      const data = await listPsyAppointments();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAppointments();
  }, []);

  const filtered = useMemo(() => {
    let arr = items;

    if (clientParam) {
      arr = arr.filter((x) => x.client_user_id === clientParam);
    }

    if (statusFilter !== "all") {
      arr = arr.filter((x) => (x.status || "").toLowerCase() === statusFilter);
    }

    const q = search.trim().toLowerCase();

    if (q) {
      arr = arr.filter(
        (x) =>
          x.client_username.toLowerCase().includes(q) ||
          x.client_email.toLowerCase().includes(q) ||
          (x.notes || "").toLowerCase().includes(q)
      );
    }

    return arr;
  }, [items, clientParam, statusFilter, search]);

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        <div style={headerStyle}>
          <div style={headerRow}>
            <button style={{ ...roundBtn, left: 0 }} onClick={() => navigate("/psy")}>
              🏠
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={tinyLogoStyle}>
                <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
              </span>
              <div style={brandTextWrap}>
                <div style={brandTitle}>Mendly App</div>
                <div style={brandSubtitle}>My Sessions</div>
              </div>
            </div>

            <button
              style={{ ...roundBtn, right: 0 }}
              onClick={() => {
                localStorage.removeItem("access_token");
                navigate("/login");
              }}
            >
              🚪
            </button>
          </div>
        </div>

        <div style={contentStyle}>
          <div style={panel}>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                style={inputStyle}
                placeholder="Search client / email / notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                style={selectStyle}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="requested">Requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="canceled">Canceled</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {clientParam && (
              <button style={pillBtn} onClick={() => navigate("/psy/sessions", { replace: true })}>
                Clear client filter
              </button>
            )}
          </div>

          {loading && (
            <div style={{ color: "white", textAlign: "center", marginTop: 8 }}>
              Loading...
            </div>
          )}

          {error && (
            <div style={{ color: "white", textAlign: "center", marginTop: 8 }}>
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ color: "white", textAlign: "center", marginTop: 8 }}>
              No appointments found.
            </div>
          )}

          {filtered.map((a) => {
            const isOpen = expandedId === a.appointment_id;

            return (
              <div key={a.appointment_id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900 }}>
                      {formatDbDateTime(a.start_at)}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12 }}>
                      <b>Client:</b> {a.client_username} • {a.client_email}
                    </div>
                  </div>

                  <span style={badgeStyle(a.status)}>{a.status}</span>
                </div>

                <div style={{ height: 1, backgroundColor: "rgba(0,0,0,0.08)" }} />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div style={{ backgroundColor: "rgba(255,255,255,0.65)", borderRadius: 14, padding: 10 }}>
                    <div style={label}>Client Info</div>
                    <div>
                      <b>Age:</b> {a.client_age ?? "—"}
                    </div>
                    <div>
                      <b>Gender:</b> {genderLabel(a.client_gender)}
                    </div>
                  </div>

                  <div style={{ backgroundColor: "rgba(255,255,255,0.65)", borderRadius: 14, padding: 10 }}>
                    <div style={label}>Appointment</div>
                    <div>
                      <b>Intake:</b> {a.intake_id ? "Attached" : "None"}
                    </div>
                    <div>
                      <b>Notes:</b> {a.notes ? "Yes" : "No"}
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: "rgba(255,255,255,0.75)", borderRadius: 14, padding: 10 }}>
                  <div style={label}>Notes</div>
                  {a.notes || "—"}
                </div>

                <div style={actionRow}>
                  <button
                    style={a.intake_id ? smallBtn : { ...smallBtn, opacity: 0.55, cursor: "not-allowed" }}
                    disabled={!a.intake_id}
                    onClick={() =>
                      setOpenIntake({
                        title: `${a.client_username} • ${formatDbDateTime(a.start_at)}`,
                        json: a.intake_answers_json,
                      })
                    }
                  >
                    View Intake
                  </button>

                  <button style={ghostBtn} onClick={() => setExpandedId(isOpen ? null : a.appointment_id)}>
                    {isOpen ? "Hide Details" : "More Details"}
                  </button>
                </div>

                {isOpen && (
                  <div style={{ backgroundColor: "rgba(255,255,255,0.65)", borderRadius: 14, padding: 10 }}>
                    <div style={label}>Details</div>
                    <div>
                      <b>Appointment ID:</b> {a.appointment_id}
                    </div>
                    <div>
                      <b>Client ID:</b> {a.client_user_id}
                    </div>
                    <div>
                      <b>Created:</b> {formatDbDateTime(a.created_at)}
                    </div>
                    <div>
                      <b>Updated:</b> {formatDbDateTime(a.updated_at)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {openIntake && (
          <div onClick={() => setOpenIntake(null)} style={overlayStyle}>
            <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
              <div style={modalTitle}>Intake • {openIntake.title}</div>

              <pre
                style={{
                  backgroundColor: "rgba(255,255,255,0.75)",
                  borderRadius: 12,
                  padding: 12,
                  maxHeight: 360,
                  overflow: "auto",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {safePretty(openIntake.json)}
              </pre>

              <button style={pillBtn} onClick={() => setOpenIntake(null)}>
                Close
              </button>
            </div>
          </div>
        )}

        <div style={bottomNav}>
          <button style={navItem} onClick={() => navigate("/psy/profile")}>
            👤 Profile
          </button>

          <PsyAvailabilityButton style={navItem} />
        </div>
      </div>
    </div>
  );
};

export default PsychologistSessionsPage;