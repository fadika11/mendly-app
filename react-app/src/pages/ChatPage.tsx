// react-app/src/pages/ChatPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/mendly-logo.jpg";
import {
  sendChatToAI,
  getAiChatHistory,
  clearAiChatHistory,
  type AiMessage,
} from "../api/auth";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

type TopicKey =
  | "anxiety"
  | "low_mood"
  | "stress"
  | "sleep"
  | "motivation"
  | "routine";

interface SuggestionQA {
  id: number;
  topic: TopicKey;
  question: string;
  answer: string;
}

const SUGGESTED_QA: SuggestionQA[] = [
  {
    id: 1,
    topic: "anxiety",
    question: "How can I calm down when I feel anxious?",
    answer:
      "When anxiety shows up, start with your body: take 5 slow breaths (inhale 4s, hold 2s, exhale 6s). Then name what you feel in one sentence, like “I’m worried about tomorrow’s exam.” Finally, pick one tiny step that helps—preparing your bag, planning a break, or texting someone you trust.",
  },
  {
    id: 2,
    topic: "low_mood",
    question: "What can I do if I'm feeling sad or low today?",
    answer:
      "Low days are normal and temporary. Try three small things: 1) get light and fresh air for 2–5 minutes, 2) move gently (short walk, stretches), 3) reach out to one safe person with a simple message like “Today feels heavy.” You don’t need to fix everything—just support yourself for today.",
  },
  {
    id: 3,
    topic: "stress",
    question: "How can I deal with stress from school or work?",
    answer:
      "Write down everything stressing you into a quick list. Then choose ONE task you can move forward in 10–15 minutes and focus only on that. Turn off other tabs/notifications while you do it. After that, take a short break and choose the next small step. Progress in tiny pieces beats trying to handle everything at once.",
  },
  {
    id: 4,
    topic: "sleep",
    question: "What should I do before sleep to relax my mind?",
    answer:
      "About 30 minutes before sleep, switch to a wind-down mode: lower the lights, put your phone away, and do something calm like reading, stretching, or listening to soft music. Write tomorrow’s tasks on paper so your brain doesn’t keep repeating them. As you lie in bed, focus on breathing slowly and relaxing your shoulders.",
  },
  {
    id: 5,
    topic: "motivation",
    question: "How do I stay motivated when I feel tired or lazy?",
    answer:
      "Shrink the goal until it feels almost too easy: instead of finishing everything, try working for 5–10 minutes or starting the first question. Tell yourself you can stop after that. Often motivation appears after you begin. Also check basics—sleep, food, and breaks—because low energy can look like low motivation.",
  },
  {
    id: 6,
    topic: "routine",
    question: "How can I build a more positive daily routine?",
    answer:
      "Pick 1–2 tiny habits to start with, like a 3-minute morning stretch or writing one sentence about how you feel at night. Keep them small enough that you can actually repeat them. When something works, keep it simple and consistent instead of making it perfect.",
  },
];

const TOPIC_FILTERS: { key: TopicKey; label: string; emoji: string }[] = [
  { key: "anxiety", label: "Anxiety & Worry", emoji: "💭" },
  { key: "low_mood", label: "Sad / Low", emoji: "💙" },
  { key: "stress", label: "Stress & Load", emoji: "📚" },
  { key: "sleep", label: "Sleep", emoji: "🌙" },
  { key: "motivation", label: "Motivation", emoji: "⚡" },
  { key: "routine", label: "Daily Routine", emoji: "📅" },
];

const INITIAL_ASSISTANT_MESSAGE =
  "Hi, I'm your Mendly companion. You can ask me about mood, stress, anxiety, sleep, motivation, routines, and emotional wellbeing. Or tap one of the ideas below to get started 💬";

