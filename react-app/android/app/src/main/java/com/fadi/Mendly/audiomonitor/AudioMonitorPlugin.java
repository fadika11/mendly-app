package com.fadi.Mendly.audiomonitor;

import android.Manifest;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
  name = "AudioMonitor",
  permissions = {
    @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
    @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
  }
)
public class AudioMonitorPlugin extends Plugin {

  private static final String TAG = "AudioMonitorPlugin";

  private static final int SAMPLE_RATE = 16000;
  private static final int CHANNEL_COUNT = 1;
  private static final int BITS_PER_SAMPLE = 16;

  private AudioRecord audioRecord;
  private Thread recordingThread;
  private final AtomicBoolean isRecording = new AtomicBoolean(false);
  private File wavFile;
  private long totalAudioLen = 0;

  @PluginMethod
  public void start(PluginCall call) {
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      requestPermissionForAlias("microphone", call, "onMicrophonePermsResult");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        getPermissionState("notifications") != PermissionState.GRANTED) {
      requestPermissionForAlias("notifications", call, "onNotificationPermsResult");
      return;
    }

    startService(call);
  }

  @PermissionCallback
  private void onMicrophonePermsResult(PluginCall call) {
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      call.reject("Microphone permission not granted");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        getPermissionState("notifications") != PermissionState.GRANTED) {
      requestPermissionForAlias("notifications", call, "onNotificationPermsResult");
      return;
    }

    startService(call);
  }

  @PermissionCallback
  private void onNotificationPermsResult(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        getPermissionState("notifications") != PermissionState.GRANTED) {
      call.reject("Notification permission not granted");
      return;
    }

    startService(call);
  }

  private void startService(PluginCall call) {
    try {
      Intent i = new Intent(getContext(), AudioMonitorService.class);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(i);
      } else {
        getContext().startService(i);
      }

      call.resolve();
    } catch (Exception e) {
      Log.e(TAG, "Failed to start monitor service", e);
      call.reject("Failed to start monitor service: " + e.getMessage());
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    try {
      Intent i = new Intent(getContext(), AudioMonitorService.class);
      getContext().stopService(i);
      call.resolve();
    } catch (Exception e) {
      Log.e(TAG, "Failed to stop monitor service", e);
      call.reject("Failed to stop monitor service: " + e.getMessage());
    }
  }

  @PluginMethod
  public void isRunning(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("running", AudioMonitorService.isRunningStatic());
    ret.put("recording", isRecording.get());
    call.resolve(ret);
  }

  @PluginMethod
  public void startRecording(PluginCall call) {
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      requestPermissionForAlias("microphone", call, "onStartRecordingPermissionResult");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        getPermissionState("notifications") != PermissionState.GRANTED) {
      requestPermissionForAlias("notifications", call, "onStartRecordingNotificationPermissionResult");
      return;
    }

    beginNativeRecording(call);
  }

  @PermissionCallback
  private void onStartRecordingPermissionResult(PluginCall call) {
    if (getPermissionState("microphone") != PermissionState.GRANTED) {
      call.reject("Microphone permission not granted");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        getPermissionState("notifications") != PermissionState.GRANTED) {
      requestPermissionForAlias("notifications", call, "onStartRecordingNotificationPermissionResult");
      return;
    }

    beginNativeRecording(call);
  }

  @PermissionCallback
  private void onStartRecordingNotificationPermissionResult(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        getPermissionState("notifications") != PermissionState.GRANTED) {
      call.reject("Notification permission not granted");
      return;
    }

    beginNativeRecording(call);
  }

  private void startRecordingNotificationService() {
    try {
      Intent intent = new Intent(getContext(), AudioRecordingNotificationService.class);

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(intent);
      } else {
        getContext().startService(intent);
      }
    } catch (Exception e) {
      Log.e(TAG, "Failed to start recording notification service", e);
    }
  }

  private void stopRecordingNotificationService() {
    try {
      Intent intent = new Intent(getContext(), AudioRecordingNotificationService.class);
      getContext().stopService(intent);
    } catch (Exception e) {
      Log.e(TAG, "Failed to stop recording notification service", e);
    }
  }

  private synchronized void beginNativeRecording(PluginCall call) {
    try {
      if (isRecording.get()) {
        call.reject("Recording is already in progress");
        return;
      }

      // Stop old monitor service so it does not compete for the mic
      Intent i = new Intent(getContext(), AudioMonitorService.class);
      getContext().stopService(i);

      // Show phone notification: "Mendly is listening"
      startRecordingNotificationService();

      int minBufferSize = AudioRecord.getMinBufferSize(
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT
      );

      if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
        stopRecordingNotificationService();
        call.reject("Could not initialize audio recorder buffer");
        return;
      }

      int bufferSize = Math.max(minBufferSize, 4096);

      audioRecord = new AudioRecord(
        MediaRecorder.AudioSource.MIC,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufferSize
      );

      if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
        cleanupRecording();
        call.reject("AudioRecord could not be initialized");
        return;
      }

      wavFile = new File(getContext().getCacheDir(), "mood-recording.wav");
      if (wavFile.exists()) {
        //noinspection ResultOfMethodCallIgnored
        wavFile.delete();
      }

      totalAudioLen = 0;

      try (RandomAccessFile raf = new RandomAccessFile(wavFile, "rw")) {
        raf.setLength(0);
        byte[] emptyHeader = new byte[44];
        raf.write(emptyHeader);
      }

      writeWavHeader(wavFile, 0, SAMPLE_RATE, CHANNEL_COUNT, BITS_PER_SAMPLE);

      audioRecord.startRecording();
      isRecording.set(true);

      recordingThread = new Thread(() -> writeAudioDataToFile(bufferSize), "MendlyWavRecorder");
      recordingThread.start();

      Log.d(TAG, "Native WAV recording started: " + wavFile.getAbsolutePath());

      JSObject ret = new JSObject();
      ret.put("ok", true);
      ret.put("message", "Recording started");
      call.resolve(ret);

    } catch (Exception e) {
      Log.e(TAG, "Failed to start WAV recording", e);
      cleanupRecording();
      call.reject("Could not start native audio recording: " + e.getMessage());
    }
  }

  private void writeAudioDataToFile(int bufferSize) {
    byte[] data = new byte[bufferSize];

    try (RandomAccessFile raf = new RandomAccessFile(wavFile, "rw")) {
      raf.seek(44);

      while (isRecording.get() && audioRecord != null) {
        int read = audioRecord.read(data, 0, data.length);

        if (read > 0) {
          raf.write(data, 0, read);
          totalAudioLen += read;
        }
      }
    } catch (Exception e) {
      Log.e(TAG, "Error while writing WAV data", e);
    }
  }

  @PluginMethod
  public synchronized void stopRecording(PluginCall call) {
    if (!isRecording.get() || audioRecord == null || wavFile == null) {
      stopRecordingNotificationService();
      call.reject("No active recording");
      return;
    }

    try {
      forceStopRecording();

      byte[] bytes = readAllBytes(wavFile);
      String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

      JSObject ret = new JSObject();
      ret.put("ok", true);
      ret.put("base64", base64);
      ret.put("mimeType", "audio/wav");
      ret.put("filename", "mood-recording.wav");
      ret.put("fileName", "mood-recording.wav");
      ret.put("size", bytes.length);

      Log.d(TAG, "Native WAV recording finished, bytes=" + bytes.length);
      call.resolve(ret);

    } catch (Exception e) {
      Log.e(TAG, "Failed to stop/read WAV recording", e);
      call.reject("Could not stop native audio recording: " + e.getMessage());
    } finally {
      stopRecordingNotificationService();

      if (wavFile != null && wavFile.exists()) {
        //noinspection ResultOfMethodCallIgnored
        wavFile.delete();
      }

      wavFile = null;
    }
  }

  private synchronized void forceStopRecording() throws IOException {
    if (!isRecording.get()) return;

    isRecording.set(false);

    if (audioRecord != null) {
      try {
        audioRecord.stop();
      } catch (Exception ignored) {
      }
    }

    if (recordingThread != null) {
      try {
        recordingThread.join(1000);
      } catch (InterruptedException ignored) {
      }
      recordingThread = null;
    }

    if (audioRecord != null) {
      try {
        audioRecord.release();
      } catch (Exception ignored) {
      }
      audioRecord = null;
    }

    if (wavFile != null && wavFile.exists()) {
      updateWavHeader(wavFile, totalAudioLen, SAMPLE_RATE, CHANNEL_COUNT, BITS_PER_SAMPLE);
    }
  }

  private synchronized void forceStopRecordingSilently() {
    try {
      forceStopRecording();
    } catch (Exception e) {
      Log.e(TAG, "Silent stop failed", e);
    } finally {
      stopRecordingNotificationService();
    }
  }

  private void cleanupRecording() {
    stopRecordingNotificationService();

    isRecording.set(false);

    if (audioRecord != null) {
      try {
        audioRecord.release();
      } catch (Exception ignored) {
      }
      audioRecord = null;
    }

    if (recordingThread != null) {
      try {
        recordingThread.join(300);
      } catch (Exception ignored) {
      }
      recordingThread = null;
    }

    totalAudioLen = 0;

    if (wavFile != null && wavFile.exists()) {
      //noinspection ResultOfMethodCallIgnored
      wavFile.delete();
    }

    wavFile = null;
  }

  private void writeWavHeader(File file, long audioLen, int sampleRate, int channels, int bitsPerSample)
    throws IOException {
    try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
      long byteRate = sampleRate * channels * bitsPerSample / 8;
      long dataLen = audioLen + 36;

      raf.seek(0);
      raf.writeBytes("RIFF");
      raf.writeInt(Integer.reverseBytes((int) dataLen));
      raf.writeBytes("WAVE");
      raf.writeBytes("fmt ");
      raf.writeInt(Integer.reverseBytes(16));
      raf.writeShort(Short.reverseBytes((short) 1));
      raf.writeShort(Short.reverseBytes((short) channels));
      raf.writeInt(Integer.reverseBytes(sampleRate));
      raf.writeInt(Integer.reverseBytes((int) byteRate));
      raf.writeShort(Short.reverseBytes((short) (channels * bitsPerSample / 8)));
      raf.writeShort(Short.reverseBytes((short) bitsPerSample));
      raf.writeBytes("data");
      raf.writeInt(Integer.reverseBytes((int) audioLen));
    }
  }

  private void updateWavHeader(File file, long audioLen, int sampleRate, int channels, int bitsPerSample)
    throws IOException {
    writeWavHeader(file, audioLen, sampleRate, channels, bitsPerSample);
  }

  private byte[] readAllBytes(File file) throws IOException {
    try (FileInputStream fis = new FileInputStream(file);
         ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[4096];
      int read;

      while ((read = fis.read(buffer)) != -1) {
        bos.write(buffer, 0, read);
      }

      return bos.toByteArray();
    }
  }
}