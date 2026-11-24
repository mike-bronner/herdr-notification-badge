#!/bin/sh
set -eu

source_app="${TERMINAL_NOTIFIER_APP:-$(brew --prefix terminal-notifier)/terminal-notifier.app}"
here="$(cd "$(dirname "$0")" && pwd)"

copy_notifier() {
  app="$here/$1.app"
  plist="$app/Contents/Info.plist"
  rm -rf "$app"
  cp -R "$source_app" "$app"
  rm -f "$app/Contents/Resources/Terminal.icns"
  plutil -replace CFBundleIdentifier -string "$2" "$plist"
  plutil -replace CFBundleName -string "$3" "$plist"
  plutil -replace CFBundleIconFile -string "$4" "$plist"
}

sign_notifier() {
  codesign --force --sign - "$app"
  codesign --verify --strict "$app"
  "$app/Contents/MacOS/terminal-notifier" -version
}

build_ivory() {
  copy_notifier HerdrNotifier local.herdr.notifier "Herdr Notifier" Herdr
  cp /Applications/Herdr.app/Contents/Resources/Herdr.icns "$app/Contents/Resources/Herdr.icns"
  sign_notifier
}

build_dark() {
  copy_notifier HerdrNotifierDark local.herdr.notifier.dark "Herdr Notifier Dark" HerdrDark
  resources="$app/Contents/Resources"
  iconset="$resources/HerdrDark.iconset"
  mkdir "$iconset"
  sips -s format png -z 942 942 "$here/herdr-dark.svg" --out "$iconset/full.png" >/dev/null
  sips -p 1024 1024 "$iconset/full.png" --out "$iconset/full.png" >/dev/null
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$iconset/full.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
    sips -z "$((size * 2))" "$((size * 2))" "$iconset/full.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
  done
  rm "$iconset/full.png"
  iconutil -c icns -o "$resources/HerdrDark.icns" "$iconset"
  rm -r "$iconset"
  cp "$here/NOTICE" "$resources/NOTICE"
  sign_notifier
}

case "${1:-all}" in
  ivory) build_ivory ;;
  dark) build_dark ;;
  all) build_ivory; build_dark ;;
  *) echo "usage: $0 [ivory|dark|all]" >&2; exit 2 ;;
esac
