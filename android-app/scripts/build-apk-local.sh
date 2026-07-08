#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FRONTEND_PUBLIC="${FRONTEND_PUBLIC:-$ROOT/../frontend/public}"
APK_NAME="${APK_NAME:-imba-bet.apk}"
ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
GRADLE_VERSION="${GRADLE_VERSION:-8.7}"
CMDLINE_TOOLS_ZIP="${CMDLINE_TOOLS_ZIP:-commandlinetools-linux-11076708_latest.zip}"

echo "==> Local Android APK build"
echo "    ANDROID_HOME=$ANDROID_HOME"

export ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

python3 "$ROOT/scripts/generate-icons.py"
python3 "$ROOT/scripts/generate-pwa-icons.py"

mkdir -p "$ROOT/keystore"
KEYSTORE_FILE="$ROOT/keystore/imba-release.jks"
if [[ ! -f "$KEYSTORE_FILE" ]]; then
  keytool -genkeypair \
    -alias imba-release \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -keystore "$KEYSTORE_FILE" \
    -storepass imbabet2026 \
    -keypass imbabet2026 \
    -dname "CN=Imba.bet, OU=Mobile, O=Imba.bet, L=Almaty, ST=Almaty, C=KZ"
fi

cat > "$ROOT/keystore.properties" <<EOF
storeFile=../keystore/imba-release.jks
storePassword=imbabet2026
keyAlias=imba-release
keyPassword=imbabet2026
EOF

if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "==> Installing Android command-line tools"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  TMP_ZIP="/tmp/$CMDLINE_TOOLS_ZIP"
  if [[ ! -f "$TMP_ZIP" ]]; then
    curl -fsSL "https://dl.google.com/android/repository/$CMDLINE_TOOLS_ZIP" -o "$TMP_ZIP"
  fi
  rm -rf /tmp/cmdline-tools-unpack
  unzip -q "$TMP_ZIP" -d /tmp/cmdline-tools-unpack
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv /tmp/cmdline-tools-unpack/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
fi

echo "==> Installing Android SDK packages"
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

if [[ ! -x "$ROOT/gradlew" ]]; then
  echo "==> Bootstrapping Gradle wrapper"
  GRADLE_DIR="/opt/gradle-$GRADLE_VERSION"
  if [[ ! -x "$GRADLE_DIR/bin/gradle" ]]; then
    curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o "/tmp/gradle-${GRADLE_VERSION}.zip"
    rm -rf "$GRADLE_DIR"
    unzip -q "/tmp/gradle-${GRADLE_VERSION}.zip" -d /opt
  fi
  "$GRADLE_DIR/bin/gradle" wrapper --gradle-version "$GRADLE_VERSION"
fi

echo "==> assembleRelease"
chmod +x "$ROOT/gradlew"
./gradlew --no-daemon assembleRelease

APK_SRC="$ROOT/app/build/outputs/apk/release/app-release.apk"
cp "$APK_SRC" "$FRONTEND_PUBLIC/$APK_NAME"
ls -lh "$FRONTEND_PUBLIC/$APK_NAME"
echo "==> APK ready: $FRONTEND_PUBLIC/$APK_NAME"
