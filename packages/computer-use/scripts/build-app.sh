#!/bin/bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  print "Skipping computer-use: the app is only built on macOS"
  exit 0
fi

package_directory="${0:A:h:h}"
build_directory="${COMPUTER_CONTROL_BUILD_DIRECTORY:-$package_directory/.build}"
app_name="${COMPUTER_CONTROL_APP_NAME:-Computer Use}"
bundle_identifier="${COMPUTER_CONTROL_BUNDLE_IDENTIFIER:-com.blankparticle.computer-use}"
signing_identity="${COMPUTER_CONTROL_SIGNING_IDENTITY:-BlankParticle}"
deployment_target="${MACOSX_DEPLOYMENT_TARGET:-14.0}"
app="$build_directory/$app_name.app"
contents="$app/Contents"
executable="$contents/MacOS/computer-use"

if [[ "$bundle_identifier" != *.computer-use ]]; then
  print -u2 "Bundle identifier must end in .computer-use (received $bundle_identifier)"
  exit 1
fi

if ! security find-identity -v -p codesigning | grep -Fq \"$signing_identity\"; then
  print -u2 "No valid code-signing identity matches: $signing_identity"
  print -u2 "Set COMPUTER_CONTROL_SIGNING_IDENTITY to a persistent identity from:"
  print -u2 "  security find-identity -v -p codesigning"
  exit 1
fi

mkdir -p "$contents/MacOS" "$contents/Resources"

swift build \
  --package-path "$package_directory" \
  --scratch-path "$build_directory/swiftpm" \
  --configuration release \
  --product computer-use \
  -Xswiftc -target \
  -Xswiftc "arm64-apple-macosx$deployment_target"
swiftpm_binary_directory="$(swift build \
  --package-path "$package_directory" \
  --scratch-path "$build_directory/swiftpm" \
  --configuration release \
  --show-bin-path)"
cp "$swiftpm_binary_directory/computer-use" "$executable"

cp "$package_directory/menubar-cursor.png" "$contents/Resources/"
cp "$package_directory/overlay-cursor.svg" "$contents/Resources/"

sed \
  -e "s|\$(APP_NAME)|$app_name|g" \
  -e "s|\$(BUNDLE_IDENTIFIER)|$bundle_identifier|g" \
  -e "s|\$(MACOS_DEPLOYMENT_TARGET)|$deployment_target|g" \
  "$package_directory/Info.plist" > "$contents/Info.plist"

codesign \
  --force \
  --sign "$signing_identity" \
  --identifier "$bundle_identifier" \
  --options runtime \
  --timestamp=none \
  "$app"

test -x "$executable"
test -f "$contents/Resources/menubar-cursor.png"
test -f "$contents/Resources/overlay-cursor.svg"
plutil -lint "$contents/Info.plist"
codesign --verify --strict --verbose=2 "$app"

identifier="$(codesign -d --verbose=4 "$app" 2>&1 | sed -n 's/^Identifier=//p')"
if [[ "$identifier" != "$bundle_identifier" ]]; then
  print -u2 "Expected identifier $bundle_identifier, received $identifier"
  exit 1
fi

print "identifier: $identifier"
print "designated requirement:"
codesign -d -r- "$app" 2>&1 | sed -n 's/^designated => /  /p'
print "$app"
