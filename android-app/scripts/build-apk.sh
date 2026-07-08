#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FRONTEND_PUBLIC="${FRONTEND_PUBLIC:-$ROOT/../frontend/public}"
APK_NAME="${APK_NAME:-imba-bet.apk}"
KEYSTORE_DIR="$ROOT/keystore"
KEYSTORE_FILE="$KEYSTORE_DIR/imba-release.jks"
KEYSTORE_PROPS="$ROOT/keystore.properties"
GRADLE_IMAGE="${GRADLE_IMAGE:-mingc/android-build-box:latest}"

echo "==> Imba.bet Android APK build"
echo "    Project: $ROOT"

python3 "$ROOT/scripts/generate-icons.py"
python3 "$ROOT/scripts/generate-pwa-icons.py"

mkdir -p "$KEYSTORE_DIR"

if [[ ! -f "$KEYSTORE_FILE" ]]; then
  echo "==> Creating release keystore (first run)"
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

cat > "$KEYSTORE_PROPS" <<EOF
storeFile=keystore/imba-release.jks
storePassword=imbabet2026
keyAlias=imba-release
keyPassword=imbabet2026
EOF

if [[ ! -f "$ROOT/gradlew" ]]; then
  echo "==> Bootstrapping Gradle wrapper"
  docker run --rm \
    -v "$ROOT:/project" \
    -w /project \
    "$GRADLE_IMAGE" \
    bash -lc "gradle wrapper --gradle-version 8.7"
fi

echo "==> Building release APK (Docker)"
docker run --rm \
  -v "$ROOT:/project" \
  -w /project \
  "$GRADLE_IMAGE" \
  bash -lc "
    set -e
    export ANDROID_SDK_ROOT=/opt/android-sdk
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
    yes | sdkmanager --licenses >/dev/null 2>&1 || true
    chmod +x ./gradlew
    ./gradlew --no-daemon assembleRelease
  "

APK_SRC="$ROOT/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK_SRC" ]]; then
  echo "ERROR: APK not found at $APK_SRC" >&2
  exit 1
fi

cp "$APK_SRC" "$FRONTEND_PUBLIC/$APK_NAME"
ls -lh "$FRONTEND_PUBLIC/$APK_NAME"
echo "==> APK ready: $FRONTEND_PUBLIC/$APK_NAME"
