const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const pkgName = pkg.name;
const version = pkg.version;
const arch = 'all';
const ipk = process.argv[2] || path.join(root, 'dist', `${pkgName}_${version}_${arch}.ipk`);

if (!fs.existsSync(ipk)) {
  throw new Error(`IPK not found: ${ipk}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gl-fanctrl-ipk-'));
const outer = path.join(tmp, 'outer');
const control = path.join(tmp, 'control');
const data = path.join(tmp, 'data');

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function untar(archive, cwd) {
  execFileSync('tar', ['-xzf', archive, '-C', cwd], { stdio: 'inherit' });
}

function assertFile(p) {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    throw new Error(`missing file: ${p}`);
  }
}

function assertText(p, needle) {
  const text = fs.readFileSync(p, 'utf8');
  if (!text.includes(needle)) {
    throw new Error(`${p} does not include ${needle}`);
  }
}

try {
  mkdir(outer);
  mkdir(control);
  mkdir(data);

  untar(ipk, outer);
  assertFile(path.join(outer, 'debian-binary'));
  assertFile(path.join(outer, 'control.tar.gz'));
  assertFile(path.join(outer, 'data.tar.gz'));

  untar(path.join(outer, 'control.tar.gz'), control);
  untar(path.join(outer, 'data.tar.gz'), data);

  const controlFiles = ['control', 'conffiles', 'postinst', 'prerm', 'postrm'];
  for (const f of controlFiles) assertFile(path.join(control, f));
  assertText(path.join(control, 'control'), 'Package: gl-fanctrl');
  assertText(path.join(control, 'conffiles'), '/etc/config/gl_fanctrl');

  const dataFiles = [
    'etc/config/gl_fanctrl',
    'etc/init.d/gl_fanctrl',
    'usr/share/fanctrl/fanctrl-common.sh',
    'usr/sbin/gl-fanctrl-daemon',
    'usr/lib/oui-httpd/rpc/fanctrl',
    'usr/share/gl-validator.d/fanctrl.lua',
    'usr/share/oui/menu.d/fanctrl.json',
    'www/views/gl-sdk4-ui-fanctrl.common.js.gz',
    'www/i18n/gl-sdk4-ui-fanctrl.en.json',
    'www/i18n/gl-sdk4-ui-fanctrl.zh-cn.json',
    'www/i18n/gl-sdk4-ui-fanctrl.zh-tw.json'
  ];
  for (const f of dataFiles) assertFile(path.join(data, f));

  console.log(`checked ${ipk}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
