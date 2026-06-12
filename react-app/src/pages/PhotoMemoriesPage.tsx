// react-app/src/pages/PhotoMemoriesPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL ?? import.meta.env.VITE_API_URL ?? "http://10.0.2.2:8000")
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");

interface HappyMemory {
  memory_id: string;
  image_url: string;
  caption: string | null;
  memory_date: string | null;
  created_at: string;
}

const PhotoMemoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  const [memories, setMemories] = useState<HappyMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // nice delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);

  // fullscreen state
  const [fullScreenMemory, setFullScreenMemory] = useState<HappyMemory | null>(
    null
  );

  // "Add memories" modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newCaption, setNewCaption] = useState("");
  const [newMemoryDate, setNewMemoryDate] = useState("");
  const [uploadingNew, setUploadingNew] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // -------- load memories helper --------
  const fetchMemories = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/photo-memories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Failed to load memories", res.status, txt);
        setError("Could not load your photos.");
        setLoading(false);
        return;
      }

      const data: HappyMemory[] = await res.json();
      setMemories(data);
    } catch (err) {
      console.error("Error loading memories", err);
      setError("Could not load your photos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  // -------- delete memory from DB with custom modal --------
  const openDeleteConfirm = (memoryId: string) => {
    setMemoryToDelete(memoryId);
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = () => {
    if (deletingId) return;
    setMemoryToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleDeleteMemoryConfirmed = async () => {
    if (!memoryToDelete) return;

    try {
      setDeletingId(memoryToDelete);
      setError(null);

      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setError("You must be logged in.");
        setDeletingId(null);
        setMemoryToDelete(null);
        setShowDeleteConfirm(false);
        return;
      }

      const res = await fetch(`${API_BASE}/photo-memories/${memoryToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Failed to delete memory", res.status, txt);
        setError("Could not delete this memory.");
        setDeletingId(null);
        setMemoryToDelete(null);
        setShowDeleteConfirm(false);
        return;
      }

      setMemories((prev) =>
        prev.filter((m) => m.memory_id !== memoryToDelete)
      );

      setMemoryToDelete(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting memory", err);
      setError("Could not delete this memory.");
      setMemoryToDelete(null);
      setShowDeleteConfirm(false);
    } finally {
      setDeletingId(null);
    }
  };

  // -------- start editing a memory --------
  const startEdit = (m: HappyMemory) => {
    setEditingId(m.memory_id);
    setEditCaption(m.caption ?? "");
    setEditDate(m.memory_date ?? "");
    setEditFile(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCaption("");
    setEditDate("");
    setEditFile(null);
    setSavingEdit(false);
  };

  // -------- save edits (caption/date + optional picture change) --------
  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      setSavingEdit(true);
      setError(null);

      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setError("You must be logged in.");
        setSavingEdit(false);
        return;
      }

      const memory = memories.find((m) => m.memory_id === editingId);
      if (!memory) {
        setError("Memory not found.");
        setSavingEdit(false);
        return;
      }

      // if user chose a new picture → upload new + delete old
      if (editFile) {
        const formData = new FormData();
        formData.append("file", editFile);

        if (editCaption.trim()) {
          formData.append("caption", editCaption.trim());
        }

        if (editDate) {
          formData.append("memory_date", editDate);
        }

        const uploadRes = await fetch(`${API_BASE}/photo-memories/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!uploadRes.ok) {
          let detail = "Could not upload the new photo.";

          try {
            const data = await uploadRes.json();
            if (data.detail) detail = data.detail;
          } catch {
            // keep default message
          }

          setError(detail);
          setSavingEdit(false);
          return;
        }

        const deleteRes = await fetch(
          `${API_BASE}/photo-memories/${editingId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!deleteRes.ok) {
          const txt = await deleteRes.text();
          console.error("Failed to delete old memory after upload", txt);
        }
      } else {
        const body = {
          caption: editCaption,
          memory_date: editDate || null,
        };

        const res = await fetch(`${API_BASE}/photo-memories/${editingId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text();
          console.error("Failed to update memory", res.status, txt);
          setError("Could not save changes. Please try again.");
          setSavingEdit(false);
          return;
        }
      }

      await fetchMemories();
      cancelEdit();
    } catch (err) {
      console.error("Error saving edit", err);
      setError("Could not save changes. Please try again.");
      setSavingEdit(false);
    }
  };

  // -------- add memory (modal) --------
  const choosePhotoFromNativeGallery = async (
    errorTarget: "add" | "edit" = "add"
  ): Promise<File | null> => {
    try {
      if (errorTarget === "add") {
        setAddError(null);
      } else {
        setError(null);
      }

      const permissions = await Camera.requestPermissions({
        permissions: ["photos"],
      });

      if (permissions.photos === "denied") {
        const msg =
          "Mendly does not have permission to open your photos. Please allow photo access from your phone settings, then try again.";

        if (errorTarget === "add") {
          setAddError(msg);
        } else {
          setError(msg);
        }

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

      // User cancelled picker - this is normal, do not show red error.
      if (
        message.includes("cancel") ||
        message.includes("cancelled") ||
        message.includes("canceled") ||
        message.includes("user cancelled")
      ) {
        return null;
      }

      const msg = "Could not open your phone gallery. Please try again.";

      if (errorTarget === "add") {
        setAddError(msg);
      } else {
        setError(msg);
      }

      return null;
    }
  };

  const handleChooseNewMemoryPhoto = async () => {
    const file = await choosePhotoFromNativeGallery("add");

    if (file) {
      setNewFile(file);
      setAddError(null);
    }
  };

  const handleChooseEditMemoryPhoto = async () => {
    const file = await choosePhotoFromNativeGallery("edit");

    if (file) {
      setEditFile(file);
      setError(null);
    }
  };

  const handleUploadNewMemory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newFile) {
      setAddError("Please choose an image file.");
      return;
    }

    try {
      setUploadingNew(true);
      setAddError(null);

      const token = window.localStorage.getItem("access_token");
      if (!token) {
        setAddError("You must be logged in.");
        setUploadingNew(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", newFile);

      if (newCaption.trim()) {
        formData.append("caption", newCaption.trim());
      }

      if (newMemoryDate) {
        formData.append("memory_date", newMemoryDate);
      }

      const res = await fetch(`${API_BASE}/photo-memories/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        let detail = "Could not upload the photo.";

        try {
          const data = await res.json();
          if (data.detail) detail = data.detail;
        } catch {
          // keep default message
        }

        setAddError(detail);
        setUploadingNew(false);
        return;
      }

      setNewFile(null);
      setNewCaption("");
      setNewMemoryDate("");

      const inputEl = document.getElementById(
        "add-memory-file-input"
      ) as HTMLInputElement | null;

      if (inputEl) {
        inputEl.value = "";
      }

      await fetchMemories();
      setShowAddModal(false);
    } catch (err) {
      console.error("Error uploading memory", err);
      setAddError("Could not upload the photo.");
    } finally {
      setUploadingNew(false);
    }
  };

  // ===== LAYOUT STYLES =====
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    height: "30px",
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
    fontSize: 20,
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

  const bottomSectionStyle: React.CSSProperties = {
    flex: 1,
    padding: "0 0 16px 0",
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "white",
    overflowY: "auto",
    overflowX: "hidden",
  };

  const innerContentStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 18px 18px 18px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const headerCard: React.CSSProperties = {
    width: "100%",
    backgroundColor: CREAM,
    borderRadius: 22,
    padding: "12px 14px 14px 14px",
    color: "#111827",
    boxShadow: "0 10px 25px rgba(15,23,42,0.18)",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  const headerRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#111827",
  };

  const subTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#4b5563",
    lineHeight: 1.4,
  };

  const gridWrapper: React.CSSProperties = {
    marginTop: 4,
    width: "100%",
  };

  const grid: React.CSSProperties = {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: 10,
  };

  const memoryCard: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 6px 16px rgba(15,23,42,0.18)",
    display: "flex",
    flexDirection: "column",
  };

  const memoryImageWrapper: React.CSSProperties = {
    width: "100%",
    height: 120,
    overflow: "hidden",
    cursor: "pointer",
  };

  const memoryImage: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  const memoryBody: React.CSSProperties = {
    padding: "6px 8px 8px 8px",
    fontSize: 12,
    color: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const memoryCaptionStyle: React.CSSProperties = {
    fontSize: 12,
  };

  const memoryDateStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#4b5563",
  };

  const stateTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#f9fafb",
    marginTop: 8,
    textAlign: "center",
  };

  const errorTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: "#b91c1c",
    marginTop: 6,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    padding: "4px 8px",
  };

  const editInput: React.CSSProperties = {
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "4px 6px",
    fontSize: 11,
    width: "100%",
    boxSizing: "border-box",
  };

  const editButtonsRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 4,
  };

  const smallBtn: React.CSSProperties = {
    flex: 1,
    border: "none",
    borderRadius: 999,
    padding: "4px 6px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  };

  // fullscreen overlay styles
  const fullScreenOverlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    padding: "16px",
    boxSizing: "border-box",
  };

  const fullScreenInnerStyle: React.CSSProperties = {
    position: "relative",
    maxWidth: "100%",
    maxHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  };

  const fullScreenImageStyle: React.CSSProperties = {
    maxWidth: "100%",
    maxHeight: "80vh",
    borderRadius: 18,
    objectFit: "contain",
    boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
    backgroundColor: "#000",
  };

  const fullScreenCloseBtn: React.CSSProperties = {
    position: "absolute",
    top: -6,
    right: -6,
    border: "none",
    borderRadius: "999px",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    color: "#f9fafb",
    cursor: "pointer",
    fontSize: 18,
  };

  const fullScreenCaptionStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#f9fafb",
    textAlign: "center",
    marginTop: 6,
    maxWidth: "90%",
  };

  const fullScreenDateStyle: React.CSSProperties = {
    fontSize: 11,
    color: "#e5e7eb",
  };

  // add-memory modal styles
  const addOverlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15,23,42,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 55,
    backdropFilter: "blur(6px)",
  };

  const addModalStyle: React.CSSProperties = {
    width: "90%",
    maxWidth: 380,
    background:
      "linear-gradient(145deg, #fef9c3 0%, #f5e9d9 35%, #e0ecff 100%)",
    borderRadius: 24,
    padding: "16px 14px 14px 14px",
    boxShadow: "0 20px 45px rgba(15,23,42,0.5)",
    color: "#111827",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };

  const addHeaderRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  };

  const addTitleStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 700,
    fontSize: 15,
  };

  const addSmallIconBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
    cursor: "pointer",
    boxShadow: "0 3px 8px rgba(15,23,42,0.15)",
  };

  const addHintText: React.CSSProperties = {
    fontSize: 12,
    color: "#4b5563",
  };

  const addFormRow: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 6,
    padding: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
  };

  const addSmallLabel: React.CSSProperties = {
    fontSize: 11,
    color: "#4b5563",
  };

  const addInput: React.CSSProperties = {
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "4px 6px",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box",
  };

  const addSubmitBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "8px 12px",
    backgroundColor: "#2563eb",
    color: "#f9fafb",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
    marginTop: 4,
  };

  const addErrorText: React.CSSProperties = {
    fontSize: 11,
    color: "#b91c1c",
    marginTop: 4,
  };

  // delete confirmation modal styles
  const confirmOverlayStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
    padding: 20,
    boxSizing: "border-box",
    backdropFilter: "blur(4px)",
  };

  const confirmBoxStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 360,
    backgroundColor: CREAM,
    borderRadius: 24,
    padding: "22px 18px 18px",
    boxShadow: "0 16px 40px rgba(15,23,42,0.28)",
    textAlign: "center",
    boxSizing: "border-box",
  };

  const confirmTitleStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    color: "#3565AF",
    marginBottom: 8,
  };

  const confirmTextStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 1.5,
    marginBottom: 20,
  };

  const confirmActionsStyle: React.CSSProperties = {
    display: "flex",
    gap: 10,
  };

  const cancelConfirmBtnStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontWeight: 700,
    fontSize: 14,
    backgroundColor: "#ffffff",
    color: "#374151",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(15,23,42,0.10)",
  };

  const deleteConfirmBtnStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontWeight: 700,
    fontSize: 14,
    backgroundColor: "#dc2626",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(220,38,38,0.22)",
  };

  // Bottom nav
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
    fontSize: 13,
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        {/* TOP NAV */}
        <div style={topSectionStyle}>
          <button
            type="button"
            style={homeBtnStyle}
            onClick={() => navigate("/journey")}
            aria-label="Back to Journey"
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
        <div style={bottomSectionStyle}>
          <div style={innerContentStyle}>
            <div style={headerCard}>
              <div style={headerRow}>
                <div style={titleStyle}>
                  <span role="img" aria-label="camera">
                    📷
                  </span>
                  <span>Your Happy Memories</span>
                </div>
              </div>

              <div style={subTextStyle}>
                A gentle gallery of moments worth remembering. When things feel
                heavy, come back here and remind yourself of brighter days. 💙
              </div>

              {error && <div style={errorTextStyle}>{error}</div>}
            </div>

            <div style={gridWrapper}>
              {loading ? (
                <div style={stateTextStyle}>Loading your photos...</div>
              ) : memories.length === 0 ? (
                <div style={stateTextStyle}>
                  You don&apos;t have any saved memories yet. Add some happy
                  moments with the button below 📷
                </div>
              ) : (
                <div style={grid}>
                  {memories.map((m) => {
                    const imgSrc = m.image_url.startsWith("http")
                      ? m.image_url
                      : `${API_BASE}${
                          m.image_url.startsWith("/") ? "" : "/"
                        }${m.image_url}`;

                    const isEditing = editingId === m.memory_id;

                    return (
                      <div key={m.memory_id} style={memoryCard}>
                        <div
                          style={memoryImageWrapper}
                          onClick={() => setFullScreenMemory(m)}
                        >
                          <img
                            src={imgSrc}
                            alt={m.caption ?? "Happy memory"}
                            style={memoryImage}
                          />
                        </div>

                        <div style={memoryBody}>
                          {isEditing ? (
                            <>
                              <div style={{ fontSize: 11, color: "#4b5563" }}>
                                Edit caption
                              </div>

                              <input
                                type="text"
                                value={editCaption}
                                onChange={(e) =>
                                  setEditCaption(e.target.value)
                                }
                                style={editInput}
                              />

                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#4b5563",
                                  marginTop: 4,
                                }}
                              >
                                Edit date
                              </div>

                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                style={editInput}
                              />

                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#4b5563",
                                  marginTop: 4,
                                }}
                              >
                                Change picture (optional)
                              </div>

                              {isNative ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleChooseEditMemoryPhoto}
                                  style={{
                                    border: "none",
                                    borderRadius: 999,
                                    padding: "6px 10px",
                                    backgroundColor: "#2563eb",
                                    color: "#f9fafb",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    marginTop: 4,
                                  }}
                                >
                                  {editFile ? "Change new picture" : "Choose new picture"}
                                </button>

                                {editFile && (
                                  <div style={{ marginTop: 4, fontSize: 10, color: "#2563eb" }}>
                                    Selected: {editFile.name}
                                  </div>
                                )}
                              </>
                            ) : (
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  setEditFile(
                                    e.target.files && e.target.files[0]
                                      ? e.target.files[0]
                                      : null
                                  )
                                }
                                style={{
                                  fontSize: 10,
                                  marginTop: 2,
                                }}
                              />
                            )}

                              <div style={editButtonsRow}>
                                <button
                                  type="button"
                                  style={{
                                    ...smallBtn,
                                    backgroundColor: "#2563eb",
                                    color: "#f9fafb",
                                  }}
                                  onClick={handleSaveEdit}
                                  disabled={savingEdit}
                                >
                                  {savingEdit ? "Saving..." : "Save"}
                                </button>

                                <button
                                  type="button"
                                  style={{
                                    ...smallBtn,
                                    backgroundColor: "#e5e7eb",
                                    color: "#111827",
                                  }}
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {m.caption && (
                                <div style={memoryCaptionStyle}>
                                  “{m.caption}”
                                </div>
                              )}

                              {m.memory_date && (
                                <div style={memoryDateStyle}>
                                  {m.memory_date}
                                </div>
                              )}

                              <div style={editButtonsRow}>
                                <button
                                  type="button"
                                  style={{
                                    ...smallBtn,
                                    backgroundColor: "#2563eb",
                                    color: "#f9fafb",
                                  }}
                                  onClick={() => startEdit(m)}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  style={{
                                    ...smallBtn,
                                    backgroundColor: "#dc2626",
                                    color: "#f9fafb",
                                  }}
                                  onClick={() =>
                                    openDeleteConfirm(m.memory_id)
                                  }
                                  disabled={deletingId === m.memory_id}
                                >
                                  {deletingId === m.memory_id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FULLSCREEN IMAGE OVERLAY */}
        {fullScreenMemory && (
          <div style={fullScreenOverlayStyle}>
            <div style={fullScreenInnerStyle}>
              <button
                type="button"
                style={fullScreenCloseBtn}
                onClick={() => setFullScreenMemory(null)}
                aria-label="Close full screen image"
              >
                ✕
              </button>

              <img
                src={
                  fullScreenMemory.image_url.startsWith("http")
                    ? fullScreenMemory.image_url
                    : `${API_BASE}${
                        fullScreenMemory.image_url.startsWith("/") ? "" : "/"
                      }${fullScreenMemory.image_url}`
                }
                alt={fullScreenMemory.caption ?? "Happy memory"}
                style={fullScreenImageStyle}
              />

              {fullScreenMemory.caption && (
                <div style={fullScreenCaptionStyle}>
                  “{fullScreenMemory.caption}”
                </div>
              )}

              {fullScreenMemory.memory_date && (
                <div style={fullScreenDateStyle}>
                  {fullScreenMemory.memory_date}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADD MEMORY MODAL */}
        {showAddModal && (
          <div style={addOverlayStyle}>
            <div style={addModalStyle}>
              <div style={addHeaderRow}>
                <div style={addTitleStyle}>
                  <span role="img" aria-label="camera">
                    📷
                  </span>
                  <span>Add a happy memory</span>
                </div>

                <button
                  type="button"
                  style={addSmallIconBtn}
                  onClick={() => setShowAddModal(false)}
                >
                  ✕
                </button>
              </div>

              <div style={addHintText}>
                Choose a photo that reminds you of a calm, joyful, or proud
                moment. You can always come back and edit it later. 💙
              </div>

              <form onSubmit={handleUploadNewMemory} style={addFormRow}>
                <div>
                  <div style={addSmallLabel}>Photo</div>

                  {isNative ? (
                  <>
                    <button
                      type="button"
                      onClick={handleChooseNewMemoryPhoto}
                      style={{
                        border: "none",
                        borderRadius: 999,
                        padding: "8px 12px",
                        backgroundColor: "#2563eb",
                        color: "#f9fafb",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
                        marginTop: 4,
                      }}
                    >
                      {newFile ? "Change photo" : "Choose photo"}
                    </button>

                    {newFile && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#2563eb" }}>
                        Selected: {newFile.name}
                      </div>
                    )}
                  </>
                ) : (
                  <input
                    id="add-memory-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewFile(
                        e.target.files && e.target.files[0]
                          ? e.target.files[0]
                          : null
                      )
                    }
                    style={{ fontSize: 11, marginTop: 2 }}
                  />
                )}
                </div>

                <div>
                  <div style={addSmallLabel}>Caption (optional)</div>

                  <input
                    type="text"
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    style={addInput}
                    placeholder="A short note about this moment"
                  />
                </div>

                <div>
                  <div style={addSmallLabel}>Date (optional)</div>

                  <input
                    type="date"
                    value={newMemoryDate}
                    onChange={(e) => setNewMemoryDate(e.target.value)}
                    style={addInput}
                  />
                </div>

                <button
                  type="submit"
                  style={addSubmitBtn}
                  disabled={uploadingNew}
                >
                  {uploadingNew ? "Saving..." : "Save memory"}
                </button>

                {addError && <div style={addErrorText}>{addError}</div>}
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRM MODAL */}
        {showDeleteConfirm && (
          <div style={confirmOverlayStyle} onClick={closeDeleteConfirm}>
            <div style={confirmBoxStyle} onClick={(e) => e.stopPropagation()}>
              <div style={confirmTitleStyle}>Delete memory?</div>

              <div style={confirmTextStyle}>
                Are you sure you want to delete this happy photo memory?
                <br />
                This action cannot be undone.
              </div>

              <div style={confirmActionsStyle}>
                <button
                  type="button"
                  style={{
                    ...cancelConfirmBtnStyle,
                    opacity: deletingId ? 0.7 : 1,
                    cursor: deletingId ? "default" : "pointer",
                  }}
                  onClick={closeDeleteConfirm}
                  disabled={!!deletingId}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={{
                    ...deleteConfirmBtnStyle,
                    opacity: deletingId === memoryToDelete ? 0.7 : 1,
                    cursor:
                      deletingId === memoryToDelete ? "default" : "pointer",
                  }}
                  onClick={handleDeleteMemoryConfirmed}
                  disabled={deletingId === memoryToDelete}
                >
                  {deletingId === memoryToDelete ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM NAV */}
        <div style={bottomNavStyle}>
          <div
            style={navItemStyle}
            onClick={() => navigate("/profile")}
            role="button"
            aria-label="Profile"
          >
            <div style={{ fontSize: 22 }}>👤</div>
            <div>Profile</div>
          </div>

          <div
            style={navItemStyle}
            onClick={() => setShowAddModal(true)}
            role="button"
            aria-label="Add memories"
          >
            <strong>
              <div style={{ fontSize: 22 }}>+</div>
            </strong>
            <div>Add memory</div>
          </div>

          <div
            style={navItemStyle}
            onClick={() => navigate("/chat")}
            role="button"
            aria-label="AI Chat"
          >
            <div style={{ fontSize: 22 }}>💬</div>
            <div>Ai Chat</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoMemoriesPage;