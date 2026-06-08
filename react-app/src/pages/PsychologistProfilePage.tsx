// react-app/src/pages/PsychologistProfilePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { API_BASE, changePassword } from "../api/auth";
import PsyAvailabilityButton from "../components/PsyAvailabilityButton";

type MeResponse = {
  user_id: string;
  username: string;
  email: string;
  age: number | null;
  gender: number | string | null;
  role: "regular" | "psychologist";
  psychologist_profile: null | {
    specialty: string | null;
    workplace: string | null;
    city: string | null;
    bio: string | null;
    years_experience: number | null;
    license_number: string | null;
  };
};

const PsychologistProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BUTTON = "#F4C58F";
  const BUTTON_TEXT = "#3565AF";

  const specialtyOptions = useMemo(
    () => [
      "CBT",
      "Anxiety Disorders",
      "Depression",
      "Trauma / PTSD",
      "Couples Therapy",
      "Child & Adolescent",
      "OCD",
      "Eating Disorders",
      "Stress Management",
      "Other",
    ],
    []
  );

  const [me, setMe] = useState<MeResponse | null>(null);

  // editable fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<number | string | null>(null);

  const [specialty, setSpecialty] = useState("");
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [city, setCity] = useState("");
  const [years, setYears] = useState<number | "">("");
  const [license, setLicense] = useState("");
  const [bio, setBio] = useState("");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // password-change state
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdMessage, setPwdMessage] = useState<string | null>(null);

  const psy = me?.psychologist_profile;

  const initial = useMemo(() => {
    const name = me?.username?.trim();
    return name ? name.charAt(0).toUpperCase() : "M";
  }, [me?.username]);

  const display = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  };

  const finalSpecialty =
    specialty === "Other" ? customSpecialty.trim() : specialty.trim();

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  // ---------- load /auth/me ----------
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      setErrorMsg("No access token. Please login again.");
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        setMessage(null);

        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Failed to load profile (${res.status}). ${txt ? txt : ""}`.trim()
          );
        }

        const data: MeResponse = await res.json();
        setMe(data);

        setFullName(data.username ?? "");
        setEmail(data.email ?? "");
        setAge(typeof data.age === "number" ? data.age : null);
        setGender(data.gender ?? null);

        const p = data.psychologist_profile;
        const loadedSpecialty = (p?.specialty ?? "").trim();

        if (loadedSpecialty && specialtyOptions.includes(loadedSpecialty)) {
          setSpecialty(loadedSpecialty);
          setCustomSpecialty("");
        } else if (loadedSpecialty) {
          setSpecialty("Other");
          setCustomSpecialty(loadedSpecialty);
        } else {
          setSpecialty("");
          setCustomSpecialty("");
        }

        setWorkplace(p?.workplace ?? "");
        setCity(p?.city ?? "");
        setYears(typeof p?.years_experience === "number" ? p.years_experience : "");
        setLicense(p?.license_number ?? "");
        setBio(p?.bio ?? "");
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setErrorMsg(err?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [specialtyOptions]);

  // ---------- edit handlers ----------
  const handleOpenEdit = () => {
    setEditing(true);
    setShowPwdForm(false);
    setErrorMsg(null);
    setMessage(null);
    setPwdError(null);
    setPwdMessage(null);
  };

  const handleCancelEdit = () => {
    if (!me) return;
    const p = me.psychologist_profile;

    setFullName(me.username ?? "");
    setEmail(me.email ?? "");

    const loadedSpecialty = (p?.specialty ?? "").trim();
    if (loadedSpecialty && specialtyOptions.includes(loadedSpecialty)) {
      setSpecialty(loadedSpecialty);
      setCustomSpecialty("");
    } else if (loadedSpecialty) {
      setSpecialty("Other");
      setCustomSpecialty(loadedSpecialty);
    } else {
      setSpecialty("");
      setCustomSpecialty("");
    }

    setWorkplace(p?.workplace ?? "");
    setCity(p?.city ?? "");
    setYears(typeof p?.years_experience === "number" ? p.years_experience : "");
    setLicense(p?.license_number ?? "");
    setBio(p?.bio ?? "");

    setEditing(false);
    setErrorMsg(null);
    setMessage(null);
  };

  const validate = () => {
    if (!fullName.trim()) return "Full name is required.";
    if (!email.trim()) return "Email is required.";
    if (!finalSpecialty) return "Specialty is required.";
    if (!workplace.trim()) return "Workplace is required.";
    if (!city.trim()) return "City is required.";
    if (!bio.trim()) return "Bio is required.";
    return null;
  };

  const handleSaveProfile = async () => {
    const v = validate();
    if (v) {
      setErrorMsg(v);
      setMessage(null);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      setMessage(null);

      const token = localStorage.getItem("access_token");
      if (!token) return navigate("/login", { replace: true });

      const resUser = await fetch(`${API_BASE}/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: fullName.trim(),
          email: email.trim(),
          age: age ?? undefined,
          gender: gender ?? undefined,
        }),
      });

      if (!resUser.ok) {
        const t = await resUser.text().catch(() => "");
        throw new Error(t || "Failed to update user info.");
      }

      const resPsy = await fetch(`${API_BASE}/psychologist-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          specialty: finalSpecialty,
          workplace: workplace.trim(),
          city: city.trim(),
          bio: bio.trim(),
          years_experience: years === "" ? null : Number(years),
          license_number: license.trim() ? license.trim() : null,
        }),
      });

      if (!resPsy.ok) {
        const t = await resPsy.text().catch(() => "");
        throw new Error(t || "Failed to update psychologist profile.");
      }

      setMe((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          username: fullName.trim(),
          email: email.trim(),
          psychologist_profile: {
            specialty: finalSpecialty,
            workplace: workplace.trim(),
            city: city.trim(),
            bio: bio.trim(),
            years_experience: years === "" ? null : Number(years),
            license_number: license.trim() ? license.trim() : null,
          },
        };
      });

      setMessage("Profile updated successfully.");
      setEditing(false);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- password handlers ----------
  const handleOpenPwdForm = () => {
    setShowPwdForm(true);
    setEditing(false);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError(null);
    setPwdMessage(null);
    setErrorMsg(null);
    setMessage(null);
  };

  const handleCancelPwd = () => {
    setShowPwdForm(false);
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setPwdError(null);
    setPwdMessage(null);
  };

  const handleSavePwd = async () => {
    setPwdError(null);
    setPwdMessage(null);

    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError("Please fill in all password fields.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("New passwords do not match.");
      return;
    }

    try {
      setPwdSaving(true);
      await changePassword({
        current_password: currentPwd,
        new_password: newPwd,
      });
      setPwdMessage("Password changed successfully.");
      handleCancelPwd();
    } catch (err: any) {
      setPwdError(
        err?.message ||
          "Failed to change password. Please check your current password."
      );
    } finally {
      setPwdSaving(false);
    }
  };

  // =================== STYLES ===================

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
    overflowY: "hidden",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 20,
    paddingBottom: 16,
    paddingInline: 16,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    height: "40px",
    boxShadow: "0 8px 18px rgba(15,23,42,0.10)",
  };

  const appRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const tinyLogoStyle: React.CSSProperties = {
    width: 35,
    height: 35,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const tinyLogoImgStyle: React.CSSProperties = {
    width: "180%",
    height: "180%",
    objectFit: "cover",
  };

  const smallLabelStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontSize: 18,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const avatarStyle: React.CSSProperties = {
    width: 50,
    height: 50,
    borderRadius: "50%",
    backgroundColor: BLUE,
    color: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    fontWeight: 700,
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    marginTop: 12,
    marginBottom: 6,
    border: "none",
    cursor: "pointer",
  };

  const bottomSectionStyle: React.CSSProperties = {
    flex: 1,
    padding: "18px 24px 24px 24px",
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
    overflowY: "auto",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontFamily: '"Times New Roman", Georgia, serif',
    fontSize: 26,
    marginBottom: 6,
    marginTop: 26,
    textAlign: "center",
    fontWeight: 700,
    textShadow: "0 8px 20px rgba(0,0,0,0.15)",
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    fontSize: 13.5,
    opacity: 0.95,
    marginBottom: 18,
    textAlign: "center",
    lineHeight: 1.35,
    maxWidth: 340,
  };

  // pretty card (used for view + edit + password blocks)
  const cardStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: CREAM,
    borderRadius: 24,
    padding: 16,
    boxShadow: "0 16px 34px rgba(15,23,42,0.18)",
    boxSizing: "border-box",
  };

  // view rows (cleaner than disabled inputs)
  const infoRow: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.60)",
    borderRadius: 16,
    padding: "10px 12px",
    marginBottom: 10,
    border: "1px solid rgba(53,101,175,0.10)",
  };

  const rowLabel: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 900,
    color: "#3565AF",
    marginBottom: 4,
    letterSpacing: 0.2,
  };

  const rowValue: React.CSSProperties = {
    fontSize: 14.5,
    fontWeight: 700,
    color: "#111827",
    lineHeight: 1.35,
    wordBreak: "break-word",
  };

  // edit inputs (ProfilePage style)
  const fieldLabel: React.CSSProperties = {
    ...rowLabel,
    marginTop: 6,
    marginBottom: 6,
  };

  const pillWrapperStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.65)",
    paddingInline: 18,
    paddingBlock: 11,
    display: "flex",
    alignItems: "center",
    marginBottom: 12,
    boxSizing: "border-box",
    border: "1px solid rgba(53,101,175,0.12)",
  };

  const inputStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: 15,
    color: "#111827",
    fontWeight: 650,
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
    color: "#3565AF",
    fontWeight: 900,
  };

  const grid2: React.CSSProperties = {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  // bio should NOT be a pill (this fixes the “huge oval”)
  const bioBoxStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.65)",
    padding: 12,
    border: "1px solid rgba(53,101,175,0.12)",
    marginBottom: 12,
    boxSizing: "border-box",
  };

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 110,
    border: "none",
    outline: "none",
    background: "transparent",
    resize: "vertical",
    fontSize: 15,
    color: "#111827",
    fontWeight: 650,
    lineHeight: 1.45,
    fontFamily: "inherit",
  };

  const buttonsRowStyle: React.CSSProperties = {
    width: "85%",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
    height:40
  };

  const primaryButtonStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: 999,
    backgroundColor: BUTTON,
    border: "none",
    paddingBlock: 11,
    fontSize: 16,
    fontWeight: 800,
    color: BUTTON_TEXT,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "transparent",
    border: "1px solid rgba(255,255,255,0.7)",
    paddingBlock: 11,
    fontSize: 16,
    fontWeight: 650,
    color: "white",
    cursor: "pointer",
  };

  const changePwdButtonStyle: React.CSSProperties = {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: "#2a5f97",
    border: "1px solid rgba(255,255,255,0.7)",
    paddingBlock: 10,
    paddingInline: 20,
    fontSize: 14,
    fontWeight: 650,
    color: "white",
    cursor: "pointer",
    width: "85%",
    boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
  };

  const statusTextStyle: React.CSSProperties = {
    marginTop: 10,
    fontSize: 12,
    textAlign: "center",
  };

  const errorTextStyle: React.CSSProperties = {
    ...statusTextStyle,
    color: "#FDE2E1",
    fontWeight: 700,
  };

  const successTextStyle: React.CSSProperties = {
    ...statusTextStyle,
    color: "#D1FAE5",
    fontWeight: 700,
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
    boxShadow: "0 -2px 10px rgba(15,23,42,0.15)",
    height: 50,
  };

  const navItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 999,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#3565AF",
    fontWeight: 600,
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* TOP NAV */}
        <div style={topSectionStyle}>
          <div style={appRowStyle}>
            <div style={tinyLogoStyle}>
              <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
            </div>
            <span style={smallLabelStyle}>Mendly App</span>
          </div>

          <button
            type="button"
            style={avatarStyle}
            title="Psychologist Home"
          >
            {initial}
          </button>
        </div>

        {/* CONTENT */}
        <div style={bottomSectionStyle}>
          <div style={sectionTitleStyle}>
            {me ? me.username : loading ? "Loading..." : "My Profile"}
          </div>

          <div style={sectionSubtitleStyle}>
            {showPwdForm
              ? "Update your password to keep your account secure."
              : editing
              ? "Edit your professional profile details."
              : "View and edit your professional profile details."}
          </div>

          {loading && <div style={{ marginBottom: 10 }}>Loading profile…</div>}
          {!loading && errorMsg && <div style={errorTextStyle}>{errorMsg}</div>}
          {message && <div style={successTextStyle}>{message}</div>}

          {/* VIEW MODE (beautiful info card) */}
          {!loading && me && !showPwdForm && !editing && (
            <>
              <div style={cardStyle}>
                <div style={infoRow}>
                  <div style={rowLabel}>Full name</div>
                  <div style={rowValue}>{display(me.username)}</div>
                </div>

                <div style={infoRow}>
                  <div style={rowLabel}>Email</div>
                  <div style={rowValue}>{display(me.email)}</div>
                </div>

                <div style={infoRow}>
                  <div style={rowLabel}>Specialty</div>
                  <div style={rowValue}>{display(psy?.specialty)}</div>
                </div>

                <div style={infoRow}>
                  <div style={rowLabel}>Workplace</div>
                  <div style={rowValue}>{display(psy?.workplace)}</div>
                </div>

                <div style={infoRow}>
                  <div style={rowLabel}>City</div>
                  <div style={rowValue}>{display(psy?.city)}</div>
                </div>

                <div style={infoRow}>
                  <div style={rowLabel}>Years of experience</div>
                  <div style={rowValue}>{display(psy?.years_experience)}</div>
                </div>

                <div style={{ ...infoRow, marginBottom: 0 }}>
                  <div style={rowLabel}>License number</div>
                  <div style={rowValue}>{display(psy?.license_number)}</div>
                </div>

                <div style={{ height: 12 }} />

                <div style={infoRow}>
                  <div style={rowLabel}>Bio</div>
                  <div style={{ ...rowValue, fontWeight: 600, whiteSpace: "pre-wrap" }}>
                    {display(psy?.bio)}
                  </div>
                </div>
              </div>

              <div style={buttonsRowStyle}>
                <button type="button" style={primaryButtonStyle} onClick={handleOpenEdit}>
                  ✏️ Edit profile
                </button>
              </div>

              <button type="button" style={changePwdButtonStyle} onClick={handleOpenPwdForm}>
                🔒 Change password
              </button>
            </>
          )}

          {/* EDIT MODE (pill inputs like ProfilePage) */}
          {!loading && me && !showPwdForm && editing && (
            <>
              <div style={cardStyle}>
                <div style={fieldLabel}>Full name</div>
                <div style={pillWrapperStyle}>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div style={fieldLabel}>Email</div>
                <div style={pillWrapperStyle}>
                  <input
                    style={inputStyle}
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div style={fieldLabel}>Specialty</div>
                <div style={pillWrapperStyle}>
                  <select
                    style={selectStyle}
                    value={specialty}
                    onChange={(e) => {
                      setSpecialty(e.target.value);
                      if (e.target.value !== "Other") setCustomSpecialty("");
                    }}
                  >
                    <option value="">Select specialty</option>
                    {specialtyOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span style={caretStyle}>▼</span>
                </div>

                {specialty === "Other" && (
                  <>
                    <div style={fieldLabel}>Custom specialty</div>
                    <div style={pillWrapperStyle}>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Write your specialty"
                        value={customSpecialty}
                        onChange={(e) => setCustomSpecialty(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div style={grid2}>
                  <div>
                    <div style={fieldLabel}>Workplace</div>
                    <div style={pillWrapperStyle}>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Clinic / Hospital / Private"
                        value={workplace}
                        onChange={(e) => setWorkplace(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={fieldLabel}>City</div>
                    <div style={pillWrapperStyle}>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="City"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div style={grid2}>
                  <div>
                    <div style={fieldLabel}>Years of experience</div>
                    <div style={pillWrapperStyle}>
                      <input
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={80}
                        placeholder="e.g. 4"
                        value={years}
                        onChange={(e) =>
                          setYears(e.target.value === "" ? "" : Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <div style={fieldLabel}>License number</div>
                    <div style={pillWrapperStyle}>
                      <input
                        style={inputStyle}
                        type="text"
                        placeholder="Optional"
                        value={license}
                        onChange={(e) => setLicense(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div style={fieldLabel}>Bio</div>
                <div style={bioBoxStyle}>
                  <textarea
                    style={textareaStyle}
                    placeholder="Write a short bio for clients (required)"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>

                {errorMsg && <div style={{ ...errorTextStyle, color: "#7f1d1d" }}>{errorMsg}</div>}
              </div>

              <div style={buttonsRowStyle}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  ↩️ Cancel
                </button>

                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "💾 Save"}
                </button>
              </div>
            </>
          )}

          {/* CHANGE PASSWORD (same pill style) */}
          {!loading && me && showPwdForm && (
            <>
              <div style={cardStyle}>
                <div style={{ ...rowLabel, marginBottom: 10 }}>Change Password</div>

                <div style={pillWrapperStyle}>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="Current password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                  />
                </div>

                <div style={pillWrapperStyle}>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="New password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                  />
                </div>

                <div style={pillWrapperStyle}>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                  />
                </div>

                {pwdError && <div style={errorTextStyle}>{pwdError}</div>}
                {pwdMessage && <div style={successTextStyle}>{pwdMessage}</div>}
              </div>

              <div style={buttonsRowStyle}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={handleCancelPwd}
                  disabled={pwdSaving}
                >
                  ↩️ Cancel
                </button>

                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={handleSavePwd}
                  disabled={pwdSaving}
                >
                  {pwdSaving ? "Saving..." : "💾 Save"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* BOTTOM NAV */}
        <div style={bottomNavStyle}>
          <button type="button" style={navItemStyle} onClick={() => navigate("/psy")}>
            <span style={{ fontSize: 20 }}>🏠</span>
            <span>Home</span>
          </button>

          <PsyAvailabilityButton style={navItemStyle} />

          <button type="button" style={navItemStyle} onClick={logout}>
            <span style={{ fontSize: 20 }}>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PsychologistProfilePage;
