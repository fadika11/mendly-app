import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, API_BASE } from "../api/auth";
import logo from "../assets/mendly-logo.jpg";


const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const getErrorMessage = (err: any) => {
    const msg =
      err?.message ||
      err?.response?.data?.detail ||
      "Login failed. Please try again.";

    if (typeof msg === "string") {
      if (
        msg.toLowerCase().includes("incorrect") ||
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("unauthorized")
      ) {
        return "Incorrect username or password.";
      }

      return msg;
    }

    return "Incorrect username or password.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setError(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);

    try {
      const token = await login({
        username: cleanUsername,
        password: cleanPassword,
      });

      if (!token?.access_token) {
        throw new Error("Login failed. Missing access token.");
      }

      localStorage.setItem("access_token", token.access_token);

      localStorage.setItem(
        "user",
        JSON.stringify({
          user_id: token.user_id,
          username: token.username,
          role: token.role,
        })
      );

      if (token.role === "psychologist") {
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        });

        if (!meRes.ok) {
          navigate("/psy", { replace: true });
          return;
        }

        const me = await meRes.json();
        const profile = me?.psychologist_profile;

        const profileCompleted =
          profile &&
          String(profile.specialty || "").trim() &&
          String(profile.specialty || "").trim().toLowerCase() !== "not completed" &&
          String(profile.workplace || "").trim() &&
          String(profile.city || "").trim();
        if (profileCompleted) {
          navigate("/psy", { replace: true });
        } else {
          navigate("/psy/complete-profile", { replace: true });
        }
      } else {
        navigate("/journey", { replace: true });
      }
    } catch (err: any) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      setPassword("");
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

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
      '"Poppins", system-ui, -apple-system, BlinkMacSystemFont,"Segoe UI", sans-serif',
  };

  const phoneStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    maxWidth: "450px",
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    margin: "0 auto",
    position: "relative",
  };

  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 40,
    paddingBottom: 32,
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

  const logoWrapperStyle: React.CSSProperties = {
    width: 140,
    height: 140,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: CREAM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  };

  const logoImageStyle: React.CSSProperties = {
    width: "140%",
    height: "140%",
    objectFit: "cover",
  };

  const appNameStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 600,
    fontSize: 16,
    marginTop: 6,
  };

  const bottomSectionStyle: React.CSSProperties = {
    flex: 1,
    paddingTop: 40,
    paddingBottom: 32,
    paddingInline: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
    backgroundColor: BLUE,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 4,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.95,
    marginBottom: 28,
  };

  const pillWrapperStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: 14,
    borderRadius: 999,
    backgroundColor: CREAM,
    paddingInline: 22,
    paddingBlock: 10,
    display: "flex",
    alignItems: "center",
  };

  const inputStyle: React.CSSProperties = {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: 15,
    color: "#4B5563",
  };

  const buttonPillStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    backgroundColor: loading ? "rgba(244,197,143,0.65)" : "#F4C58F",
    border: "none",
    paddingBlock: 14,
    fontSize: 16,
    fontWeight: 600,
    color: "#3565AF",
    cursor: loading ? "not-allowed" : "pointer",
    marginTop: 10,
  };

  const linkStyle: React.CSSProperties = {
    marginTop: 12,
    fontSize: 13,
    color: "white",
    textDecoration: "none",
    textAlign: "center",
  };

  const errorStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 4,
    marginBottom: 8,
    padding: "10px 12px",
    borderRadius: 14,
    backgroundColor: "rgba(127, 29, 29, 0.18)",
    border: "1px solid rgba(255,255,255,0.35)",
    fontSize: 13,
    fontWeight: 700,
    color: CREAM,
    textAlign: "center",
    boxSizing: "border-box",
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

          <div style={logoWrapperStyle}>
            <img src={logo} alt="Mendly logo" style={logoImageStyle} />
          </div>

          <div style={appNameStyle}>Mendly App</div>
          <div style={tornEdgeStyle} />
        </div>

        <div style={bottomSectionStyle}>
          <div style={titleStyle}>Login</div>
          <div style={subtitleStyle}>Sign in to continue</div>

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
              <input
                style={inputStyle}
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="username"
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
                autoComplete="current-password"
              />
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            <button type="submit" style={buttonPillStyle} disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <Link to="/signup" style={linkStyle}>
            Create a new account
          </Link>

          <Link to="/forgot-password" style={linkStyle}>
            Forgot Password?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;