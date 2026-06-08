// react-app/src/api/auth.ts
import axios from "axios";

import { Capacitor } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform?.() ?? false;

export const API_BASE = isNative
  ? "http://10.0.2.2:8000"               // Android / iOS app
  : (import.meta.env.VITE_API_URL ?? "http://localhost:8000");  // browser


// ============== SIGNUP ==============

export const signup = (data: {
  username: string;
  email: string;
  password: string;
  age?: number;
  gender?: number;
}) => axios.post(`${API_BASE}/auth/signup`, data);

export function signupPsychologist(data: {
  username: string;
  email: string;
  password: string;
  age?: number;
  gender?: number;
  license_number: string;
}) {
  return axios.post(`${API_BASE}/auth/signup-psychologist`, data);
}


// ============== LOGIN ==============

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  role: "regular" | "psychologist";
}


export async function login(payload: LoginRequest): Promise<TokenResponse> {
  try {
    const { data } = await axios.post<TokenResponse>(
      `${API_BASE}/auth/login`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return data;
  } catch (err: any) {
    const detail = err?.response?.data?.detail;

    if (typeof detail === "string") {
      throw new Error(detail);
    }

    if (Array.isArray(detail)) {
      throw new Error("Invalid login details. Please check your username and password.");
    }

    if (err?.response?.status === 401 || err?.response?.status === 400) {
      throw new Error("Incorrect username or password.");
    }

    if (err?.code === "ERR_NETWORK") {
      throw new Error("Cannot connect to the server. Please make sure the backend is running.");
    }

    throw new Error("Login failed. Please try again.");
  }
}

// ============== FORGOT PASSWORD (EMAIL + CODE) ==============

export const requestPasswordReset = (data: { email: string }) =>
  axios.post(`${API_BASE}/auth/forgot-password/start`, data);

export const verifyPasswordReset = (data: {
  email: string;
  code: string;
  new_password: string;
}) => axios.post(`${API_BASE}/auth/forgot-password/verify`, data);

// ============== PROFILE TYPES ==============

export interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  age?: number | null;
  gender?: number | null; // 0=NA,1=F,2=M,3=Other
}

export interface UpdateProfilePayload {
  username: string;
  email: string;
  age?: number;
  gender?: number;
}

// ============== AUTH HEADER HELPER ==============

function buildAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("access_token") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

// ============== PROFILE REQUESTS (using fetch) ==============

export async function getProfile(): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to load profile: ${res.status}`);
  }
  return res.json();
}

export async function updateProfile(
  payload: UpdateProfilePayload
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "PUT",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to update profile: ${res.status}`);
  }
  return res.json();
}

// ============== CHANGE PASSWORD ==============

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to change password: ${res.status}`);
  }
}

// ====== JOURNEY / STATS TYPES & API ======

export interface JourneyDay {
  date: string; // ISO date "YYYY-MM-DD"
  avg_score: number | null;
}

export interface JourneySettings {
  checkin_frequency: number;
  motivation_enabled: boolean;
}

export interface JourneyOverview {
  settings: {
    checkin_frequency?: number;
    motivation_enabled?: boolean;
  };
  last7days: JourneyDay[];
}

export async function getJourneyOverview(): Promise<JourneyOverview> {
  const res = await fetch(`${API_BASE}/journey/overview`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load journey overview: ${res.status}`);
  }

  return res.json();
}

// ========== AI CHAT ==========

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string | null;
}

/*
export async function sendChatToAI(messages: AiMessage[]): Promise<string> {
  const token = localStorage.getItem("access_token");
  if (!token) {
    throw new Error("Not authenticated");
  }

  const userMessages = messages.filter((m) => m.role === "user");
  const latestUser = userMessages[userMessages.length - 1];

  if (!latestUser) {
    throw new Error("No user message found");
  }

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: latestUser.content,
      history: messages.slice(0, -1),
    }),
  });

  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "AI chat failed");
  }

  if (!res.ok) {
    throw new Error(data?.detail || "AI chat failed");
  }

  return data.reply || "";
}
*/

