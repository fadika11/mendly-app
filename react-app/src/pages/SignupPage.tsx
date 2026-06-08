import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, signupPsychologist } from "../api/auth";
import logo from "../assets/mendly-logo.jpg";

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"regular" | "psychologist">("regular");

  const [licenseNumber, setLicenseNumber] = useState("");

  const navigate = useNavigate();

  const getSignupErrorMessage = (err: any) => {
    const detail = err?.response?.data?.detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail.map((d: any) => d?.msg || JSON.stringify(d)).join(", ");
    }

    if (detail && typeof detail === "object") return JSON.stringify(detail);

    return err?.message || "Signup failed. Please try again.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      setError("Please fill username, email, and password.");
      return;
    }

    if (role === "psychologist" && !licenseNumber.trim()) {
      setError("License number is required for psychologist signup.");
      return;
    }

    setLoading(true);

    try {
      if (role === "regular") {
        await signup({
          username: cleanUsername,
          email: cleanEmail,
          password: cleanPassword,
          age: age === "" ? undefined : Number(age),
          gender,
        });
      } else {
        await signupPsychologist({
          username: cleanUsername,
          email: cleanEmail,
          password: cleanPassword,
          age: age === "" ? undefined : Number(age),
          gender,
          license_number: licenseNumber.trim(),
        });
      }

      navigate("/login", { replace: true });
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(getSignupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";
  const BUTTON = "#F4C58F";
  const BUTTON_TEXT = "#3565AF";

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
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    margin: "0 auto",
    overflowY: "auto",
    position: "relative",
  };

  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 24,
    paddingBottom: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: "relative",
    overflow: "hidden",
  };

  const homeIconButtonStyle: React.CSSProperties = {
    position: "absolute",
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "none",
    backgroundColor: BLUE,
    color: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
    cursor: "pointer",
    fontSize: 20,
  };

  const tornEdgeStyle: React.CSSProperties = {
    position: "absolute",
    bottom: -10,
    left: 0,
    right: 0,
    height: 30,
    background:
      "radial-gradient(circle at 0 100%, #ffffff 20%, transparent 21%)," +
      "radial-gradient(circle at 25% 100%, #ffffff 20%, transparent 21%)," +
      "radial-gradient(circle at 50% 100%, #ffffff 20%, transparent 21%)," +
      "radial-gradient(circle at 75% 100%, #ffffff 20%, transparent 21%)," +
      "radial-gradient(circle at 100% 100%, #ffffff 20%, transparent 21%)",
    backgroundSize: "40px 20px",
    backgroundRepeat: "repeat-x",
  };

  const logoCircleStyle: React.CSSProperties = {
    width: 120,
    height: 120,
    borderRadius: "50%",
    backgroundImage: `url(${logo})`,
    backgroundSize: "135%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    boxShadow: `0 0 0 6px ${CREAM}`,
    marginBottom: 6,
  };

  const appNameStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 600,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 4,
  };

  const bottomSectionStyle: React.CSSProperties = {
    flex: 1,
    paddingTop: 24,
    paddingBottom: 24,
    paddingInline: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
    backgroundColor: BLUE,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 2,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.95,
    marginBottom: 20,
  };

  const pillWrapperStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: 10,
    borderRadius: 999,
    backgroundColor: CREAM,
    paddingInline: 22,
    paddingBlock: 9,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  };

  const inputStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: 15,
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

  const buttonPillStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    backgroundColor: loading ? "rgba(244,197,143,0.65)" : BUTTON,
    border: "none",
    paddingBlock: 13,
    fontSize: 16,
    fontWeight: 600,
    color: BUTTON_TEXT,
    cursor: loading ? "not-allowed" : "pointer",
    marginTop: 8,
  };

  const errorStyle: React.CSSProperties = {
    marginTop: 6,
    marginBottom: 8,
    padding: "9px 11px",
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

  const linkStyle: React.CSSProperties = {
    marginTop: 14,
    fontSize: 13,
    color: "white",
    textDecoration: "none",
    textAlign: "center",
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        <div style={topSectionStyle}>
          <button
            type="button"
            style={homeIconButtonStyle}
            onClick={() => navigate("/emotional-balance")}
            aria-label="Back to home page"
          >
            🏠
          </button>

          <div style={logoCircleStyle} />
          <div style={appNameStyle}>Mendly App</div>
          <div style={tornEdgeStyle} />
        </div>

        <div style={bottomSectionStyle}>
          <div style={titleStyle}>Create New Account</div>
          <div style={subtitleStyle}>join to our family</div>

          <form
            onSubmit={handleSubmit}
            noValidate
            style={{
              width: "80%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={pillWrapperStyle}>
              <select
                style={selectStyle}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as "regular" | "psychologist");
                  setError(null);
                }}
              >
                <option value="regular">Regular user</option>
                <option value="psychologist">Psychologist</option>
              </select>
              <span style={caretStyle}>▼</span>
            </div>

            <div style={pillWrapperStyle}>
              <input
                style={inputStyle}
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                required
              />
            </div>

            <div style={pillWrapperStyle}>
              <input
                style={inputStyle}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                required
              />
            </div>

            <div style={pillWrapperStyle}>
              <input
                style={inputStyle}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                required
              />
            </div>

            <div style={pillWrapperStyle}>
              <input
                style={inputStyle}
                type="number"
                placeholder="Age"
                value={age}
                min={10}
                max={120}
                onChange={(e) =>
                  setAge(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>

            <div style={pillWrapperStyle}>
              <select
                style={selectStyle}
                value={gender}
                onChange={(e) => setGender(Number(e.target.value))}
              >
                <option value={0}>Gender</option>
                <option value={1}>Female</option>
                <option value={2}>Male</option>
                <option value={3}>Other</option>
              </select>
              <span style={caretStyle}>▼</span>
            </div>

            {role === "psychologist" && (
              <div style={pillWrapperStyle}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="License number, example: 27-147619"
                  value={licenseNumber}
                  onChange={(e) => {
                    setLicenseNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  required
                />
              </div>
            )}

            {error && <div style={errorStyle}>{error}</div>}

            <button type="submit" style={buttonPillStyle} disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <Link to="/login" style={linkStyle}>
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;