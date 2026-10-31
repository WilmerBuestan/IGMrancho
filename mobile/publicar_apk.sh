#!/bin/sh
# Compila el APK y lo publica en https://rancho.simtrg.date/descargas/IGM-Rancho.apk
# Antes de publicar una versión nueva, sube "version:" en pubspec.yaml (ej. 1.0.1+2).
set -e
cd "$(dirname "$0")"
flutter build apk --release
APK=build/app/outputs/flutter-apk/app-release.apk
VERSION=$(grep '^version:' pubspec.yaml | sed 's/version: *//; s/+.*//')
SIZE=$(du -m "$APK" | cut -f1)
printf '{"version":"%s","sizeMb":%s,"date":"%s"}\n' "$VERSION" "$SIZE" "$(date +%F)" > /tmp/igm-app.json
SERVER=${SERVER:-192.168.100.134}
ssh "$SERVER" 'mkdir -p ~/igm-rancho/descargas'
scp -q "$APK" "$SERVER:igm-rancho/descargas/IGM-Rancho.apk"
scp -q /tmp/igm-app.json "$SERVER:igm-rancho/descargas/app.json"
cp "$APK" ../IGM-Rancho.apk
echo "✓ Publicada la versión $VERSION ($SIZE MB)"
