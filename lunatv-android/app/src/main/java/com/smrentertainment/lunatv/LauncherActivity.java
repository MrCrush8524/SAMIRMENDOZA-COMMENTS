package com.smrentertainment.lunatv;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.customtabs.ICustomTabsCallback;
import android.support.customtabs.ICustomTabsService;

import java.util.ArrayList;
import java.util.List;

/**
 * Opens LunaTV full-screen in the phone's browser engine as a Trusted Web
 * Activity (TWA). This is the same protocol Google's android-browser-helper
 * uses, spoken directly over the Custom Tabs AIDL interfaces in src/main/aidl,
 * so the app has no library dependencies.
 *
 * Running inside Chrome (or another TWA browser) keeps everything LunaTV does
 * on the web: Google sign-in for YouTube, Chromecast, Web Push, the service
 * worker and the browser's video codecs.
 *
 * Order of preference:
 *   1. TWA: full screen, no address bar once the site's Digital Asset Links
 *      file lists this app (see README).
 *   2. Custom Tab: the browser opens LunaTV with a slim address bar.
 *   3. WebViewActivity: for phones with no Custom Tabs browser at all.
 */
public class LauncherActivity extends Activity {
    static final String ACTION_CUSTOM_TABS_CONNECTION = "android.support.customtabs.action.CustomTabsService";
    static final String CATEGORY_TWA = "androidx.browser.trusted.category.TrustedWebActivities";
    static final String EXTRA_SESSION = "android.support.customtabs.extra.SESSION";
    static final String EXTRA_LAUNCH_AS_TWA = "android.support.customtabs.extra.LAUNCH_AS_TRUSTED_WEB_ACTIVITY";
    static final String EXTRA_TOOLBAR_COLOR = "android.support.customtabs.extra.TOOLBAR_COLOR";
    static final String EXTRA_NAVIGATION_BAR_COLOR = "androidx.browser.customtabs.extra.NAVIGATION_BAR_COLOR";
    static final String EXTRA_COLOR_SCHEME = "androidx.browser.customtabs.extra.COLOR_SCHEME";
    static final String EXTRA_DISPLAY_MODE = "androidx.browser.trusted.extra.DISPLAY_MODE";
    static final String KEY_DISPLAY_MODE_ID = "androidx.browser.trusted.displaymode.KEY_ID";
    static final String EXTRA_SCREEN_ORIENTATION = "androidx.browser.trusted.extra.SCREEN_ORIENTATION";
    static final int COLOR_SCHEME_DARK = 2;
    static final int DISPLAY_MODE_STANDALONE = 0;
    static final int ORIENTATION_DEFAULT = 0;
    static final int BAR_COLOR = 0xFF050608;
    static final long CONNECT_TIMEOUT_MS = 4000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ICustomTabsCallback.Stub callback = new SessionCallback();
    private ServiceConnection connection;
    private boolean launched;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Recreated after Android reclaimed the process while LunaTV was open in the
        // browser, and the user has now left LunaTV: nothing more to show.
        if (savedInstanceState != null && savedInstanceState.getBoolean("launched")) {
            launched = true;
            finish();
            return;
        }
        final Uri url = LunaConfig.launchUrl(this, getIntent());
        final Provider provider = pickProvider();
        if (provider == null) {
            openWebView(url);
        } else if (!provider.twa) {
            openCustomTab(provider.pkg, url);
        } else {
            connectAndLaunch(provider.pkg, url);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putBoolean("launched", launched);
    }

    /** The user closed LunaTV (back from the browser activity): leave with it. */
    @Override
    protected void onRestart() {
        super.onRestart();
        if (launched) finish();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (connection != null) {
            try { unbindService(connection); } catch (IllegalArgumentException ignored) { }
            connection = null;
        }
        super.onDestroy();
    }

    // ---- choosing a browser (mirrors android-browser-helper's TwaProviderPicker)

    static final class Provider {
        final String pkg; final boolean twa;
        Provider(String pkg, boolean twa) { this.pkg = pkg; this.twa = twa; }
    }

