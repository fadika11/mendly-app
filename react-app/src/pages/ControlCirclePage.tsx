// react-app/src/pages/ControlCirclePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import logo from "../assets/mendly-logo.jpg";
import {
  listControlCirclePrompts,
  saveControlCircleEntry,
  type ControlCirclePrompt,
  type ControlCircleEntry,
} from "../api/auth";
import HappyPhotoMemoriesButton from "../components/HappyPhotoMemoriesButton";

const ORIGINAL_CARDS_COUNT = 8;
//const isNative = (window as any).Capacitor?.isNativePlatform?.() ?? false;
//const API_BASE = isNative
  //? "http://10.0.2.2:8000"
  //: (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

type CardItem = {
  id: string;
  label: string;
  prompt_id?: string | null;
};

type Zone = "can_control" | "cannot_control";


function DraggableCard({ item }: { item: CardItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      data: item,
    });

  const style: React.CSSProperties = {
  transform: CSS.Translate.toString(transform),
  opacity: isDragging ? 0.65 : 1,
  touchAction: "none",
  cursor: "grab",
  userSelect: "none",
  backgroundColor: "#f5e9d9",
  color: "#0f172a",
  borderRadius: 999,
  padding: "6px 7px",
  fontSize: 10.5,
  fontWeight: 850,
  lineHeight: 1.15,
  boxShadow: "0 6px 12px rgba(15,23,42,0.14)",
  border: "1px solid rgba(53,101,175,0.16)",
  textAlign: "center",
  width: "100%",
  maxWidth: "100%",
  minHeight: 32,
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {item.label}
    </div>
  );
}

function DropCircle({
  id,
  title,
  subtitle,
  emoji,
  children,
  variant,
  enableOverflow,
}: {
  id: Zone;
  title: string;
  subtitle: string;
  emoji: string;
  children: React.ReactNode;
  variant: "cannot" | "can";
  enableOverflow?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const isCan = variant === "can";

  const style: React.CSSProperties = {
    width: 355,
    height: 355,
    borderRadius: "50%",
    backgroundColor: isCan
      ? "rgba(245,233,217,0.96)"
      : "rgba(255,255,255,0.25)",
    border: isCan
      ? "4px solid rgba(42,95,151,0.9)"
      : "4px dashed rgba(245,233,217,0.95)",
    color: isCan ? "#2a5f97" : "#ffffff",
    display: "flex",
    flexDirection: "column",
    padding: 18,
    boxSizing: "border-box",
    boxShadow: isOver
      ? "0 0 0 8px rgba(244,197,143,0.45), 0 16px 35px rgba(15,23,42,0.22)"
      : "0 12px 28px rgba(15,23,42,0.18)",
    transform: isOver ? "scale(1.03)" : "scale(1)",
    transition: "all 0.15s ease",
    margin: "0 auto",
  };

  const headStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: 4,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1.1,
  };

  const subStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 750,
    marginTop: 4,
    opacity: 0.9,
    lineHeight: 1.15,
  };

  const insideStyle: React.CSSProperties = {
  width: "78%",
  height: "55%",
  margin: "8px auto 0 auto",
  borderRadius: 26,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gridAutoRows: "minmax(32px, auto)",
  gap: 7,
  alignContent: enableOverflow ? "start" : "center",
  justifyItems: "stretch",
  padding: 8,
  backgroundColor: isCan
    ? "rgba(255,255,255,0.28)"
    : "rgba(255,255,255,0.10)",
  boxSizing: "border-box",
  overflowY: enableOverflow ? "auto" : "hidden",
  overflowX: "hidden",
};

  return (
    <div ref={setNodeRef} style={style}>
      <div style={headStyle}>
        <div style={{ fontSize: 26 }}>{emoji}</div>
        <div style={titleStyle}>{title}</div>
        <div style={subStyle}>{subtitle}</div>
      </div>

      <div style={insideStyle}>{children}</div>

      {enableOverflow && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            textAlign: "center",
            marginTop: 4,
            opacity: 0.85,
          }}
        >
          Scroll to see more cards
        </div>
      )}
    </div>
  );
}

