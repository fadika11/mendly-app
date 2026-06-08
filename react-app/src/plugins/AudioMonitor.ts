import { registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type AudioEvent = {
  type: "CRY" | "SCREAM" | "SILENCE" | "SOUND";
  confidence: number;
  ts: string;
};

export type PermissionState =
  | "prompt"
  | "prompt-with-rationale"
  | "granted"
  | "denied";

export type AudioMonitorPermissions = {
  microphone: PermissionState;
  notifications?: PermissionState;
};

export type StopRecordingResult = {
  ok?: boolean;
  base64: string;
  mimeType: string;
  fileName: string;
  filename?: string;
  size?: number;
};

export interface AudioMonitorPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;

  isRunning(): Promise<{
    running: boolean;
    recording?: boolean;
  }>;

  startRecording(): Promise<{
    ok?: boolean;
    message?: string;
  }>;

  stopRecording(): Promise<StopRecordingResult>;

  addListener(
    eventName: "audioEvent",
    listenerFunc: (event: AudioEvent) => void
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}

export const AudioMonitor = registerPlugin<AudioMonitorPlugin>("AudioMonitor");