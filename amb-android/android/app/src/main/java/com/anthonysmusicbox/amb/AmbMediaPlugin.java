package com.anthonysmusicbox.amb;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge between the web player and AmbMediaService: the page reports what is
 * playing, the service shows the media notification / lock-screen controls and
 * reports button presses back as "action" events.
 */
@CapacitorPlugin(name = "AmbMedia")
public class AmbMediaPlugin extends Plugin {
    private static AmbMediaPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void update(PluginCall call) {
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        // Don't put up a notification for a song merely restored in a paused state.
        if (!AmbMediaService.running && !playing) {
            call.resolve();
            return;
        }
        String art = call.getString("artwork");
        if (art != null && art.startsWith("data:")) {
            try {
                byte[] bytes = Base64.decode(art.substring(art.indexOf(',') + 1), Base64.DEFAULT);
                Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bmp != null) AmbMediaService.pendingArt = bmp;
            } catch (Exception ignored) {
                // keep previous artwork
            }
        }
        Intent i = new Intent(getContext(), AmbMediaService.class);
        i.setAction(AmbMediaService.ACTION_UPDATE);
        i.putExtra("title", call.getString("title", ""));
        i.putExtra("artist", call.getString("artist", ""));
        i.putExtra("album", call.getString("album", ""));
        i.putExtra("playing", playing);
        i.putExtra("live", Boolean.TRUE.equals(call.getBoolean("live", false)));
        i.putExtra("duration", call.getDouble("duration", 0.0));
        i.putExtra("position", call.getDouble("position", 0.0));
        try {
            if (AmbMediaService.running) getContext().startService(i);
            else ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            // Android 12+ refuses to start a foreground service from the background.
            call.reject("Could not start playback service", e);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (AmbMediaService.running) {
            Intent i = new Intent(getContext(), AmbMediaService.class);
            i.setAction(AmbMediaService.ACTION_STOP);
            try { getContext().startService(i); } catch (Exception ignored) { }
        }
        call.resolve();
    }

    static void emit(String action, double position) {
        AmbMediaPlugin p = instance;
        if (p == null) return;
        JSObject o = new JSObject();
        o.put("action", action);
        o.put("position", position);
        p.notifyListeners("action", o);
    }
}
