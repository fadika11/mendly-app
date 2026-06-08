// react-app/src/pages/PsychologistRequestsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { Capacitor } from "@capacitor/core";
import PsyAvailabilityButton from "../components/PsyAvailabilityButton";

const isNative = Capacitor.isNativePlatform?.() ?? false;

const API_BASE = isNative
  ? "http://10.0.2.2:8000" // Android emulator -> host
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

type Appointment = {
  appointment_id: string;
  client_user_id: string;
  client_username?: string | null;
  client_email?: string | null;
  psychologist_user_id: string;
  intake_id?: string | null;
  start_at: string;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

const PsychologistRequestsPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BTN = "#2a5f97";

  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ===== modals =====
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeErr, setIntakeErr] = useState<string | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, any>>({});

  const prettyIntake = useMemo(() => {
    const entries = Object.entries(intakeAnswers || {});
    return entries.length ? entries : [];
  }, [intakeAnswers]);

  function fmt(dt: string) {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString();
  }

  // lock background scroll when any modal is open
  useEffect(() => {
    const anyOpen = detailsOpen || intakeOpen;
    const prev = document.body.style.overflow;
    if (anyOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailsOpen, intakeOpen]);

  // ESC to close modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (intakeOpen) setIntakeOpen(false);
        else if (detailsOpen) setDetailsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailsOpen, intakeOpen]);

  // ===== fetch list =====
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setErr(null);

        const token = localStorage.getItem("access_token");
        if (!token) return navigate("/login", { replace: true });

        const res = await fetch(`${API_BASE}/appointments/psy?status_filter=requested`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || "Failed to load requests.");
        }

        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load requests.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  // ===== actions =====
  const openDetails = (a: Appointment) => {
    setSelected(a);
    setNote(a.notes ?? "");
    setErr(null);
    setDetailsOpen(true);
    setIntakeOpen(false);
    setIntakeErr(null);
    setIntakeAnswers({});
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelected(null);
    setNote("");
  };

  const closeIntake = () => {
    setIntakeOpen(false);
    setIntakeErr(null);
    setIntakeAnswers({});
  };

  const updateStatus = async (appointmentId: string, status: "approved" | "rejected") => {
    try {
      setSaving(true);
      setErr(null);

      const token = localStorage.getItem("access_token");
      if (!token) return navigate("/login", { replace: true });

      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          notes: note.trim() ? note.trim() : null,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to update appointment status.");
      }

      // remove from list + close modals
      setItems((prev) => prev.filter((x) => x.appointment_id !== appointmentId));
      closeIntake();
      closeDetails();
    } catch (e: any) {
      setErr(e?.message || "Failed to update appointment status.");
    } finally {
      setSaving(false);
    }
  };

  const loadIntake = async (intakeId: string) => {
    try {
      setIntakeLoading(true);
      setIntakeErr(null);
      setIntakeAnswers({});

      const token = localStorage.getItem("access_token");
      if (!token) return navigate("/login", { replace: true });

      const res = await fetch(`${API_BASE}/appointments/intake/${intakeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to load intake.");
      }

      const data = await res.json();
      const raw = data?.answers_json || "{}";

      let parsed: any = {};
      try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        parsed = { Error: "Could not parse intake JSON." };
      }

      setIntakeAnswers(parsed || {});
      setIntakeOpen(true);
    } catch (e: any) {
      setIntakeErr(e?.message || "Failed to load intake.");
      setIntakeOpen(true);
    } finally {
      setIntakeLoading(false);
    }
  };

  // ===================== styles =====================
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
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  };

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
    fontWeight: 800,
    fontSize: 18,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const brandSubtitle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 650,
    fontSize: 14,
    whiteSpace: "nowrap",
  };

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

  const heroTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 15,
    fontWeight: 800,
    color: "rgba(255,255,255,0.95)",
  };

  const heroSub: React.CSSProperties = {
    marginTop: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.35,
  };

  const countBadge: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 999,
    backgroundColor: "rgba(53,101,175,0.10)",
    border: "1px solid rgba(53,101,175,0.16)",
    color: "#3565AF",
    fontWeight: 700,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  const listGap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const requestCard: React.CSSProperties = {
    background:
      "linear-gradient(180deg, rgba(245,233,217,1) 0%, rgba(245,233,217,0.92) 100%)",
    borderRadius: 22,
    padding: 14,
    color: "#0f172a",
    boxShadow: "0 14px 30px rgba(15,23,42,0.16)",
    border: "1px solid rgba(53,101,175,0.14)",
    position: "relative",
    overflow: "hidden",
  };

  const accentStrip: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    background: "rgba(53,101,175,0.35)",
  };

  const cardTopRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginLeft: 4,
  };

  const clientName: React.CSSProperties = {
    margin: 0,
    fontWeight: 800,
    fontSize: 15,
    color: "#0f172a",
    lineHeight: 1.2,
  };

  const statusPill = (kind: "requested" | "approved" | "rejected") =>
    ({
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 650,
      border: "1px solid rgba(15,23,42,0.10)",
      backgroundColor:
        kind === "approved"
          ? "rgba(31,122,74,0.12)"
          : kind === "rejected"
          ? "rgba(180,35,24,0.12)"
          : "rgba(42,95,151,0.12)",
      color:
        kind === "approved"
          ? "#14532d"
          : kind === "rejected"
          ? "#7f1d1d"
          : "#1f4d7a",
    }) as React.CSSProperties;

  const metaLine: React.CSSProperties = {
    marginTop: 8,
    marginLeft: 4,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    lineHeight: 1.35,
    color: "#111827",
  };

  const metaRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "baseline",
  };

  const metaKey: React.CSSProperties = {
    color: "#3565AF",
    fontWeight: 600,
    minWidth: 110,
  };

  const metaVal: React.CSSProperties = {
    fontWeight: 500,
    opacity: 0.95,
    wordBreak: "break-word",
    flex: "1 1 160px",
  };

  const primaryBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 12px",
    fontWeight: 800,
    cursor: "pointer",
    backgroundColor: BTN,
    color: CREAM,
    width: "100%",
    boxShadow: "0 10px 18px rgba(0,0,0,0.14)",
  };

  const rowBtns: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
    marginLeft: 4,
  };

  const approveBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 12px",
    fontWeight: 800,
    cursor: "pointer",
    backgroundColor: "#1f7a4a",
    color: "#f8fafc",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  const rejectBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 12px",
    fontWeight: 800,
    cursor: "pointer",
    backgroundColor: "#b42318",
    color: "#f8fafc",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  };

  const subtleBtn: React.CSSProperties = {
    borderRadius: 14,
    padding: "12px 12px",
    fontWeight: 700,
    cursor: "pointer",
    backgroundColor: "rgba(42,95,151,0.10)",
    color: "#1f4d7a",
    border: "1px solid rgba(42,95,151,0.18)",
    width: "100%",
  };

  // ===== modal styles =====
  const overlay: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    backdropFilter: "blur(8px)",
    padding: 14,
    boxSizing: "border-box",
  };

  const modal: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    maxHeight: "86%",
    background:
      "linear-gradient(145deg, #fef9c3 0%, #f5e9d9 38%, #e0ecff 100%)",
    borderRadius: 24,
    boxShadow: "0 22px 50px rgba(15,23,42,0.55)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.35)",
  };

  const modalHeader: React.CSSProperties = {
    padding: "14px 14px 12px",
    backgroundColor: "rgba(245,233,217,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottom: "1px solid rgba(53,101,175,0.12)",
  };

  const modalTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 15,
    fontWeight: 850,
    color: "#0f172a",
  };

  const modalClose: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    backgroundColor: "rgba(15,23,42,0.10)",
    color: "#0f172a",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const modalBody: React.CSSProperties = {
    padding: 14,
    overflowY: "auto",
    maxHeight: "calc(86vh - 120px)",
    boxSizing: "border-box",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 650,
    color: "#3565AF",
    marginBottom: 6,
  };

  const fieldBox: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(53,101,175,0.14)",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 500,
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 84,
    border: "none",
    outline: "none",
    background: "transparent",
    resize: "vertical",
    fontSize: 13,
    fontWeight: 500,
    color: "#0f172a",
    lineHeight: 1.4,
  };

  const modalBtnRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 12,
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

  // ===================== render =====================
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
                <div style={brandSubtitle}>Client Requests</div>
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
            <div style={heroTop}>
              <div>
                <p style={heroTitle}>Requests awaiting your decision</p>
                <div style={heroSub}>
                  Review details, optionally read the intake, and approve/reject.
                </div>
              </div>
              <div style={countBadge}>{items.length} pending</div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: CREAM, fontWeight: 700 }}>Loading…</div>
          ) : err ? (
            <div style={{ color: CREAM, fontWeight: 700 }}>{err}</div>
          ) : items.length === 0 ? (
            <div style={{ color: CREAM, fontWeight: 700 }}>No requests.</div>
          ) : (
            <div style={listGap}>
              {items.map((a) => (
                <div key={a.appointment_id} style={requestCard}>
                  <div style={accentStrip} />

                  <div style={cardTopRow}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={clientName}>{a.client_username || "Unknown client"}</h3>
                      {a.client_email ? (
                        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, opacity: 0.9 }}>
                          {a.client_email}
                        </div>
                      ) : null}
                    </div>

                    <div style={statusPill((a.status as any) || "requested")}>
                      {a.status || "requested"}
                    </div>
                  </div>

                  <div style={metaLine}>
                    <div style={metaRow}>
                      <div style={metaKey}>Requested time</div>
                      <div style={metaVal}>{fmt(a.start_at)}</div>
                    </div>

                    <div style={metaRow}>
                      <div style={metaKey}>Intake</div>
                      <div style={metaVal}>{a.intake_id ? "available" : "missing"}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, marginLeft: 4 }}>
                    <button type="button" style={primaryBtn} onClick={() => openDetails(a)}>
                      View request details
                    </button>
                  </div>

                  <div style={rowBtns}>
                    <button
                      type="button"
                      style={approveBtn}
                      onClick={() => {
                        setSelected(a);
                        setNote(a.notes ?? "");
                        void updateStatus(a.appointment_id, "approved");
                      }}
                      disabled={saving}
                    >
                      {saving && selected?.appointment_id === a.appointment_id ? "..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      style={rejectBtn}
                      onClick={() => {
                        setSelected(a);
                        setNote(a.notes ?? "");
                        void updateStatus(a.appointment_id, "rejected");
                      }}
                      disabled={saving}
                    >
                      {saving && selected?.appointment_id === a.appointment_id ? "..." : "Reject"}
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

        {/* ================= DETAILS MODAL ================= */}
        {detailsOpen && selected && (
          <div
            style={overlay}
            onMouseDown={(e) => {
              // click outside closes (but not when clicking inside modal)
              if (e.target === e.currentTarget) closeDetails();
            }}
          >
            <div style={modal} onMouseDown={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <h3 style={modalTitle}>Request details</h3>
                  <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>
                    {selected.client_username || "Unknown client"} • {fmt(selected.start_at)}
                  </div>
                </div>

                <button type="button" style={modalClose} onClick={closeDetails} aria-label="Close">
                  ✕
                </button>
              </div>

              <div style={modalBody}>
                {err ? (
                  <div style={{ color: "#7f1d1d", fontWeight: 600, marginBottom: 10 }}>{err}</div>
                ) : null}

                <div style={sectionLabel}>Client</div>
                <div style={fieldBox}>
                  <div style={{ fontWeight: 650 }}>{selected.client_username || "Unknown"}</div>
                  {selected.client_email ? (
                    <div style={{ marginTop: 4, opacity: 0.9 }}>{selected.client_email}</div>
                  ) : (
                    <div style={{ marginTop: 4, opacity: 0.75 }}>No email available</div>
                  )}
                </div>

                <div style={{ ...sectionLabel, marginTop: 12 }}>Status</div>
                <div style={fieldBox}>{selected.status}</div>

                <div style={{ ...sectionLabel, marginTop: 12 }}>Intake</div>
                <div style={fieldBox}>{selected.intake_id ? "Available" : "Missing"}</div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    style={{
                      ...subtleBtn,
                      opacity: selected.intake_id ? 1 : 0.55,
                      cursor: selected.intake_id ? "pointer" : "default",
                    }}
                    disabled={!selected.intake_id || intakeLoading}
                    onClick={() => {
                      if (!selected.intake_id) return;
                      void loadIntake(selected.intake_id);
                    }}
                  >
                    {intakeLoading ? "Loading intake..." : "View intake answers"}
                  </button>
                  {intakeErr ? (
                    <div style={{ marginTop: 8, color: "#7f1d1d", fontWeight: 600, fontSize: 12 }}>
                      {intakeErr}
                    </div>
                  ) : null}
                </div>

                <div style={{ ...sectionLabel, marginTop: 12 }}>Notes to client (optional)</div>
                <div style={fieldBox}>
                  <textarea
                    style={textareaStyle}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Write a short message for the client..."
                  />
                </div>

                <div style={modalBtnRow}>
                  <button
                    type="button"
                    style={{
                      ...rejectBtn,
                      backgroundColor: "#b42318",
                      borderRadius: 14,
                    }}
                    onClick={() => updateStatus(selected.appointment_id, "rejected")}
                    disabled={saving}
                  >
                    {saving ? "..." : "Reject"}
                  </button>

                  <button
                    type="button"
                    style={{
                      ...approveBtn,
                      backgroundColor: "#1f7a4a",
                      borderRadius: 14,
                    }}
                    onClick={() => updateStatus(selected.appointment_id, "approved")}
                    disabled={saving}
                  >
                    {saving ? "..." : "Approve"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= INTAKE MODAL (SECOND POPUP) ================= */}
        {intakeOpen && (
          <div
            style={{ ...overlay, zIndex: 70 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeIntake();
            }}
          >
            <div style={modal} onMouseDown={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <h3 style={modalTitle}>Intake answers</h3>
                  <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>
                    {selected?.client_username || "Client"}
                  </div>
                </div>

                <button type="button" style={modalClose} onClick={closeIntake} aria-label="Close">
                  ✕
                </button>
              </div>

              <div style={modalBody}>
                {intakeLoading ? (
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>Loading…</div>
                ) : intakeErr ? (
                  <div style={{ fontWeight: 600, color: "#7f1d1d" }}>{intakeErr}</div>
                ) : prettyIntake.length === 0 ? (
                  <div style={{ fontWeight: 600, color: "#3565AF" }}>No answers.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {prettyIntake.map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          borderRadius: 16,
                          padding: "10px 12px",
                          backgroundColor: "rgba(255,255,255,0.78)",
                          border: "1px solid rgba(53,101,175,0.14)",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 650, color: "#3565AF" }}>{k}</div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#0f172a",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.4,
                          }}
                        >
                          {String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <button type="button" style={subtleBtn} onClick={closeIntake}>
                    Back to request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PsychologistRequestsPage;
