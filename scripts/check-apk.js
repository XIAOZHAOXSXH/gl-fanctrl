const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const pkgName = pkg.name;
const baseVersion = pkg.version;
const apkVersion = /-r\d+$/.test(baseVersion) ? baseVersion : `${baseVersion}-r1`;
const expectedName = `${pkgName}-${apkVersion}.apk`;
const apk = process.argv[2] || path.join(root, 'dist', expectedName);

if (!fs.existsSync(apk)) {
  throw new Error(`APK not found: ${apk}`);
}
const stat = fs.statSync(apk);
if (stat.size === 0) {
  throw new Error(`APK is empty: ${apk}`);
}

// APKv3 packages start with the 4-byte "ADB" magic (0x41 0x44 0x42) followed
// by a compression marker ('.', 'd' or 'c'). Verify it is a v3 package.
const head = Buffer.alloc(4);
const fd = fs.openSync(apk, 'r');
fs.readSync(fd, head, 0, 4, 0);
fs.closeSync(fd);
if (head[0] !== 0x41 || head[1] !== 0x44 || head[2] !== 0x42) {
  throw new Error(`APK v3 magic 'ADB' not found at start of ${apk}`);
}

// When apk-tools is available, dump the package listing and verify the
// expected files are present. Try `apk manifest` first, then `apk adbdump`.
const apkBin = process.env.APK || 'apk';
let listing = '';
for (const cmd of [['manifest', apk], ['adbdump', apk]]) {
  try {
    listing = execFileSync(apkBin, cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    break;
  } catch (_) { /* subcommand unavailable, try next */ }
}

if (listing) {
  const mustContain = [
    'gl_fanctrl',
    'gl-fanctrl-daemon',
    'fanctrl-common.sh',
    'rpc/fanctrl',
    'fanctrl.lua',
    'menu.d/fanctrl.json',
    'gl-sdk4-ui-fanctrl.common.js.gz',
  ];
  const missing = mustContain.filter(s => !listing.includes(s));
  if (missing.length) {
    throw new Error(`APK content check failed, missing in listing: ${missing.join(', ')}`);
  }
} else {
  console.log('warning: apk-tools not available; skipped content listing check (magic/size only)');
}

console.log(`checked ${apk}`);
