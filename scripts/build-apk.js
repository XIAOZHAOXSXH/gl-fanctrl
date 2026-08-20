const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const pkgName = pkg.name;
const baseVersion = pkg.version;
// Alpine/APK versions use the "version-rN" form. Append a default release
// suffix when the package.json version does not already carry one.
const apkVersion = /-r\d+$/.test(baseVersion) ? baseVersion : `${baseVersion}-r1`;
const arch = 'noarch';

const buildDir = path.join(root, '.apkstage');
const dataDir = path.join(buildDir, 'data');
const scriptsDir = path.join(buildDir, 'scripts');
const dist = path.join(root, 'dist');
const out = path.join(dist, `${pkgName}-${apkVersion}.apk`);

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
function copyDir(src, dst) {
  mkdir(dst);
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Parse a Debian/IPK style control file into a flat metadata object,
// joining continuation lines (those starting with whitespace) onto the
// preceding field value.
function parseControl(file) {
  const meta = {};
  let key = null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^[ \t]/.test(line) && key) {
      meta[key] += ' ' + line.trim();
      continue;
    }
    if (!line.trim()) { key = null; continue; }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    key = line.slice(0, idx).trim();
    meta[key] = line.slice(idx + 1).trim();
  }
  return meta;
}

function isExecutable(rel) {
  rel = rel.replace(/\\/g, '/');
  return rel.startsWith('etc/init.d/')
    || rel.startsWith('usr/sbin/')
    || rel.startsWith('usr/lib/oui-httpd/rpc/')
    || rel.endsWith('.sh');
}

function applyModes(base) {
  for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
    const p = path.join(base, ent.name);
    if (ent.isDirectory()) {
      fs.chmodSync(p, 0o755);
      applyModes(p);
    } else {
      const rel = path.relative(dataDir, p);
      fs.chmodSync(p, isExecutable(rel) ? 0o755 : 0o644);
    }
  }
}

rmrf(buildDir);
rmrf(dist);
mkdir(dataDir);
mkdir(scriptsDir);
mkdir(dist);

// Build the SDK4 UI bundle first, exactly like the ipk build does.
execFileSync(process.execPath, [path.join(root, 'src/ui/build.js')], { stdio: 'inherit' });

// Stage the install tree.
copyDir(path.join(root, 'package/data'), dataDir);
applyModes(dataDir);

const control = parseControl(path.join(root, 'package/control/control'));
const description = (control.Description || '').replace(/\s+/g, ' ').trim();
const maintainer = control.Maintainer || '';
const depends = (control.Depends || '')
  .split(',').map(s => s.trim()).filter(Boolean).join(' ');
const license = control.License || 'GPL-2.0';
const homepage = control.Homepage || control.URL || '';

// /etc/ files are automatically treated as conffiles by apk-tools on upgrade,
// so we do not need to emit an explicit backup field.

// ipk maintainer scripts -> apk script slots.
// postinst -> post-install, prerm -> pre-deinstall, postrm -> post-deinstall.
const scriptMap = {
  'post-install': 'postinst',
  'pre-deinstall': 'prerm',
  'post-deinstall': 'postrm',
};
const stagedScripts = [];
for (const [apkName, ipkName] of Object.entries(scriptMap)) {
  const src = path.join(root, 'package/control', ipkName);
  if (fs.existsSync(src)) {
    const dst = path.join(scriptsDir, apkName);
    fs.copyFileSync(src, dst);
    fs.chmodSync(dst, 0o755);
    stagedScripts.push(apkName);
  }
}

const apkBin = process.env.APK || 'apk';
const args = ['mkpkg'];
args.push('--info', `name:${pkgName}`);
args.push('--info', `version:${apkVersion}`);
if (description) args.push('--info', `description:${description}`);
args.push('--info', `arch:${arch}`);
if (license) args.push('--info', `license:${license}`);
args.push('--info', `origin:${pkgName}`);
if (maintainer) args.push('--info', `maintainer:${maintainer}`);
if (homepage) args.push('--info', `url:${homepage}`);
// Do NOT emit an explicit `provides:<name>=<version>`: in apk-tools a package
// automatically provides its own name=version. Adding it again makes apk see
// two identical providers and fail with "conflicts: ...[<name>=<ver>]".
if (depends) args.push('--info', `depends:${depends}`);
for (const apkName of stagedScripts) {
  args.push('--script', `${apkName}:${path.join(scriptsDir, apkName)}`);
}
args.push('--files', dataDir);
args.push('--output', out);

try {
  execFileSync(apkBin, args, { stdio: 'inherit' });
} catch (e) {
  throw new Error(
    `'apk mkpkg' failed (apk-tools v3 required, e.g. Alpine 3.23+). ` +
    `Set APK=/path/to/apk to point at a binary, or run on GitHub Actions.\n${e.message}`
  );
}

rmrf(buildDir);
console.log(out);
