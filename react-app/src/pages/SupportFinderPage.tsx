// react-app/src/pages/SupportFinderPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import logo from "../assets/mendly-logo.jpg";
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";

const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

interface SupportLocation {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  website?: string | null;
  distanceKm?: number | null;
}

const SupportFinderPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<SupportLocation[]>([]);
  const [error, setError] = useState<string | null>(null);


  // ===== styles =====
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

  const backBtnStyle: React.CSSProperties = { ...iconBtn, left: 12 };
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
    fontSize: 20,
    color: "#5F8DD0",
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: BLUE,
    padding: "16px 20px 14px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    color: "#111827",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: "14px 14px 16px 14px",
    boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    color: "#3565AF",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "90%",
    border: "1.5px solid #d6cbb9",
    borderRadius: 10,
    padding: "8px 10px",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  };

  const searchRowStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  };

  const primaryBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    backgroundColor: "#2a5f97ff",
    color: CREAM,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
    width: "90%",
  };

  const secondaryBtn: React.CSSProperties = {
    ...primaryBtn,
    backgroundColor: "#fff",
    color: "#3565AF",
    border: "1px solid #3565AF",
  };

  const resultsCardStyle: React.CSSProperties = {
    ...cardStyle,
    paddingTop: 10,
  };

  const locationItemStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(55,65,81,0.15)",
    paddingBottom: 10,
    marginBottom: 10,
  };

  const locationNameStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: "#1f2937",
    marginBottom: 2,
  };

  const locationAddressStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#374151",
  };

  const smallMetaStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#4b5563",
    marginTop: 4,
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
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#3565AF",
    fontWeight: 600,
  };

  // ===== handlers =====

  const searchByCity = async () => {
    const trimmed = city.trim();

    if (!trimmed) {
      setError("Please enter a city name.");
      return;
    }

    setError(null);
    setLoading(true);
    setLocations([]);

    try {
      const res = await fetch(
        `${API_BASE}/api/support-locations?city=${encodeURIComponent(trimmed)}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch locations");
      }

      const data: SupportLocation[] = await res.json();
      setLocations(data);

      if (data.length === 0) {
        setError("No results found for this city.");
      }
    } catch (e: any) {
      setError(e?.message || "Error loading locations.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationsByCoordinates = async (latitude: number, longitude: number) => {
    const res = await fetch(
      `${API_BASE}/api/support-locations?lat=${latitude}&lng=${longitude}`
    );

    if (!res.ok) {
      throw new Error("Failed to fetch locations");
    }

    const data: SupportLocation[] = await res.json();
    setLocations(data);

    if (data.length === 0) {
      setError("No nearby mental health services were found.");
    }
  };

  const useCurrentLocation = async () => {
    setError(null);
    setLoading(true);
    setLocations([]);

    try {
      let latitude: number;
      let longitude: number;

      if (isNative) {
        const permission = await Geolocation.requestPermissions();

        const locationPermission = (permission as any).location;
        const coarsePermission = (permission as any).coarseLocation;

        if (
          locationPermission === "denied" &&
          (!coarsePermission || coarsePermission === "denied")
        ) {
          setError(
            "Mendly does not have permission to use your location. Please allow location access from your phone settings, then try again."
          );
          return;
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        if (!navigator.geolocation) {
          setError("Your browser does not support location services.");
          return;
        }

        const position = await new Promise<any>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });

        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      await fetchLocationsByCoordinates(latitude, longitude);
    } catch (err: any) {
      console.error("Current location error:", err);

      const message = String(err?.message || err || "").toLowerCase();

      if (
        message.includes("permission") ||
        message.includes("denied") ||
        message.includes("disabled")
      ) {
        setError(
          "Mendly cannot use your current location. Please enable location permission for Mendly in your phone settings."
        );
      } else if (
        message.includes("timeout") ||
        message.includes("location unavailable")
      ) {
        setError(
          "Could not get your current location. Please make sure GPS/location is enabled and try again."
        );
      } else {
        setError("Could not use your current location. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* HEADER */}
        <div style={topSectionStyle}>
          <button
            type="button"
            style={backBtnStyle}
            onClick={() => navigate("/journey")}
            aria-label="Back"
            title="Back"
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

            <span style={headerTitleStyle}>Find Support</span>
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
          {/* search card */}
          <div style={cardStyle}>
            <div style={labelStyle}>Find mental health support near you</div>

            <p style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
              You can type any city or use your current location. We’ll show
              clinics and professionals that may offer psychological help.
            </p>

            <div style={searchRowStyle}>
              <input
                style={inputStyle}
                placeholder="Type city, e.g. Haifa"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />

              <button
                type="button"
                style={{
                  ...primaryBtn,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
                disabled={loading}
                onClick={searchByCity}
              >
                Search by city
              </button>

              <button
                type="button"
                style={{
                  ...secondaryBtn,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
                disabled={loading}
                onClick={useCurrentLocation}
              >
                📍 Use my current location
              </button>
            </div>

            {error && (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#b91c1c",
                  fontWeight: 500,
                }}
              >
                {error}
              </p>
            )}
          </div>

          {/* results card */}
          <div style={resultsCardStyle}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#3565AF",
                marginBottom: 6,
              }}
            >
              Results
            </div>

            {loading && (
              <p style={{ fontSize: 13, color: "#374151" }}>
                Searching for nearby services…
              </p>
            )}

            {!loading && locations.length === 0 && !error && (
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                No locations to show yet. Try searching by city or using your
                current location.
              </p>
            )}

            {!loading &&
              locations.map((loc) => (
                <div key={loc.id} style={locationItemStyle}>
                  <div style={locationNameStyle}>{loc.name}</div>
                  <div style={locationAddressStyle}>{loc.address}</div>

                  {loc.phone && (
                    <div style={smallMetaStyle}>
                      📞{" "}
                      <a
                        href={`tel:${loc.phone}`}
                        style={{ color: "#2563eb", textDecoration: "none" }}
                      >
                        {loc.phone}
                      </a>
                    </div>
                  )}

                  {loc.website && (
                    <div style={smallMetaStyle}>
                      🌐{" "}
                      <a
                        href={loc.website}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb" }}
                      >
                        Website
                      </a>
                    </div>
                  )}

                  {loc.distanceKm != null && (
                    <div style={smallMetaStyle}>
                      📍 ~{loc.distanceKm.toFixed(1)} km away
                    </div>
                  )}
                </div>
              ))}
          </div>

          <p
            style={{
              fontSize: 11,
              color: "#f9fafb",
              opacity: 0.8,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            This list is for information only and does not replace emergency
            services or professional advice.
          </p>
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

export default SupportFinderPage;