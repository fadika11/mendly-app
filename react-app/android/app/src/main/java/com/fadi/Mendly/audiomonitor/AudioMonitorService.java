package com.fadi.Mendly.audiomonitor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.fadi.Mendly.MainActivity;

import java.util.concurrent.atomic.AtomicBoolean;

public class AudioMonitorService extends Service {

  private static final String CHANNEL_ID = "mendly_audio_monitor";
  private static final int NOTIF_ID = 9001;

  public static final String ACTION_STOP = "com.fadi.Mendly.audiomonitor.STOP";

  private static final AtomicBoolean RUNNING_FLAG = new AtomicBoolean(false);

  public static boolean isRunningStatic() {
    return RUNNING_FLAG.get();
  }

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopSelf();
      return START_NOT_STICKY;
    }

    RUNNING_FLAG.set(true);
    startForeground(
      NOTIF_ID,
      buildNotification("Mendly is listening in the background. Tap to return to the app.")
    );

    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    RUNNING_FLAG.set(false);
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private Notification buildNotification(String text) {
    Intent openIntent = new Intent(this, MainActivity.class);
    openIntent.setAction(Intent.ACTION_MAIN);
    openIntent.addCategory(Intent.CATEGORY_LAUNCHER);
    openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }

    PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, flags);

    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Mendly is listening")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setOngoing(true)
      .setContentIntent(pi)
      .setAutoCancel(false)
      .build();
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "Mendly Audio Monitor",
        NotificationManager.IMPORTANCE_LOW
      );
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) {
        nm.createNotificationChannel(channel);
      }
    }
  }
}