const ChatPage: React.FC = () => {
  const navigate = useNavigate();

  const BLUE = "#6BA7E6";
  const CREAM = "#f5e9d9";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedTopic, setSelectedTopic] = useState<TopicKey | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<SuggestionQA[]>(
    () => SUGGESTED_QA.slice(0, 3)
  );
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtersContainerRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getAiChatHistory();

        if (history.length > 0) {
          setMessages(
            history.map((m: AiMessage) => ({
              role: m.role,
              content: m.content,
            }))
          );

          // Keep saved questions visible immediately when user enters chat.
          setShowSuggestions(true);
        } else {
          setMessages([{ role: "assistant", content: INITIAL_ASSISTANT_MESSAGE }]);
          setShowSuggestions(true);
        }

        shuffleSuggestions(null);
      } catch {
        setMessages([{ role: "assistant", content: INITIAL_ASSISTANT_MESSAGE }]);
        setShowSuggestions(true);
        shuffleSuggestions(null);
      } finally {
        setLoadingHistory(false);
        requestAnimationFrame(() => {
          chatEndRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        });
      }
    };

    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  };

  const scrollFilters = (dir: "left" | "right") => {
    const el = filtersContainerRef.current;
    if (!el) return;

    el.scrollBy({
      left: dir === "left" ? -150 : 150,
      behavior: "smooth",
    });
  };

  const shuffleSuggestions = (topicOverride?: TopicKey | null) => {
    const topic = topicOverride !== undefined ? topicOverride : selectedTopic;
    const pool = SUGGESTED_QA.filter((qa) => (topic ? qa.topic === topic : true));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setCurrentSuggestions(shuffled.slice(0, Math.min(3, shuffled.length)));
  };

  const handleFilterToggle = (key: TopicKey) => {
    setSelectedTopic((prev) => {
      const next = prev === key ? null : key;
      shuffleSuggestions(next);
      setShowSuggestions(true);
      return next;
    });
  };

  const sendTextToAI = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || loadingHistory) return;

    setError(null);

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };

    const nextMessages: ChatMessage[] = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setShowSuggestions(false);
    scrollToBottom();

    try {
      const reply = await sendChatToAI(nextMessages);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content:
          reply ||
          "I’m here with you. Could you tell me a little more about what’s been going on?",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      shuffleSuggestions(selectedTopic);
      setShowSuggestions(true);
    } catch (err: any) {
      const message =
        err?.message ||
        "The AI chat is unavailable right now. Please make sure the local AI is running.";

      setError(message);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
        },
      ]);

      setShowSuggestions(true);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const handleSuggestionClick = async (qa: SuggestionQA) => {
    await sendTextToAI(qa.question);
  };

  const handleSend = async () => {
    await sendTextToAI(input);
  };

  const handleClearChatConfirmed = async () => {
    try {
      await clearAiChatHistory();
      setMessages([{ role: "assistant", content: INITIAL_ASSISTANT_MESSAGE }]);
      setShowSuggestions(true);
      setShowClearConfirm(false);
      setError(null);
      shuffleSuggestions(null);
      scrollToBottom();
    } catch {
      setShowClearConfirm(false);
      setError("Failed to clear chat.");
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = async (
    e
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
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
    height: "100vh",
    maxWidth: 450,
    margin: "0 auto",
    backgroundColor: BLUE,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  };

  const topSectionStyle: React.CSSProperties = {
    backgroundColor: CREAM,
    paddingTop: 16,
    paddingBottom: 14,
    paddingInline: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    zIndex: 5,
    flexShrink: 0,
  };

  const backButtonStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "none",
    backgroundColor: "#3970aa",
    color: "#fff",
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const clearButtonStyle: React.CSSProperties = {
    border: "none",
    backgroundColor: "#e57373",
    color: "#fff",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };

  const titleBlockStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  };

  const appRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const tinyLogoStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: "50%",
    overflow: "hidden",
    backgroundColor: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const tinyLogoImgStyle: React.CSSProperties = {
    width: "130%",
    height: "130%",
    objectFit: "cover",
  };

  const smallLabelStyle: React.CSSProperties = {
    color: "#5F8DD0",
    fontWeight: 700,
    fontSize: 18,
  };

  const headerTitleStyle: React.CSSProperties = {
    color: "#2d4f7c",
    fontWeight: 700,
    fontSize: 13,
  };

  const filterWrapStyle: React.CSSProperties = {
    padding: "12px 10px 8px",
    position: "relative",
    flexShrink: 0,
  };

  const filterScrollerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const filtersViewportStyle: React.CSSProperties = {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    flex: 1,
    paddingBottom: 2,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  };

  const filterArrowStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: "none",
    backgroundColor: "rgba(255,255,255,0.75)",
    color: "#2d4f7c",
    cursor: "pointer",
    fontWeight: 700,
    flexShrink: 0,
  };

  const filterChipBase: React.CSSProperties = {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.55)",
    padding: "8px 12px",
    backgroundColor: "rgba(255,255,255,0.28)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const middleAreaStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const chatAreaStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "8px 14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };

  const bubbleRowUser: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
  };

  const bubbleRowAssistant: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-start",
  };

  const bubbleBase: React.CSSProperties = {
    maxWidth: "82%",
    padding: "11px 13px",
    borderRadius: 18,
    fontSize: 14,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
  };

  const bubbleUser: React.CSSProperties = {
    ...bubbleBase,
    backgroundColor: "#2a5f97",
    color: "#fff",
    borderBottomRightRadius: 6,
  };

  const bubbleAssistant: React.CSSProperties = {
    ...bubbleBase,
    backgroundColor: CREAM,
    color: "#243447",
    borderBottomLeftRadius: 6,
  };

  const thinkingBubble: React.CSSProperties = {
    ...bubbleAssistant,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const suggestionsCard: React.CSSProperties = {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 18,
    padding: 12,
    backdropFilter: "blur(6px)",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    flexShrink: 0,
  };

  const suggestionsHeaderRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  };

  const suggestionsTitle: React.CSSProperties = {
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
  };

  const refreshButtonStyle: React.CSSProperties = {
    border: "none",
    backgroundColor: "rgba(255,255,255,0.8)",
    color: "#2d4f7c",
    borderRadius: 999,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  };

  const suggestionButton: React.CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: 14,
    padding: "10px 12px",
    marginBottom: 8,
    backgroundColor: CREAM,
    color: "#243447",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    fontSize: 13,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  };

  const composerWrap: React.CSSProperties = {
    padding: 12,
    paddingBottom: 16,
    backgroundColor: CREAM,
    boxShadow: "0 -4px 12px rgba(0,0,0,0.08)",
    flexShrink: 0,
  };

  const errorTextStyle: React.CSSProperties = {
    color: "#b91c1c",
    fontSize: 12,
    marginBottom: 8,
  };

  const composerRow: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  };

  const textareaStyle: React.CSSProperties = {
    flex: 1,
    height: 40,
    minHeight: 40,
    maxHeight: 40,
    resize: "none",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    padding: "9px 12px",
    fontSize: 14,
    lineHeight: 1.2,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    overflowY: "hidden",
  };

  const sendButtonStyle: React.CSSProperties = {
    border: "none",
    borderRadius: 14,
    padding: "12px 14px",
    backgroundColor: sending ? "#93c5fd" : "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: sending ? "default" : "pointer",
    minWidth: 74,
  };

  const confirmOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
    boxSizing: "border-box",
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

  const clearConfirmBtnStyle: React.CSSProperties = {
    flex: 1,
    border: "none",
    borderRadius: 999,
    padding: "12px 14px",
    fontWeight: 700,
    fontSize: 14,
    backgroundColor: "#3565AF",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(53,101,175,0.22)",
  };

  return (
    <div style={screenStyle}>
      <div style={phoneStyle}>
        <div style={topSectionStyle}>
          <button
            type="button"
            style={backButtonStyle}
            onClick={() => navigate("/journey")}
            aria-label="Back"
          >
            ×
          </button>

          <div style={titleBlockStyle}>
            <div style={appRowStyle}>
              <div style={tinyLogoStyle}>
                <img src={logo} alt="Mendly logo" style={tinyLogoImgStyle} />
              </div>
              <span style={smallLabelStyle}>Mendly App</span>
            </div>
            <span style={headerTitleStyle}>Chat with AI</span>
          </div>

          <button
            type="button"
            style={clearButtonStyle}
            onClick={() => setShowClearConfirm(true)}
          >
            Clear
          </button>
        </div>

        <div style={filterWrapStyle}>
          <div style={filterScrollerRow}>
            <button
              type="button"
              style={filterArrowStyle}
              onClick={() => scrollFilters("left")}
            >
              ‹
            </button>

            <div ref={filtersContainerRef} style={filtersViewportStyle}>
              {TOPIC_FILTERS.map((item) => {
                const active = selectedTopic === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleFilterToggle(item.key)}
                    style={{
                      ...filterChipBase,
                      backgroundColor: active
                        ? "#2a5f97"
                        : "rgba(255,255,255,0.28)",
                      borderColor: active
                        ? "#2a5f97"
                        : "rgba(255,255,255,0.55)",
                    }}
                  >
                    <span style={{ marginRight: 6 }}>{item.emoji}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              style={filterArrowStyle}
              onClick={() => scrollFilters("right")}
            >
              ›
            </button>
          </div>
        </div>

        <div style={middleAreaStyle}>
          <div style={chatAreaStyle}>
            {loadingHistory ? (
              <div style={bubbleRowAssistant}>
                <div style={bubbleAssistant}>Loading chat...</div>
              </div>
            ) : (
              <>
                {messages.map((m, idx) => {
                  const isUser = m.role === "user";

                  return (
                    <div
                      key={idx}
                      style={isUser ? bubbleRowUser : bubbleRowAssistant}
                    >
                      <div style={isUser ? bubbleUser : bubbleAssistant}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div style={bubbleRowAssistant}>
                    <div style={thinkingBubble}>Thinking...</div>
                  </div>
                )}

                {showSuggestions && currentSuggestions.length > 0 && (
                  <div style={suggestionsCard}>
                    <div style={suggestionsHeaderRow}>
                      <div style={suggestionsTitle}>You may want to know…</div>

                      <button
                        type="button"
                        style={refreshButtonStyle}
                        onClick={() => shuffleSuggestions()}
                      >
                        ⟳
                      </button>
                    </div>

                    {currentSuggestions.map((qa) => (
                      <button
                        key={qa.id}
                        type="button"
                        style={suggestionButton}
                        onClick={() => handleSuggestionClick(qa)}
                        disabled={sending || loadingHistory}
                      >
                        <span>💡</span>
                        <span>{qa.question}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        <div style={composerWrap}>
          {error && <div style={errorTextStyle}>{error}</div>}

          <div style={composerRow}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about mood, stress, motivation..."
              style={textareaStyle}
              disabled={sending || loadingHistory}
            />

            <button
              type="button"
              onClick={handleSend}
              style={sendButtonStyle}
              disabled={sending || loadingHistory || !input.trim()}
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>

        {showClearConfirm && (
          <div
            style={confirmOverlayStyle}
            onClick={() => setShowClearConfirm(false)}
          >
            <div
              style={confirmBoxStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={confirmTitleStyle}>Clear chat?</div>

              <div style={confirmTextStyle}>
                Are you sure you want to clear this chat?
                <br />
                This action cannot be undone.
              </div>

              <div style={confirmActionsStyle}>
                <button
                  type="button"
                  style={cancelConfirmBtnStyle}
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={clearConfirmBtnStyle}
                  onClick={handleClearChatConfirmed}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;