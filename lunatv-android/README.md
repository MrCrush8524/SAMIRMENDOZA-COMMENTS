# LunaTV for Android

This is the Android app for LunaTV. It's a thin wrapper around the LunaTV web app: it opens your hosted copy full screen, with its own icon on the home screen and in the app drawer.

It's a **Trusted Web Activity**, the same technology Google recommends for putting a web app on Google Play. LunaTV runs inside the phone's Chrome engine, so everything works just as it does on the web:

- Google sign-in for YouTube
- Chromecast
- reminders and Web Push
- the offline app shell
- Chrome's video codecs

The app itself holds no videos, keys or history. Those stay in the browser's storage for your LunaTV address.

**Before you start:** the app opens the address in `lunatv.properties` (`lunatv.url`). Put the web app online first; `../lunatv/README.md`, step 1, shows how. The address is currently set to:

```
https://mrcrush8524.github.io/lunatv/
```

If you host LunaTV somewhere else, change that line and rebuild.

---

## 1. Install the ready-made APK

1. Copy `LunaTV-1.2.0.apk` to the phone, or download it on the phone.
2. Open it. Android asks once to allow installs from that app (Files, Chrome…); allow it.
3. Tap **Install**, then open **LunaTV**.

Android 6.0 or later is needed. For the full-screen experience the phone should have **Chrome** (or another browser that supports Trusted Web Activities, such as Samsung Internet or Edge).

## 2. Remove the address bar (Digital Asset Links)

Until the website says it trusts this app, Chrome shows LunaTV with a slim address bar at the top. To remove it, publish `well-known/assetlinks.json` at the **root of the domain**:

```
https://mrcrush8524.github.io/.well-known/assetlinks.json
```

On GitHub Pages, the root of `yourname.github.io` is a separate repository that must be named exactly `yourname.github.io`:

1. Create a repository called `mrcrush8524.github.io` (skip this if you already have one).
2. Add a file named `.nojekyll` (empty) at its top level. Without it, GitHub Pages hides folders that start with a dot.
3. Add `.well-known/assetlinks.json`, with the contents of `well-known/assetlinks.json` from this folder.
4. In that repository's **Settings › Pages**, deploy from the **main** branch, **/ (root)**.
5. Check that the address above shows the JSON in a browser. Then close LunaTV on the phone (swipe it away in recent apps) and open it again.

If LunaTV has its own domain (e.g. `lunatv.example.com`), the file goes at `https://lunatv.example.com/.well-known/assetlinks.json` instead.

The fingerprint in that file belongs to the LunaTV release key. **If you publish through Google Play with Play App Signing**, Google re-signs the app with its own key. Copy the extra SHA-256 fingerprint from Play Console › **Test and release › App integrity**, and add it to the `sha256_cert_fingerprints` list.

## 3. What happens on phones without Chrome

- **A browser with Custom Tabs but not Trusted Web Activities** (e.g. Firefox): LunaTV opens in that browser's Custom Tab, with an address bar.
- **No such browser at all:** LunaTV opens in the app's own built-in viewer (Android System WebView). Videos, Live TV, the library, playlists and Discover all work there. These don't:
  - Google sign-in (Google blocks it inside embedded viewers)
  - Chromecast
  - saving backup files

  Pasted YouTube links still play.

## 4. Build it yourself

### With Android Studio or on the command line

1. Open this folder (`lunatv-android`) in Android Studio. It needs the Android 16 (API 36) SDK platform; Studio offers to install it.
2. **Build › Build Bundle(s) / APK(s)**, or run `./gradlew assembleDebug` from a terminal.

To produce a release signed with your key:

```
export LUNATV_KEYSTORE=/safe/place/lunatv-release.jks
export LUNATV_KEYSTORE_PASSWORD='…'
./gradlew assembleRelease bundleRelease
```

- The APK is in `app/build/outputs/apk/release/`.
- The Play Store bundle (`.aab`) is in `app/build/outputs/bundle/release/`.

### On GitHub (no computer setup)

The workflow `.github/workflows/build-lunatv-android.yml` builds the app whenever this folder changes on `main` or this branch. You can also start it by hand from the **Actions** tab. Download the results from the run's **Artifacts** section: `lunatv-android` holds the APKs and the `.aab`.

To have GitHub sign the release with your key, add two repository secrets (**Settings › Secrets and variables › Actions**):

| Secret | Value |
|---|---|
| `LUNATV_KEYSTORE_BASE64` | the keystore file as base64: `base64 -w0 lunatv-release.jks` |
| `LUNATV_KEYSTORE_PASSWORD` | the keystore password |

Without them, the release build is unsigned. The debug APK from the same run still installs.

### Without the Android SDK

`tools/build-apk.sh` builds the same signed APK with Ubuntu's packaged tools (`aidl`, `aapt`, `dalvik-exchange`, `zipalign`, `apksigner`). The instructions are at the top of the script. The ready-made APK was built this way.

## 5. Settings (`lunatv.properties`)

| Setting | Meaning |
|---|---|
| `lunatv.url` | The hosted LunaTV address. HTTPS, ending in `/`. |
| `lunatv.applicationId` | The app's permanent identity. Never change it after publishing. |
| `lunatv.versionCode` | Raise by 1 for every build you publish (Google Play requires it). |
| `lunatv.versionName` | The version people see, e.g. `1.2.0`. |

Links to your LunaTV address (e.g. `…/lunatv/#/live`) open straight in the app once step 2 is done.

The launcher icons and splash images are generated from the web app's artwork by `tools/make-icons.py`. Run it again if the artwork changes.

## 6. Keep the signing key safe

The release key (`lunatv-release.jks`) and its password were delivered separately. They are **not** in this repository and must never be committed.

- Every update of the app must be signed with the same key; if the key is lost, Android won't install updates over the existing app.
- Keep two copies somewhere safe, such as a password manager and an offline drive.
- If you use Google Play, enrolling in **Play App Signing** lets Google keep the key used for store installs. Keep your own copy anyway: it's the one `assetlinks.json` lists for the APK you install directly.

## 7. Publishing on Google Play (optional)

1. Create the app in Play Console. The package name is `com.smrentertainment.lunatv`.
2. Upload the `.aab` from a signed release build.
3. Complete the store listing, content rating and data-safety form:
   - LunaTV collects no data itself.
   - The optional adult section is off by default, but Google Play's policies on sexual content apply to anything the app can show.
4. After Play App Signing is set up, add Play's fingerprint to `assetlinks.json` (see step 2).

---

## How it works

`LauncherActivity` picks a browser the same way Google's android-browser-helper does:

1. It prefers the default browser if that browser supports Trusted Web Activities.
2. It connects to the browser's Custom Tabs service, opens a session and launches LunaTV as a Trusted Web Activity.
3. The browser checks `assetlinks.json` to decide whether to hide the address bar.

The Custom Tabs interfaces are compiled from `src/main/aidl` (AIDL files from AndroidX Browser, Apache License 2.0), so the app has no library dependencies. `WebViewActivity` is the fallback viewer.

LunaTV™ is a product of Bobby, Luna & Mateo Interactive, the interactive technology division of SMR Entertainment.