    private Provider pickProvider() {
        PackageManager pm = getPackageManager();
        Intent browsers = new Intent(Intent.ACTION_VIEW, Uri.fromParts("http", "", null))
                .addCategory(Intent.CATEGORY_BROWSABLE);
        // The default browser comes first, so the user's choice wins when it supports TWAs.
        List<ResolveInfo> candidates = new ArrayList<ResolveInfo>(pm.queryIntentActivities(browsers, PackageManager.MATCH_DEFAULT_ONLY));
        if (Build.VERSION.SDK_INT >= 23) candidates.addAll(pm.queryIntentActivities(browsers, PackageManager.MATCH_ALL));

        List<ResolveInfo> services = pm.queryIntentServices(new Intent(ACTION_CUSTOM_TABS_CONNECTION), PackageManager.GET_RESOLVED_FILTER);
        String firstCustomTabs = null;
        for (ResolveInfo candidate : candidates) {
            String pkg = candidate.activityInfo.packageName;
            for (ResolveInfo s : services) {
                if (!pkg.equals(s.serviceInfo.packageName)) continue;
                if (s.filter != null && s.filter.hasCategory(CATEGORY_TWA)) return new Provider(pkg, true);
                if (firstCustomTabs == null) firstCustomTabs = pkg;
            }
        }
        return firstCustomTabs != null ? new Provider(firstCustomTabs, false) : null;
    }

    // ---- TWA: bind the browser's Custom Tabs service, open a session, launch

    private void connectAndLaunch(final String pkg, final Uri url) {
        final Runnable fallback = new Runnable() {
            @Override public void run() { if (!launched) openCustomTab(pkg, url); }
        };
        connection = new ServiceConnection() {
            @Override
            public void onServiceConnected(ComponentName name, IBinder binder) {
                if (launched) return;
                handler.removeCallbacks(fallback);
                boolean session = false;
                try {
                    ICustomTabsService service = ICustomTabsService.Stub.asInterface(binder);
                    service.warmup(0);
                    session = service.newSession(callback);
                } catch (Exception e) {
                    session = false;
                }
                if (session) openTwa(pkg, url); else fallback.run();
            }
            @Override public void onServiceDisconnected(ComponentName name) { }
        };
        Intent bind = new Intent(ACTION_CUSTOM_TABS_CONNECTION).setPackage(pkg);
        boolean bound;
        try { bound = bindService(bind, connection, BIND_AUTO_CREATE); } catch (SecurityException e) { bound = false; }
        if (!bound) { connection = null; fallback.run(); return; }
        handler.postDelayed(fallback, CONNECT_TIMEOUT_MS);
    }

    private void openTwa(String pkg, Uri url) {
        Intent intent = browserIntent(pkg, url, callback.asBinder());
        intent.putExtra(EXTRA_LAUNCH_AS_TWA, true);
        Bundle displayMode = new Bundle();
        displayMode.putInt(KEY_DISPLAY_MODE_ID, DISPLAY_MODE_STANDALONE);
        intent.putExtra(EXTRA_DISPLAY_MODE, displayMode);
        intent.putExtra(EXTRA_SCREEN_ORIENTATION, ORIENTATION_DEFAULT);
        start(intent, url);
    }

    private void openCustomTab(String pkg, Uri url) {
        start(browserIntent(pkg, url, null), url);
    }

    private Intent browserIntent(String pkg, Uri url, IBinder session) {
        Intent intent = new Intent(Intent.ACTION_VIEW, url).setPackage(pkg);
        Bundle extras = new Bundle();
        extras.putBinder(EXTRA_SESSION, session); // the key must be present, even when null, for a Custom Tab
        intent.putExtras(extras);
        intent.putExtra(EXTRA_TOOLBAR_COLOR, BAR_COLOR);
        intent.putExtra(EXTRA_NAVIGATION_BAR_COLOR, BAR_COLOR);
        intent.putExtra(EXTRA_COLOR_SCHEME, COLOR_SCHEME_DARK);
        return intent;
    }

    private void start(Intent intent, Uri url) {
        if (launched) return;
        launched = true;
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            launched = false;
            openWebView(url);
        }
    }

    private void openWebView(Uri url) {
        launched = true;
        startActivity(new Intent(this, WebViewActivity.class).setData(url));
        finish();
    }

    /** The session only needs to exist; LunaTV doesn't listen to browser events. */
    static final class SessionCallback extends ICustomTabsCallback.Stub {
        @Override public void onNavigationEvent(int navigationEvent, Bundle extras) { }
        @Override public void extraCallback(String callbackName, Bundle args) { }
        @Override public void onMessageChannelReady(Bundle extras) { }
        @Override public void onPostMessage(String message, Bundle extras) { }
        @Override public void onRelationshipValidationResult(int relation, Uri origin, boolean result, Bundle extras) { }
        @Override public Bundle extraCallbackWithResult(String callbackName, Bundle args) { return null; }
        @Override public void onActivityResized(int height, int width, Bundle extras) { }
        @Override public void onWarmupCompleted(Bundle extras) { }
        @Override public void onActivityLayout(int left, int top, int right, int bottom, int state, Bundle extras) { }
        @Override public void onMinimized(Bundle extras) { }
        @Override public void onUnminimized(Bundle extras) { }
    }
}
