#!/bin/bash

set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  print "Skipping computer-use installation: the app is only available on macOS"
  exit 0
fi

package_directory="${0:A:h:h}"
app_name="${COMPUTER_CONTROL_APP_NAME:-Computer Use}"
build_directory="${COMPUTER_CONTROL_BUILD_DIRECTORY:-$package_directory/.build}"
install_directory="${COMPUTER_CONTROL_INSTALL_DIRECTORY:-/Applications}"
source_app="$build_directory/$app_name.app"
installed_app="$install_directory/$app_name.app"

"$package_directory/scripts/build-app.sh"
mkdir -p "$install_directory"
ditto "$source_app" "$installed_app"
codesign --verify --strict --verbose=2 "$installed_app"

print "Installed $installed_app"
print "MCP executable: $installed_app/Contents/MacOS/computer-use"