export async function sendChatToAI(messages: AiMessage[]): Promise<string> {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Not authenticated");

  const userMessages = messages.filter((m) => m.role === "user");
  const latestUser = userMessages[userMessages.length - 1];
  if (!latestUser) throw new Error("No user message found");

  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: latestUser.content,
      history: messages.slice(0, -1),
    }),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "AI chat failed");
  }

  if (!res.ok) {
    throw new Error(data?.detail || "AI chat failed");
  }

  return data.reply || "";
}

export async function getAiChatHistory(): Promise<AiMessage[]> {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/ai/chat/history`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let data: any = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error("Failed to load chat history");
  }

  if (!res.ok) {
    throw new Error(data?.detail || "Failed to load chat history");
  }

  return Array.isArray(data) ? data : [];
}

export async function clearAiChatHistory(): Promise<void> {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/ai/chat/history`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to clear chat history");
  }
}

// ---- CHECK-IN API ----

export async function submitMoodCheckin(payload: {
  score: number | null;
  label: string | null;
  note: string | null;
}): Promise<void> {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_BASE}/checkin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
}

export interface SeriesPoint {
  value: number;
  date: string;
  avg_score: number | null;
}

export async function getMoodSeries(days: number): Promise<SeriesPoint[]> {
  const res = await fetch(`${API_BASE}/journey/series?days=${days}`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


// ========== POSITIVE NOTIFICATIONS SETTINGS ==========

export interface PositiveNotificationSettings {
  enabled: boolean;
  frequency_minutes: number;
}

export async function getPositiveNotificationSettings(): Promise<PositiveNotificationSettings> {
  const res = await fetch(`${API_BASE}/positive-notifications/settings`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load positive notifications: ${res.status}`);
  }

  return res.json();
}

export async function updatePositiveNotificationSettings(
  payload: PositiveNotificationSettings
): Promise<PositiveNotificationSettings> {
  const res = await fetch(`${API_BASE}/positive-notifications/settings`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to update positive notifications: ${res.status}`);
  }

  return res.json();
}


export interface HappyMemory {
  memory_id: string;
  image_url: string;
  caption: string | null;
  memory_date: string | null;
  created_at: string;
}

export async function listHappyMemories(): Promise<HappyMemory[]> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`${API_BASE}/photo-memories`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to load happy memories");
  }

  return res.json();
}

export async function uploadHappyMemory(
  file: File,
  caption?: string,
  memoryDate?: string
): Promise<void> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Not logged in");

  const formData = new FormData();
  formData.append("file", file);
  if (caption) formData.append("caption", caption);
  if (memoryDate) formData.append("memory_date", memoryDate);

  const res = await fetch(`${API_BASE}/photo-memories/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to upload happy memory");
  }
}

export async function deleteHappyMemory(memoryId: string): Promise<void> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`${API_BASE}/photo-memories/${memoryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete happy memory");
  }
}

export interface WeeklyPhotoCandidate {
  show: boolean;
  memory?: {
    memory_id: string;
    image_url: string;
    caption: string | null;
    memory_date: string | null;
  };
  message?: string;
}

export async function getWeeklyPhotoCandidate(): Promise<WeeklyPhotoCandidate> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`${API_BASE}/photo-memories/weekly-candidate`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to load weekly photo candidate");
  }
  return res.json();
}



export interface PsyClient {
  user_id: string;
  username: string;
  email: string;
  age: number | null;
  gender: number | null;
  appointments_count: number;
  last_appointment_at: string | null;
}

