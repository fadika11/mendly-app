// react-app/src/pages/PsychologistCompleteProfilePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { API_BASE } from "../api/auth";

type MeResponse = {
  user_id: string;
  username: string;
  email: string;
  age: number | null;
  gender: number | string | null;
  role: string;
  psychologist_profile?: {
    specialty?: string | null;
    workplace?: string | null;
    city?: string | null;
    bio?: string | null;
    years_experience?: number | null;
    license_number?: string | null;
  } | null;
};

const SPECIALTIES = [
  "Clinical Psychology",
  "Educational Psychology",
  "Developmental Psychology",
  "Medical Psychology",
  "Rehabilitation Psychology",
  "Occupational / Organizational Psychology",
  "Social Psychology",
  "Counseling Psychology",
  "Neuropsychology",
  "Child and Adolescent Psychology",
  "Family Therapy",
  "Trauma and Anxiety",
  "Depression and Mood Disorders",
  "CBT (Cognitive Behavioral Therapy)",
  "DBT (Dialectical Behavior Therapy)",
  "Other",
];

const PsychologistCompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BUTTON = "#F4C58F";
  const BUTTON_TEXT = "#3565AF";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [specialty, setSpecialty] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [city, setCity] = useState("");
  const [yearsExp, setYearsExp] = useState<string>("");
  const [bio, setBio] = useState("");

  const token = useMemo(() => localStorage.getItem("access_token") || "", []);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          logout();
          return;
        }

        const data: MeResponse = await res.json();

        if (data.role !== "psychologist") {
          navigate("/", { replace: true });
          return;
        }

        const p = data.psychologist_profile || {};

        const loadedSpecialty =
          String(p.specialty || "").trim().toLowerCase() === "not completed"
            ? ""
            : p.specialty || "";

        setSpecialty(loadedSpecialty);
        setWorkplace(p.workplace || "");
        setCity(p.city || "");
        setYearsExp(p.years_experience != null ? String(p.years_experience) : "");
        setBio(p.bio || "");
      } catch (e: any) {
        setError(e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressCount =
    (specialty.trim() ? 1 : 0) +
    (workplace.trim() ? 1 : 0) +
    (city.trim() ? 1 : 0) +
    (yearsExp.trim() ? 1 : 0) +
    (bio.trim() ? 1 : 0);

  const progressTotal = 5;
  const progressPercent = Math.round((progressCount / progressTotal) * 100);

  const onSave = async () => {
    setError(null);

    if (!specialty.trim() || !workplace.trim() || !city.trim()) {
      setError("Please fill Specialty, Workplace, and City.");
      return;
    }

    const years = yearsExp.trim() === "" ? undefined : Number(yearsExp);

    if (
      years !== undefined &&
      (!Number.isFinite(years) || years < 0 || years > 80)
    ) {
      setError("Years of experience must be a valid number (0-80).");
      return;
    }

    const payload = {
      specialty: specialty.trim(),
      workplace: workplace.trim(),
      city: city.trim(),
      years_experience: years,
      bio: bio.trim(),
    };

    setSaving(true);

    try {
      const res = await fetch(`${API_BASE}/auth/psychologist-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Failed to save");
      }

      navigate("/psy", { replace: true });
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

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
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    padding: "16px 16px",
    boxShadow: "0 6px 18px rgba(15,23,42,0.10)",
    boxSizing: "border-box",
  };

  const headerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const appRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  const tinyLogoStyle: React.CSSProperties = {
    width: 38,
    height: 38,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
  };

  const tinyLogoImgStyle: React.CSSProperties = {
    width: "180%",
    height: "180%",
    objectFit: "cover",
  };

  const appNameStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
  };

  const logoutBtn: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    backgroundColor: BLUE,
    color: CREAM,
    fontSize: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "18px 24px 24px 24px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: '"Times New Roman", Georgia, serif',
    fontSize: 28,
    fontWeight: 800,
    marginTop: 10,
    marginBottom: 4,
    textAlign: "center",
  };

  const subTitleStyle: React.CSSProperties = {
    fontSize: 13,
    opacity: 0.95,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 1.4,
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "rgba(245,233,217,0.22)",
    border: "1px solid rgba(255,255,255,0.26)",
    borderRadius: 24,
    padding: 14,
    boxSizing: "border-box",
    boxShadow: "0 16px 35px rgba(15,23,42,0.14)",
    backdropFilter: "blur(6px)",
  };

  const progressWrap: React.CSSProperties = {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
    marginBottom: 14,
  };

  const progressFill: React.CSSProperties = {
    width: `${progressPercent}%`,
    height: "100%",
    borderRadius: 999,
    backgroundColor: BUTTON,
    transition: "width 0.2s ease",
  };

  const progressText: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: CREAM,
    textAlign: "center",
    marginBottom: 8,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    color: CREAM,
    marginBottom: 6,
    marginLeft: 4,
  };

  const pillWrapperStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: 12,
    borderRadius: 999,
    backgroundColor: CREAM,
    paddingInline: 18,
    paddingBlock: 10,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  };

  const inputStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: 14,
    color: "#4B5563",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    cursor: "pointer",
  };

  const caretStyle: React.CSSProperties = {
    marginLeft: 8,
    fontSize: 14,
    color: "#5F8DD0",
  };

  const textAreaWrapStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: CREAM,
    paddingInline: 18,
    paddingBlock: 12,
    display: "flex",
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: 92,
    resize: "vertical",
    lineHeight: 1.4,
  };

  const saveBtn: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    backgroundColor: saving ? "rgba(244,197,143,0.65)" : BUTTON,
    border: "none",
    paddingBlock: 13,
    fontSize: 16,
    fontWeight: 800,
    color: BUTTON_TEXT,
    cursor: saving ? "not-allowed" : "pointer",
    marginTop: 6,
    boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
  };

  const errorStyle: React.CSSProperties = {
    marginTop: 4,
    marginBottom: 8,
    padding: "10px 12px",
    borderRadius: 14,
    backgroundColor: "rgba(127,29,29,0.22)",
    border: "1px solid rgba(255,255,255,0.30)",
    fontSize: 12,
    fontWeight: 700,
    color: CREAM,
    textAlign: "center",
    width: "100%",
    boxSizing: "border-box",
  };

  const loadingStyle: React.CSSProperties = {
    marginTop: 24,
    color: CREAM,
    fontWeight: 800,
    textAlign: "center",
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        <div style={headerStyle}>
          <div style={headerRow}>
            <div style={appRow}>
              <span style={tinyLogoStyle}>
                <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
              </span>
              <div style={appNameStyle}>Mendly App</div>
            </div>

            <button type="button" style={logoutBtn} onClick={logout} aria-label="Logout">
              🚪
            </button>
          </div>
        </div>

        <div style={contentStyle}>
          <div style={titleStyle}>Complete your profile</div>

          <div style={subTitleStyle}>
            Add your professional details so users can understand your background.
          </div>

          {loading ? (
            <div style={loadingStyle}>Loading profile...</div>
          ) : (
            <div style={cardStyle}>
              <div style={progressText}>Profile progress: {progressPercent}%</div>
              <div style={progressWrap}>
                <div style={progressFill} />
              </div>

              <div style={labelStyle}>Specialty *</div>
              <div style={pillWrapperStyle}>
                <select
                  style={selectStyle}
                  value={specialty}
                  onChange={(e) => {
                    setSpecialty(e.target.value);
                    if (error) setError(null);
                  }}
                >
                  <option value="">Select specialty</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span style={caretStyle}>▼</span>
              </div>

              <div style={labelStyle}>Workplace *</div>
              <div style={pillWrapperStyle}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Clinic / Hospital / Private practice"
                  value={workplace}
                  onChange={(e) => {
                    setWorkplace(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>

              <div style={labelStyle}>City *</div>
              <div style={pillWrapperStyle}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>

              <div style={labelStyle}>Years of experience</div>
              <div style={pillWrapperStyle}>
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="Years of experience"
                  min={0}
                  max={80}
                  value={yearsExp}
                  onChange={(e) => {
                    setYearsExp(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>

              <div style={labelStyle}>Bio optional</div>
              <div style={textAreaWrapStyle}>
                <textarea
                  style={textareaStyle}
                  placeholder="Short bio, treatment approach, languages, etc."
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>

              {error && <div style={errorStyle}>{error}</div>}

              <button type="button" style={saveBtn} onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PsychologistCompleteProfilePage;