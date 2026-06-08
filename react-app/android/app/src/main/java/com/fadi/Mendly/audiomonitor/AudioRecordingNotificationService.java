package com.fadi.Mendly.audiomonitor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.fadi.Mendly.MainActivity;
import com.fadi.Mendly.R;

public class AudioRecordingNotificationService extends Service {

  private static final String CHANNEL_ID = "mendly_audio_listening";
  private static final int NOTIFICATION_ID = 700001;

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    Notification notification = buildListeningNotification();
    startForeground(NOTIFICATION_ID, notification);

    // Keep service alive while recording is active.
    return START_STICKY;
  }

  private Notification buildListeningNotification() {
    Intent openIntent = new Intent(this, MainActivity.class);

    // This deep link lets React know the user tapped the listening notification.
    openIntent.setAction(Intent.ACTION_VIEW);
    openIntent.setData(Uri.parse("mendly://audio-listening"));

    openIntent.putExtra("mendly_notification_type", "audio-listening");
    openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }

    PendingIntent pendingIntent = PendingIntent.getActivity(
      this,
      700001,
      openIntent,
      flags
    );

    Bitmap largeIcon = BitmapFactory.decodeResource(
      getResources(),
      R.drawable.mendly_logo
    );

    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Mendly is listening")
      .setContentText("Tap to return to Mendly and stop the audio check-in.")
      .setStyle(
        new NotificationCompat.BigTextStyle()
          .bigText("Mendly is listening for your audio mood check-in. Tap to return to the app.")
      )

      // Same logo style as your other notifications:
      // small = app/splash foreground icon, large = Mendly logo picture.
      .setSmallIcon(R.mipmap.ic_launcher_foreground)
      .setLargeIcon(largeIcon)
      .setColor(0xFF6BA7E6)

      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build();
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }

    NotificationManager manager = getSystemService(NotificationManager.class);

    if (manager == null) {
      return;
    }

    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Mendly audio",
      NotificationManager.IMPORTANCE_LOW
    );

    channel.setDescription("Shows when Mendly is listening for audio mood analysis.");
    channel.setShowBadge(false);
    channel.enableVibration(false);
    channel.enableLights(false);

    manager.createNotificationChannel(channel);
  }

  @Override
  public void onDestroy() {
    stopForeground(true);
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}