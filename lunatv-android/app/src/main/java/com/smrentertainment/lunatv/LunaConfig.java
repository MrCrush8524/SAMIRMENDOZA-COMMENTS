package com.smrentertainment.lunatv;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;

/** Where LunaTV lives on the web. Set once in lunatv.properties; the build writes it into the manifest. */
final class LunaConfig {
    private LunaConfig() { }

    static Uri baseUrl(Context context) {
        try {
            Bundle meta = context.getPackageManager()
                    .getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA).metaData;
            String url = meta != null ? meta.getString("lunatv.URL") : null;
            if (url != null && url.startsWith("https://")) return Uri.parse(url);
        } catch (PackageManager.NameNotFoundException ignored) { }
        throw new IllegalStateException("lunatv.URL is missing from the manifest");
    }

    /** True for addresses inside LunaTV (same origin, under its folder). */
    static boolean isLunaUrl(Context context, Uri uri) {
        Uri base = baseUrl(context);
        if (uri == null || !"https".equals(uri.getScheme()) || base.getHost() == null) return false;
        if (!base.getHost().equalsIgnoreCase(uri.getHost()) || base.getPort() != uri.getPort()) return false;
        String basePath = base.getPath() == null ? "/" : base.getPath();
        String path = uri.getPath() == null || uri.getPath().isEmpty() ? "/" : uri.getPath();
        String folder = basePath.endsWith("/") ? basePath : basePath + "/";
        return path.equals(basePath) || path.startsWith(folder);
    }

    /** A LunaTV link that opened the app (e.g. …/lunatv/#/live), or LunaTV's home. */
    static Uri launchUrl(Context context, Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        if (data != null && isLunaUrl(context, data)) return data;
        return baseUrl(context).buildUpon().fragment("/home").build();
    }
}
