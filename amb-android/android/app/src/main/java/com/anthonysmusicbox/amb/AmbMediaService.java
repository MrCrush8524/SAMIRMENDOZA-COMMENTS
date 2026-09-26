package com.anthonysmusicbox.amb;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Foreground media service: keeps AMB alive with the screen off and publishes a
 * MediaSession so the notification, lock screen, Bluetooth and headset buttons
 * control the web player.
 */
public class AmbMediaService extends Service {
    static final String ACTION_UPDATE = "com.anthonysmusicbox.amb.UPDATE";
    static final String ACTION_STOP = "com.anthonysmusicbox.amb.STOP";
    static final String ACTION_CMD = "com.anthonysmusicbox.amb.CMD";
    private static final String CHANNEL = "amb_playback";
    private static final int NOTIFICATION_ID = 7;

    static volatile boolean running = false;
    static volatile Bitmap pendingArt = null;

    private MediaSessionCompat session;
    private PowerManager.WakeLock wakeLock;
    private String title = "", artist = "", album = "";
    private boolean playing = false, live = false;
    private long durationMs = 0, positionMs = 0;
    private Bitmap art;

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Now Playing", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Playback controls for Anthony's Music Box");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
        session = new MediaSessionCompat(this, "AMB");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { AmbMediaPlugin.emit("play", 0); }
            @Override public void onPause() { AmbMediaPlugin.emit("pause", 0); }
            @Override public void onStop() { AmbMediaPlugin.emit("pause", 0); }
            @Override public void onSkipToNext() { AmbMediaPlugin.emit("next", 0); }
            @Override public void onSkipToPrevious() { AmbMediaPlugin.emit("previous", 0); }
            @Override public void onSeekTo(long pos) { AmbMediaPlugin.emit("seek", pos / 1000.0); }
        });
        session.setSessionActivity(openAppIntent());
        session.setActive(true);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AMB:playback");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            shutdown();
            return START_NOT_STICKY;
        }
        if (ACTION_CMD.equals(action)) {
            String cmd = intent.getStringExtra("cmd");
            if (cmd != null) AmbMediaPlugin.emit(cmd, 0);
            // Must still be in the foreground after any start request.
            publish();
            return START_NOT_STICKY;
        }
        if (intent != null && ACTION_UPDATE.equals(action)) {
            title = nz(intent.getStringExtra("title"));
            artist = nz(intent.getStringExtra("artist"));
            album = nz(intent.getStringExtra("album"));
            playing = intent.getBooleanExtra("playing", false);
            live = intent.getBooleanExtra("live", false);
            durationMs = (long) (intent.getDoubleExtra("duration", 0) * 1000);
            positionMs = (long) (intent.getDoubleExtra("position", 0) * 1000);
            if (pendingArt != null) { art = pendingArt; pendingArt = null; }
        }
        publish();
        return START_NOT_STICKY;
    }

    private void publish() {
        MediaMetadataCompat.Builder md = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album);
        if (!live && durationMs > 0) md.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (art != null) md.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
        session.setMetadata(md.build());

        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_STOP;
        if (!live) actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_SEEK_TO;
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                live ? PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN : positionMs, playing ? 1f : 0f)
            .build());

        NotificationCompat.Builder nb = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_amb)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(live ? "Live Radio" : album)
            .setLargeIcon(art)
            .setContentIntent(openAppIntent())
            .setDeleteIntent(cmdIntent("pause", 9))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setOngoing(playing)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        int compact0, compact1, compact2;
        if (live) {
            nb.addAction(playing ? R.drawable.ic_amb_pause : R.drawable.ic_amb_play, playing ? "Pause" : "Play", cmdIntent(playing ? "pause" : "play", 2));
            nb.setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0));
        } else {
            nb.addAction(R.drawable.ic_amb_prev, "Previous", cmdIntent("previous", 1));
            nb.addAction(playing ? R.drawable.ic_amb_pause : R.drawable.ic_amb_play, playing ? "Pause" : "Play", cmdIntent(playing ? "pause" : "play", 2));
            nb.addAction(R.drawable.ic_amb_next, "Next", cmdIntent("next", 3));
            nb.setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
        }
        Notification n = nb.build();
        int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type);

        if (playing) { if (!wakeLock.isHeld()) wakeLock.acquire(6 * 60 * 60 * 1000L); }
        else if (wakeLock.isHeld()) wakeLock.release();
    }

    private PendingIntent openAppIntent() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private PendingIntent cmdIntent(String cmd, int code) {
        Intent i = new Intent(this, AmbMediaService.class);
        i.setAction(ACTION_CMD);
        i.putExtra("cmd", cmd);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static String nz(String s) { return s == null ? "" : s; }

    private void shutdown() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Swiping AMB away from Recents ends playback, like closing the app.
        shutdown();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (session != null) { session.setActive(false); session.release(); }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
