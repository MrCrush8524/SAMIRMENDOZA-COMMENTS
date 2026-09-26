#!/usr/bin/env bash
# Builds a signed LunaTV APK without Android Studio or the Android SDK manager,
# using Debian/Ubuntu's packaged Android tools:
#
#   sudo apt install aidl aapt zipalign apksigner dalvik-exchange dexdump openjdk-21-jdk-headless
#
# and an android.jar for API 36 (from the Android SDK's platforms/android-36/).
# Debian's aapt can't read the resource table of android.jar 35+, so resources
# can be linked against an API 34 jar instead (ANDROID_RES_JAR). Framework
# resource IDs never change between API levels, and the APK still targets 36.
# The Gradle build (./gradlew assembleRelease) produces the same app; this
# script exists for machines where the SDK can't be installed.
#
# Usage:
#   ANDROID_JAR=/path/to/android-36/android.jar [ANDROID_RES_JAR=/path/to/android-34/android.jar] \
#   LUNATV_KEYSTORE=/path/to/lunatv-release.jks LUNATV_KEYSTORE_PASSWORD=… \
#   tools/build-apk.sh
# Output: build/local/LunaTV-<version>.apk
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ANDROID_JAR:?Set ANDROID_JAR to an API 36 android.jar}"
: "${LUNATV_KEYSTORE:?Set LUNATV_KEYSTORE to your release keystore}"
: "${LUNATV_KEYSTORE_PASSWORD:?Set LUNATV_KEYSTORE_PASSWORD}"
ANDROID_RES_JAR="${ANDROID_RES_JAR:-$ANDROID_JAR}"
ALIAS="${LUNATV_KEY_ALIAS:-lunatv}"
MIN_SDK=23
TARGET_SDK=36

prop() { sed -n "s/^$1=//p" lunatv.properties | tr -d '\r' | sed 's/[[:space:]]*$//'; }
URL=$(prop lunatv.url); APP_ID=$(prop lunatv.applicationId)
VCODE=$(prop lunatv.versionCode); VNAME=$(prop lunatv.versionName)
[[ "$URL" =~ ^https://([^/:]+)(/.*/)$ ]] || { echo "lunatv.url must be https://host/…/ ending in /" >&2; exit 1; }
HOST="${BASH_REMATCH[1]}"; PATH_PREFIX="${BASH_REMATCH[2]}"

OUT=build/local
rm -rf "$OUT"; mkdir -p "$OUT"/{gen,classes,aidl-framework/android/os,aidl-framework/android/net,aidl-framework/android/content}
echo "LunaTV $VNAME ($VCODE) → $URL"

# 1. Manifest: fill the placeholders Gradle would, add the package name.
sed -e "s|\${lunatvUrl}|$URL|g" -e "s|\${lunatvHost}|$HOST|g" -e "s|\${lunatvPathPrefix}|$PATH_PREFIX|g" \
    -e "0,/<manifest /s|<manifest |<manifest package=\"com.smrentertainment.lunatv\" |" \
    app/src/main/AndroidManifest.xml > "$OUT/AndroidManifest.xml"

# 2. AIDL → Java (framework parcelables declared for the standalone compiler).
echo 'package android.os; parcelable Bundle;' > "$OUT/aidl-framework/android/os/Bundle.aidl"
echo 'package android.net; parcelable Uri;' > "$OUT/aidl-framework/android/net/Uri.aidl"
echo 'package android.content; parcelable ComponentName;' > "$OUT/aidl-framework/android/content/ComponentName.aidl"
for f in app/src/main/aidl/android/support/customtabs/*.aidl; do
  aidl -I"$OUT/aidl-framework" -Iapp/src/main/aidl -o"$OUT/gen" "$f"
done

# 3. Resources → R.java and the resource table.
aapt package -f -m --auto-add-overlay \
  --min-sdk-version $MIN_SDK --target-sdk-version $TARGET_SDK \
  --version-code "$VCODE" --version-name "$VNAME" --rename-manifest-package "$APP_ID" \
  -J "$OUT/gen" -M "$OUT/AndroidManifest.xml" -S app/src/main/res -I "$ANDROID_RES_JAR" \
  -F "$OUT/unaligned.apk"

# 4. Java → bytecode → DEX.
find app/src/main/java "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" \
  -d "$OUT/classes" @"$OUT/sources.txt"
dalvik-exchange --dex --min-sdk-version=$MIN_SDK --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && aapt add -f unaligned.apk classes.dex >/dev/null)

# 5. Align and sign (APK Signature Scheme v2 + v3).
zipalign -f -p 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"
APK="$OUT/LunaTV-$VNAME.apk"
apksigner sign --ks "$LUNATV_KEYSTORE" --ks-key-alias "$ALIAS" \
  --ks-pass env:LUNATV_KEYSTORE_PASSWORD --key-pass env:LUNATV_KEYSTORE_PASSWORD \
  --min-sdk-version $MIN_SDK --v4-signing-enabled false --out "$APK" "$OUT/aligned.apk"
apksigner verify --min-sdk-version $MIN_SDK "$APK"
echo "Built $APK"
