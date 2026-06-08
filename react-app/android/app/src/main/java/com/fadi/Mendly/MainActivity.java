package com.fadi.Mendly;

import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;

import com.fadi.Mendly.audiomonitor.AudioMonitorPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private static final String TAG = "MendlyMainActivity";

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(AudioMonitorPlugin.class);
    super.onCreate(savedInstanceState);

    WebSettings settings = this.getBridge().getWebView().getSettings();
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    settings.setMediaPlaybackRequiresUserGesture(false);

    android.webkit.WebView.setWebContentsDebuggingEnabled(true);

    this.getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
          try {
            Log.d(TAG, "WebView permission request received");

            String[] requestedResources = request.getResources();
            boolean wantsAudio = false;

            for (String resource : requestedResources) {
              Log.d(TAG, "Requested resource: " + resource);
              if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                wantsAudio = true;
              }
            }

            if (wantsAudio) {
              Log.d(TAG, "Granting audio capture to WebView");
              request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
              Log.d(TAG, "Granting requested WebView resources");
              request.grant(requestedResources);
            }
          } catch (Exception e) {
            Log.e(TAG, "Failed handling WebView permission request", e);
            request.deny();
          }
        });
      }

      @Override
      public void onPermissionRequestCanceled(PermissionRequest request) {
        super.onPermissionRequestCanceled(request);
        Log.d(TAG, "WebView permission request canceled");
      }
    });
  }
}