import React, { useMemo, useState } from "react";
import {
  createPsyAvailabilitySlot,
  deletePsyAvailabilitySlot,
  listMyAvailabilitySlots,
  type AvailabilitySlot,
} from "../api/auth";

type Props = {
  style?: React.CSSProperties;
};

const PsyAvailabilityButton: React.FC<Props> = ({ style }) => {
  const CREAM = "#f5e9d9";
  const BTN = "#2a5f97";

  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [viewSlotsOpen, setViewSlotsOpen] = useState(false);

  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");

  const [viewDate, setViewDate] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotSuccess, setSlotSuccess] = useState<string | null>(null);

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 99999,
  };

  const modalStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85vh",
    overflowY: "auto",
    backgroundColor: CREAM,
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxSizing: "border-box",
  };

  const modalTitle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 900,
    color: "#3565AF",
    textAlign: "center",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    outline: "none",
    borderRadius: 999,
    padding: "12px 14px",
    backgroundColor: "rgba(255,255,255,0.9)",
    fontSize: 14,
  };

  const pillBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    backgroundColor: BTN,
    color: CREAM,
    padding: "11px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  };

  const closeModalBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    backgroundColor: "rgba(53,101,175,0.14)",
    color: "#3565AF",
    padding: "10px 12px",
    fontWeight: 900,
    cursor: "pointer",
  };

  const slotCard: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 14,
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  };

  const smallBtn: React.CSSProperties = {
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    backgroundColor: BTN,
    color: CREAM,
  };

  function getLocalTimezoneOffset() {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, "0");
    const minutes = String(abs % 60).padStart(2, "0");
    return `${sign}${hours}:${minutes}`;
  }

  function buildLocalDateTimeOffset(date: string, time: string) {
    return `${date}T${time}:00${getLocalTimezoneOffset()}`;
  }

  function formatDbDateTime(dt: string | null) {
    if (!dt) return "—";

    const raw = String(dt);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);

    if (match) {
      const [, y, m, d, hh, mm] = match;
      return `${d}/${m}/${y}, ${hh}:${mm}`;
    }

    return raw;
  }

  function formatDbTime(dt: string | null) {
    if (!dt) return "—";

    const raw = String(dt);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);

    if (match) {
      return `${match[4]}:${match[5]}`;
    }

    return raw;
  }

  function getDatePart(dt: string | null) {
    if (!dt) return "";

    const raw = String(dt);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) return "";

    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function slotBadge(isBooked: boolean): React.CSSProperties {
    return {
      borderRadius: 999,
      padding: "6px 10px",
      fontWeight: 900,
      fontSize: 11,
      backgroundColor: isBooked ? "#f59e0b" : "#16a34a",
      color: "white",
      whiteSpace: "nowrap",
    };
  }

  async function loadSlots() {
    try {
      setSlotsLoading(true);
      setSlotError(null);

      const data = await listMyAvailabilitySlots();
      setSlots(data);
    } catch (e: any) {
      setSlotError(e?.message || "Failed to load saved appointments.");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function addSlot() {
    try {
      setSlotError(null);
      setSlotSuccess(null);

      if (!slotDate || !slotTime) {
        setSlotError("Please choose date and time.");
        return;
      }

      const startAt = buildLocalDateTimeOffset(slotDate, slotTime);

      await createPsyAvailabilitySlot({
        start_at: startAt,
      });

      setSlotDate("");
      setSlotTime("");
      setSlotSuccess("Available appointment time saved.");

      await loadSlots();
    } catch (e: any) {
      setSlotError(e?.message || "Failed to save available time.");
    }
  }

  async function deleteSlot(slotId: string) {
    try {
      setSlotError(null);
      setSlotSuccess(null);

      await deletePsyAvailabilitySlot(slotId);

      setSlotSuccess("Available time deleted.");
      await loadSlots();
    } catch (e: any) {
      setSlotError(e?.message || "Failed to delete available time.");
    }
  }

  const filteredSlotsByDate = useMemo(() => {
    if (!viewDate) return [];
    return slots.filter((slot) => getDatePart(slot.start_at) === viewDate);
  }, [slots, viewDate]);

  return (
    <>
      <button
        type="button"
        style={style}
        onClick={() => {
          setSlotError(null);
          setSlotSuccess(null);
          setAvailabilityOpen(true);
          loadSlots();
        }}
        aria-label="Availability"
      >
        <span style={{ fontSize: 20 }}>📅</span> Availability
      </button>

      {availabilityOpen && (
        <div onClick={() => setAvailabilityOpen(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
            <div style={modalTitle}>Manage Available Appointments</div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "#3565AF" }}>
              Save a new available appointment time
            </div>

            <input
              style={inputStyle}
              type="date"
              value={slotDate}
              onChange={(e) => setSlotDate(e.target.value)}
            />

            <input
              style={inputStyle}
              type="time"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
            />

            <button type="button" style={pillBtn} onClick={addSlot}>
              Save Available Time
            </button>

            <button
              type="button"
              style={{
                ...pillBtn,
                backgroundColor: "rgba(53,101,175,0.14)",
                color: "#3565AF",
              }}
              onClick={async () => {
                setViewSlotsOpen(true);
                await loadSlots();
              }}
            >
              View Saved Appointments By Date
            </button>

            {slotError && (
              <div style={{ color: "#7f1d1d", fontWeight: 800, textAlign: "center" }}>
                {slotError}
              </div>
            )}

            {slotSuccess && (
              <div style={{ color: "#065f46", fontWeight: 800, textAlign: "center" }}>
                {slotSuccess}
              </div>
            )}

            <button type="button" style={closeModalBtn} onClick={() => setAvailabilityOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {viewSlotsOpen && (
        <div onClick={() => setViewSlotsOpen(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
            <div style={modalTitle}>Saved Appointments By Date</div>

            <input
              style={inputStyle}
              type="date"
              value={viewDate}
              onChange={(e) => setViewDate(e.target.value)}
            />

            <button type="button" style={pillBtn} onClick={loadSlots}>
              Refresh
            </button>

            {slotsLoading && (
              <div style={{ color: "#3565AF", fontWeight: 800, textAlign: "center" }}>
                Loading saved appointments...
              </div>
            )}

            {!slotsLoading && !viewDate && (
              <div style={{ color: "#3565AF", fontWeight: 800, textAlign: "center" }}>
                Choose a date to see saved appointments.
              </div>
            )}

            {!slotsLoading && viewDate && filteredSlotsByDate.length === 0 && (
              <div style={{ color: "#7f1d1d", fontWeight: 800, textAlign: "center" }}>
                No saved appointments in this date.
              </div>
            )}

            {!slotsLoading &&
              filteredSlotsByDate.map((slot) => (
                <div key={slot.slot_id} style={slotCard}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#3565AF" }}>
                      {formatDbTime(slot.start_at)}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {formatDbDateTime(slot.start_at)}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={slotBadge(slot.is_booked)}>
                      {slot.is_booked ? "Booked" : "Available"}
                    </span>

                    <button
                      type="button"
                      style={{
                        ...smallBtn,
                        opacity: slot.is_booked ? 0.5 : 1,
                        cursor: slot.is_booked ? "not-allowed" : "pointer",
                      }}
                      disabled={slot.is_booked}
                      onClick={() => deleteSlot(slot.slot_id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

            <button type="button" style={closeModalBtn} onClick={() => setViewSlotsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PsyAvailabilityButton;