#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PKG_NAME="gl-fanctrl"
PKG_VERSION="0.1.0"
ARCH="all"
STAGE="$ROOT_DIR/.pkgstage"
OUTPUT_DIR="$ROOT_DIR/dist"
CONTROL_DIR="$STAGE/CONTROL"

rm -rf "$STAGE" "$OUTPUT_DIR"
mkdir -p "$CONTROL_DIR" "$OUTPUT_DIR"

cd "$ROOT_DIR"
npm run build:ui >/dev/null

cp -R package/data/. "$STAGE/"
install -m 0755 package/control/postinst "$CONTROL_DIR/postinst"
install -m 0755 package/control/prerm "$CONTROL_DIR/prerm"
install -m 0755 package/control/postrm "$CONTROL_DIR/postrm"

cat > "$CONTROL_DIR/control" <<EOF
Package: $PKG_NAME
Version: $PKG_VERSION
Architecture: $ARCH
Maintainer: XIAOZHAOXSXH
Section: utils
Priority: optional
Depends: libc, uci, lua, gl-sdk4-ui-core
Description: PWM fan control plugin for GL.iNet SDK4 UI.
EOF

find "$STAGE" -type f \( -name '*.sh' -o -path '*/init.d/*' -o -path '*/sbin/*' -o -path '*/rpc/*' \) -exec chmod 0755 {} +

TMPDIR=$(mktemp -d)
tar -C "$STAGE" -czf "$TMPDIR/data.tar.gz" .
tar -C "$CONTROL_DIR" -czf "$TMPDIR/control.tar.gz" .
printf '2.0\n' > "$TMPDIR/debian-binary"

PKG_FILE="$OUTPUT_DIR/${PKG_NAME}_${PKG_VERSION}_${ARCH}.ipk"
tar --format=ustar -C "$TMPDIR" -czf "$PKG_FILE" debian-binary data.tar.gz control.tar.gz

rm -rf "$TMPDIR" "$STAGE"
echo "$PKG_FILE"