const ControlCirclePage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [originalCards, setOriginalCards] = useState<CardItem[]>([]);
  const [allCards, setAllCards] = useState<CardItem[]>([]);
  const [cannotCards, setCannotCards] = useState<CardItem[]>([]);
  const [canCards, setCanCards] = useState<CardItem[]>([]);

  const [customText, setCustomText] = useState("");
  const [notes, setNotes] = useState<ControlCircleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8,
      },
    })
  );

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        setLoading(true);
        setError(null);

        const data: ControlCirclePrompt[] = await listControlCirclePrompts();

        const promptCards: CardItem[] = data.map((p) => ({
          id: `prompt-${p.prompt_id}`,
          label: p.label,
          prompt_id: p.prompt_id,
        }));

        setOriginalCards(promptCards);
        setAllCards(promptCards);
        setCannotCards(promptCards);
        setCanCards([]);
      } catch (e: any) {
        setError(e?.message || "Failed to load Circle of Control.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate]);

  const addCustomCard = () => {
    const clean = customText.trim();

    if (!clean) return;

    const item: CardItem = {
      id: `custom-${Date.now()}`,
      label: clean,
      prompt_id: null,
    };

    setAllCards((prev) => [item, ...prev]);
    setCannotCards((prev) => [item, ...prev]);
    setCustomText("");
    setError(null);
  };

  const findCard = (id: string) => {
    return allCards.find((c) => c.id === id) || null;
  };

  const moveCardToZone = (card: CardItem, zone: Zone) => {
    if (zone === "can_control") {
      setCannotCards((prev) => prev.filter((c) => c.id !== card.id));
      setCanCards((prev) => {
        if (prev.some((c) => c.id === card.id)) return prev;
        return [card, ...prev];
      });
    } else {
      setCanCards((prev) => prev.filter((c) => c.id !== card.id));
      setCannotCards((prev) => {
        if (prev.some((c) => c.id === card.id)) return prev;
        return [card, ...prev];
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const overId = event.over?.id;

    if (overId !== "can_control" && overId !== "cannot_control") {
      return;
    }

    const card = findCard(String(event.active.id));

    if (!card) return;

    const selectedZone = overId as Zone;

    moveCardToZone(card, selectedZone);

    // If the card is moved back to "Cannot Handle",
    // remove its positive note because notes should appear only for cards in "Can Handle".
    if (selectedZone === "cannot_control") {
      setNotes((prev) => prev.filter((n) => n.prompt_text !== card.label));
      return;
    }

    // If the card is moved into "Can Handle", save it and show a note.
    try {
      setSaving(true);
      setError(null);

      const saved = await saveControlCircleEntry({
        prompt_id: card.prompt_id || null,
        prompt_text: card.label,
        selected_zone: "can_control",
      });

      setNotes((prev) => {
        const withoutSame = prev.filter((n) => n.prompt_text !== saved.prompt_text);
        return [saved, ...withoutSame];
      });
    } catch (e: any) {
      setError(e?.message || "Failed to save your choice.");
    } finally {
      setSaving(false);
    }
  };

  const resetExercise = () => {
    setAllCards(originalCards);
    setCannotCards(originalCards);
    setCanCards([]);
    setNotes([]);
    setCustomText("");
    setError(null);
  };


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

  const headerStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    padding: "18px 16px 14px",
    boxShadow: "0 5px 16px rgba(15,23,42,0.12)",
  };

  const headerRow: React.CSSProperties = {
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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
    width: 30,
    height: 30,
    borderRadius: "50%",
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  };

  const tinyLogoImgStyle: React.CSSProperties = {
    width: "150%",
    height: "150%",
    objectFit: "cover",
  };

  const brandTitle: React.CSSProperties = {
    color: "#3565AF",
    fontWeight: 800,
    fontSize: 18,
    display: "flex",
    alignItems: "center",
  };

  const brandSubtitle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 700,
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "14px 16px 18px",
    boxSizing: "border-box",
  };

  const introCard: React.CSSProperties = {
    backgroundColor: "rgba(245,233,217,0.22)",
    border: "1px solid rgba(255,255,255,0.24)",
    borderRadius: 22,
    padding: 14,
    color: "white",
    boxShadow: "0 12px 28px rgba(15,23,42,0.14)",
    marginBottom: 12,
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 17,
    fontWeight: 950,
    marginBottom: 6,
  };

  const bodyText: React.CSSProperties = {
    fontSize: 12.5,
    lineHeight: 1.45,
    fontWeight: 650,
    opacity: 0.95,
  };

  const inputRow: React.CSSProperties = {
    display: "flex",
    gap: 8,
    marginTop: 12,
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    outline: "none",
    borderRadius: 999,
    backgroundColor: CREAM,
    padding: "11px 13px",
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
  };

  const addBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    backgroundColor: "#F4C58F",
    color: "#3565AF",
    padding: "0 14px",
    fontWeight: 950,
    cursor: "pointer",
  };

  const resetBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    backgroundColor: "rgba(245,233,217,0.92)",
    color: "#3565AF",
    padding: "10px 14px",
    fontWeight: 950,
    cursor: "pointer",
    marginTop: 10,
    width: "100%",
  };

  const circlesWrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 18,
    margin: "14px 0",
  };

  const notesBox: React.CSSProperties = {
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 14,
    color: "#0f172a",
    boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
    marginTop: 12,
  };

  const noteItem: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(53,101,175,0.12)",
    borderRadius: 14,
    padding: 11,
    marginTop: 10,
  };

  const feedbackTitle: React.CSSProperties = {
    color: "#3565AF",
    fontWeight: 950,
    fontSize: 15,
    marginBottom: 6,
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
    boxShadow: "0 -2px 10px rgba(15, 23, 42, 0.15)",
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
        <div style={headerStyle}>
          <div style={headerRow}>
            <button
              type="button"
              style={{ ...roundBtn, left: 0 }}
              onClick={() => navigate("/journey")}
              aria-label="Back"
            >
              🏠
            </button>

            <div>
              <div style={brandTitle}>
                <span style={tinyLogoStyle}>
                  <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
                </span>
                Mendly App
              </div>
              <div style={brandSubtitle}>Circle of Control</div>
            </div>

            <button
              type="button"
              style={{ ...roundBtn, right: 0 }}
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("user");
                navigate("/login", { replace: true });
              }}
              aria-label="Logout"
            >
              🚪
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={contentStyle}>
            <div style={introCard}>
              <div style={cardTitle}>Move what you can handle</div>
              <div style={bodyText}>
                All worries start in the first circle. Drag the cards you feel you
                can handle today into the second circle. Each moved card gives you
                a helpful note, and all notes stay visible.
              </div>

              <div style={inputRow}>
                <input
                  style={inputStyle}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Add your own worry..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustomCard();
                  }}
                />

                <button type="button" style={addBtn} onClick={addCustomCard}>
                  Add
                </button>
              </div>

              <button type="button" style={resetBtn} onClick={resetExercise}>
                Reset Exercise
              </button>
            </div>

            {loading && (
              <div
                style={{
                  color: "white",
                  fontWeight: 800,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Loading cards...
              </div>
            )}

            {saving && (
              <div
                style={{
                  color: "white",
                  fontWeight: 800,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Saving...
              </div>
            )}

            {error && (
              <div
                style={{
                  color: "#7f1d1d",
                  backgroundColor: CREAM,
                  borderRadius: 14,
                  padding: 10,
                  fontWeight: 800,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {error}
              </div>
            )}

            <div style={circlesWrap}>
              <DropCircle
                id="cannot_control"
                title="Things I Cannot Handle Yet"
                subtitle="Start here. Drag cards you can handle today to the second circle."
                emoji="☁️"
                variant="cannot"
                enableOverflow={cannotCards.length > ORIGINAL_CARDS_COUNT}
              >
                {cannotCards.length === 0 ? (
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
                    All cards were moved.
                  </div>
                ) : (
                  cannotCards.map((item) => (
                    <DraggableCard key={item.id} item={item} />
                  ))
                )}
              </DropCircle>

              <DropCircle
                id="can_control"
                title="Things I Can Handle"
                subtitle="Drop here what feels manageable today."
                emoji="🟦"
                variant="can"
                enableOverflow={canCards.length > ORIGINAL_CARDS_COUNT}
              >
                {canCards.length === 0 ? (
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>
                    Drop a card here.
                  </div>
                ) : (
                  canCards.map((item) => (
                    <DraggableCard key={item.id} item={item} />
                  ))
                )}
              </DropCircle>
            </div>

            <div style={notesBox}>
              <div style={feedbackTitle}>Positive notes</div>

              {notes.length === 0 ? (
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>
                  When you move a card into “Things I Can Handle,” your note will
                  appear here.
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.entry_id} style={noteItem}>
                    <div
                      style={{
                        color: "#3565AF",
                        fontWeight: 950,
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      {note.prompt_text}
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        fontWeight: 650,
                      }}
                    >
                      {note.feedback_message}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DndContext>

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

          <HappyPhotoMemoriesButton navItemStyle={navItemStyle} />

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

export default ControlCirclePage;