export interface PsyAppointment {
  appointment_id: string;
  client_user_id: string;
  client_username: string;
  client_email: string;
  client_age: number | null;
  client_gender: number | null;
  intake_id: string | null;
  intake_answers_json: string | null;
  start_at: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function listPsyClients(): Promise<PsyClient[]> {
  const res = await fetch(`${API_BASE}/psy/clients`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listPsyAppointments(): Promise<PsyAppointment[]> {
  const res = await fetch(`${API_BASE}/psy/appointments`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface AudioMoodAnalysisResponse {
  ok: boolean;
  emotion?: string;
  confidence?: number;
  mendly_state?: string;
  message?: string;
  score_saved?: number;
  label_saved?: string;
  mood_source?: string;
  detail?: string;
  saved?: boolean;
}

export interface AudioMoodAnalysisResponse {
  ok: boolean;
  emotion?: string;
  confidence?: number;
  mendly_state?: string;
  message?: string;
  score_saved?: number;
  label_saved?: string;
  mood_source?: string;
  detail?: string;
  saved?: boolean;
}

export async function uploadAudioForMood(
  file: Blob,
  fileName = "mood-recording.wav"
): Promise<AudioMoodAnalysisResponse> {
  const token = window.localStorage.getItem("access_token");
  if (!token) throw new Error("Not logged in");

  const formData = new FormData();
  formData.append("file", file, fileName);

  const res = await fetch(`${API_BASE}/audio/analyze-mood`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const text = await res.text();

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "Audio upload failed");
  }

  if (!res.ok) {
    throw new Error(data?.detail?.detail || data?.detail || "Audio analysis failed");
  }

  return data;
}


// ====== PSYCHOLOGIST AVAILABILITY SLOTS ======

export interface AvailabilitySlot {
  slot_id: string;
  psychologist_user_id: string;
  start_at: string;
  end_at: string | null;
  is_booked: boolean;
  appointment_id: string | null;
  created_at: string | null;
}

export async function createPsyAvailabilitySlot(payload: {
  start_at: string;
  end_at?: string | null;
}): Promise<AvailabilitySlot> {
  const res = await fetch(`${API_BASE}/appointments/availability`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to create availability slot: ${res.status}`);
  }

  return res.json();
}

export async function listMyAvailabilitySlots(): Promise<AvailabilitySlot[]> {
  const res = await fetch(`${API_BASE}/appointments/availability/my`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load availability slots: ${res.status}`);
  }

  return res.json();
}

export async function deletePsyAvailabilitySlot(slotId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/appointments/availability/${slotId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to delete availability slot: ${res.status}`);
  }
}

export async function listAvailableSlotsForPsychologist(
  psychologistUserId: string,
  date: string
): Promise<AvailabilitySlot[]> {
  const params = new URLSearchParams({
    psychologist_user_id: psychologistUserId,
    date,
  });

  const res = await fetch(`${API_BASE}/appointments/availability?${params.toString()}`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load available times: ${res.status}`);
  }

  return res.json();
}


// ====== CIRCLE OF CONTROL ======

export interface ControlCirclePrompt {
  prompt_id: string;
  label: string;
  category_hint: string | null;
  can_control_message: string;
  cannot_control_message: string;
}

export interface ControlCircleEntry {
  entry_id: string;
  user_id: string;
  prompt_id: string | null;
  prompt_text: string;
  selected_zone: "can_control" | "cannot_control";
  feedback_message: string;
  created_at: string;
}

export async function listControlCirclePrompts(): Promise<ControlCirclePrompt[]> {
  const res = await fetch(`${API_BASE}/control-circle/prompts`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load Circle of Control prompts: ${res.status}`);
  }

  return res.json();
}

export async function saveControlCircleEntry(payload: {
  prompt_id?: string | null;
  prompt_text: string;
  selected_zone: "can_control" | "cannot_control";
}): Promise<ControlCircleEntry> {
  const res = await fetch(`${API_BASE}/control-circle/entries`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to save Circle of Control entry: ${res.status}`);
  }

  return res.json();
}

export async function listControlCircleHistory(): Promise<ControlCircleEntry[]> {
  const res = await fetch(`${API_BASE}/control-circle/history`, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load Circle of Control history: ${res.status}`);
  }

  return res.json();
}