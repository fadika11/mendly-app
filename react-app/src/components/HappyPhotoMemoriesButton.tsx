import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { API_BASE } from "../api/auth";

type PendingMemory = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  memoryDate: string;
};

type Props = {
  navItemStyle: React.CSSProperties;
};

const isNative = Capacitor.isNativePlatform?.() ?? false;

const HappyPhotoMemoriesButton: React.FC<Props> = ({ navItemStyle }) => {
  const navigate = useNavigate();

  const [showMemoriesModal, setShowMemoriesModal] = useState(false);
  const [pendingMemories, setPendingMemories] = useState<PendingMemory[]>([]);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const [newFile, setNewFile] = useState<File | null>(null);
  const [newCaption, setNewCaption] = useState("");
  const [newMemoryDate, setNewMemoryDate] = useState("");

  useEffect(() => {
    return () => {
      pendingMemories.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    };
  }, [pendingMemories]);

  const choosePhotoFromNativeGallery = async (): Promise<File | null> => {
    try {
      setMemoriesError(null);

      const permissions = await Camera.requestPermissions({
        permissions: ["photos"],
      });

      if (permissions.photos === "denied") {
        setMemoriesError(
          "Mendly does not have permission to open your photos. Please allow photo access from your phone settings, then try again."
        );
        return null;
      }

      const photo = await Camera.getPhoto({
        source: CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: 90,
        correctOrientation: true,
        allowEditing: false,
      });

      if (!photo.webPath) {
        return null;
      }

      const response = await fetch(photo.webPath);

      if (!response.ok) {
        throw new Error("Could not read selected photo.");
      }

      const blob = await response.blob();
      const extension = photo.format || "jpg";

      return new File([blob], `mendly-memory-${Date.now()}.${extension}`, {
        type: blob.type || `image/${extension}`,
      });
    } catch (err: any) {
      console.error("Native photo picker error:", err);

      const message = String(err?.message || err || "").toLowerCase();

      if (
        message.includes("cancel") ||
        message.includes("cancelled") ||
        message.includes("canceled") ||
        message.includes("user cancelled")
      ) {
        return null;
      }

      if (
        message.includes("permission") ||
        message.includes("denied") ||
        message.includes("access")
      ) {
        setMemoriesError(
          "Mendly does not have permission to open your photos. Please allow photo access from your phone settings, then try again."
        );
      } else {
        setMemoriesError("Could not open your phone gallery. Please try again.");
      }

      return null;
    }
  };

  const handleChooseMemoryPhoto = async () => {
    if (!isNative) return;

    const file = await choosePhotoFromNativeGallery();

    if (file) {
      setNewFile(file);
      setMemoriesError(null);
    }
  };

  const handleAddPendingMemory = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newFile) {
      setMemoriesError("Please choose an image file.");
      return;
    }

    const id =
      window.crypto && "randomUUID" in window.crypto
        ? (window.crypto.randomUUID as () => string)()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const previewUrl = URL.createObjectURL(newFile);

    setPendingMemories((prev) => [
      ...prev,
      {
        id,
        file: newFile,
        previewUrl,
        caption: newCaption.trim(),
        memoryDate: newMemoryDate,
      },
    ]);

    setNewFile(null);
    setNewCaption("");
    setNewMemoryDate("");

    const inputEl = document.getElementById(
      "happy-photo-input-inline"
    ) as HTMLInputElement | null;

    if (inputEl) {
      inputEl.value = "";
    }

    setMemoriesError(null);
  };

  const handlePendingFieldChange = (
    id: string,
    field: "caption" | "memoryDate",
    value: string
  ) => {
    setPendingMemories((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              [field]: value,
            }
          : m
      )
    );
  };

  const handleRemovePendingMemory = (id: string) => {
    setPendingMemories((prev) => {
      const target = prev.find((m) => m.id === id);

      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((m) => m.id !== id);
    });
  };

  const handleSaveAllMemories = async () => {
    if (!pendingMemories.length) {
      setMemoriesError("Add at least one photo before saving.");
      return;
    }

    try {
      setSavingAll(true);
      setMemoriesError(null);

      const token = window.localStorage.getItem("access_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      for (const memory of pendingMemories) {
        const formData = new FormData();
        formData.append("file", memory.file);

        if (memory.caption) {
          formData.append("caption", memory.caption);
        }

        if (memory.memoryDate) {
          formData.append("memory_date", memory.memoryDate);
        }

        const res = await fetch(`${API_BASE}/photo-memories/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!res.ok) {
          let detail = "Could not upload one of the photos.";

          try {
            const data = await res.json();
            if (typeof data?.detail === "string") {
              detail = data.detail;
            }
          } catch {
            // keep default message
          }

          setMemoriesError(detail);
          setSavingAll(false);
          return;
        }
      }

      pendingMemories.forEach((m) => URL.revokeObjectURL(m.previewUrl));
      setPendingMemories([]);
      setShowMemoriesModal(false);
      navigate("/photo-memories");
    } catch (err) {
      console.error("Error uploading memories", err);
      setMemoriesError("Could not upload the photos.");
    } finally {
      setSavingAll(false);
    }
  };

  const navBtnStyle: React.CSSProperties = {
    border: "none",
    background: "transparent",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    fontFamily: "inherit",
    ...navItemStyle,
  };

  const memoriesOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    boxSizing: "border-box",
  };

  const memoriesModalStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 450,
    maxHeight: "86vh",
    overflowY: "auto",
    backgroundColor: "#f5e9d9",
    borderRadius: 26,
    padding: "14px 16px 16px",
    boxSizing: "border-box",
    boxShadow: "0 12px 35px rgba(15,23,42,0.28)",
  };

  const memoriesHeaderRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  };

  const smallIconBtn: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontSize: 16,
    boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
  };

  const memoriesUploadRow: React.CSSProperties = {
    marginTop: 8,
    marginBottom: 8,
  };

  const memoriesInputRow: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 8,
  };

  const smallInput: React.CSSProperties = {
    height: 28,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 8px",
    fontSize: 12,
    flex: "1 1 120px",
    boxSizing: "border-box",
  };

  const smallUploadBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "8px 12px",
    backgroundColor: "#2563eb",
    color: "#f9fafb",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.3)",
  };

  const memoriesGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  };

  const memoriesCard: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
  };

  const memoriesImgWrapper: React.CSSProperties = {
    width: "100%",
    aspectRatio: "1 / 1",
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  };

  const memoriesImg: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const memoriesBody: React.CSSProperties = {
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  };

  const tinyLabel: React.CSSProperties = {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: 700,
  };

  const tinyInput: React.CSSProperties = {
    width: "100%",
    height: 26,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 6px",
    fontSize: 11,
    boxSizing: "border-box",
  };

  const tinyButtonsRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 3,
  };

  const tinyBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <>
      <button
        type="button"
        style={navBtnStyle}
        onClick={() => {
          setMemoriesError(null);
          setShowMemoriesModal(true);
        }}
        aria-label="Happy memories"
      >
        <div style={{ fontSize: 22 }}>📷</div>
      </button>

      {showMemoriesModal && (
        <div style={memoriesOverlayStyle}>
          <div style={memoriesModalStyle}>
            <div style={memoriesHeaderRow}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span role="img" aria-label="camera">
                  📷
                </span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  Happy Photo Memories
                </span>
              </div>

              <button
                type="button"
                style={smallIconBtn}
                onClick={() => setShowMemoriesModal(false)}
                aria-label="Close happy memories popup"
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
              Add a few photos that make you smile. They’ll be saved only when
              you hit <strong>Save all</strong>. 💙
            </div>

            <form onSubmit={handleAddPendingMemory} style={memoriesUploadRow}>
              <div style={memoriesInputRow}>
                {isNative ? (
                  <button
                    type="button"
                    onClick={handleChooseMemoryPhoto}
                    style={smallUploadBtn}
                  >
                    {newFile ? "Change photo" : "Choose photo"}
                  </button>
                ) : (
                  <input
                    id="happy-photo-input-inline"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewFile(
                        e.target.files && e.target.files[0]
                          ? e.target.files[0]
                          : null
                      )
                    }
                    style={{ fontSize: 11, flex: "1 1 150px" }}
                  />
                )}

                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  style={smallInput}
                />

                <input
                  type="date"
                  value={newMemoryDate}
                  onChange={(e) => setNewMemoryDate(e.target.value)}
                  style={smallInput}
                />

                <button type="submit" style={smallUploadBtn}>
                  Add to list
                </button>
              </div>
            </form>

            {newFile && isNative && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#2563eb" }}>
                Selected: {newFile.name}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
                paddingInline: 2,
              }}
            >
              <button
                type="button"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 12,
                  color: "#2563eb",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={() => {
                  setShowMemoriesModal(false);
                  navigate("/photo-memories");
                }}
              >
                Open my gallery →
              </button>

              <button
                type="button"
                onClick={handleSaveAllMemories}
                disabled={savingAll}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "6px 12px",
                  backgroundColor: savingAll ? "#9ca3af" : "#2563eb",
                  color: "#f9fafb",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: savingAll ? "default" : "pointer",
                  boxShadow: "0 4px 10px rgba(37, 99, 235, 0.3)",
                }}
              >
                {savingAll ? "Saving..." : "Save all"}
              </button>
            </div>

            {memoriesError && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#b91c1c" }}>
                {memoriesError}
              </div>
            )}

            <div style={memoriesGrid}>
              {pendingMemories.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    gridColumn: "1 / -1",
                    textAlign: "center",
                    paddingTop: 8,
                  }}
                >
                  No photos in this list yet. Add a happy moment above 🌱
                </div>
              ) : (
                pendingMemories.map((m) => (
                  <div key={m.id} style={memoriesCard}>
                    <div style={memoriesImgWrapper}>
                      <img
                        src={m.previewUrl}
                        alt={m.caption || "Happy memory"}
                        style={memoriesImg}
                      />
                    </div>

                    <div style={memoriesBody}>
                      <div style={tinyLabel}>Caption</div>
                      <input
                        type="text"
                        value={m.caption}
                        onChange={(e) =>
                          handlePendingFieldChange(
                            m.id,
                            "caption",
                            e.target.value
                          )
                        }
                        style={{ ...tinyInput, height: 24 }}
                      />

                      <div style={tinyLabel}>Date</div>
                      <input
                        type="date"
                        value={m.memoryDate}
                        onChange={(e) =>
                          handlePendingFieldChange(
                            m.id,
                            "memoryDate",
                            e.target.value
                          )
                        }
                        style={tinyInput}
                      />

                      <div style={tinyButtonsRow}>
                        <button
                          type="button"
                          style={{
                            ...tinyBtn,
                            backgroundColor: "#dc2626",
                            color: "#f9fafb",
                          }}
                          onClick={() => handleRemovePendingMemory(m.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HappyPhotoMemoriesButton;