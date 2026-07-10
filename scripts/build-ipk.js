const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const pkgName = pkg.name;
const version = pkg.version;
const arch = 'all';
const stage = path.join(root, '.pkgstage');
const dist = path.join(root, 'dist');
const controlDir = path.join(stage, 'CONTROL');
const temp = path.join(root, '.ipkbuild');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dst) {
  mkdir(dst);
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeExecutable(src, dst) {
  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o755);
}

rmrf(stage);
rmrf(temp);
rmrf(dist);
mkdir(controlDir);
mkdir(temp);
mkdir(dist);

execFileSync(process.execPath, [path.join(root, 'src/ui/build.js')], { stdio: 'inherit' });

copyDir(path.join(root, 'package/data'), stage);
writeExecutable(path.join(root, 'package/control/postinst'), path.join(controlDir, 'postinst'));
writeExecutable(path.join(root, 'package/control/prerm'), path.join(controlDir, 'prerm'));
writeExecutable(path.join(root, 'package/control/postrm'), path.join(controlDir, 'postrm'));
fs.copyFileSync(path.join(root, 'package/control/control'), path.join(controlDir, 'control'));
fs.copyFileSync(path.join(root, 'package/control/conffiles'), path.join(controlDir, 'conffiles'));

const py = String.raw`
import os, tarfile, pathlib, shutil
root = pathlib.Path(r'''${root}''')
stage = pathlib.Path(r'''${stage}''')
control = pathlib.Path(r'''${controlDir}''')
temp = pathlib.Path(r'''${temp}''')
dist = pathlib.Path(r'''${dist}''')
out = dist / '${pkgName}_${version}_${arch}.ipk'

def mode_for(rel, is_dir):
    rel = rel.replace('\\\\', '/')
    if is_dir:
        return 0o755
    if rel.startswith('./etc/init.d/') or rel.startswith('./usr/sbin/') or rel.startswith('./usr/lib/oui-httpd/rpc/') or rel.endswith('.sh') or rel in ('./postinst', './postrm', './prerm'):
        return 0o755
    return 0o644

def add_tree(tf, src):
    src = pathlib.Path(src)
    root_info = tarfile.TarInfo('./')
    root_info.type = tarfile.DIRTYPE
    root_info.mode = 0o755
    root_info.mtime = 0
    tf.addfile(root_info)
    for p in sorted(src.rglob('*')):
        rel = './' + p.relative_to(src).as_posix()
        info = tf.gettarinfo(str(p), arcname=rel)
        info.uid = info.gid = 0
        info.uname = info.gname = 'root'
        info.mtime = 0
        info.mode = mode_for(rel, p.is_dir())
        if p.is_file():
            with open(p, 'rb') as f:
                tf.addfile(info, f)
        else:
            tf.addfile(info)

def make_tar_gz(src, dst):
    with tarfile.open(dst, 'w:gz', format=tarfile.USTAR_FORMAT) as tf:
        add_tree(tf, src)

make_tar_gz(control, temp / 'control.tar.gz')
shutil.rmtree(control)
make_tar_gz(stage, temp / 'data.tar.gz')
(temp / 'debian-binary').write_text('2.0\n', encoding='ascii')
with tarfile.open(out, 'w:gz', format=tarfile.USTAR_FORMAT) as tf:
    for name in ('debian-binary', 'data.tar.gz', 'control.tar.gz'):
        p = temp / name
        info = tf.gettarinfo(str(p), arcname=name)
        info.uid = info.gid = 0
        info.uname = info.gname = 'root'
        info.mode = 0o644
        info.mtime = 0
        with open(p, 'rb') as f:
            tf.addfile(info, f)
print(out)
`;

execFileSync('python', ['-c', py], { stdio: 'inherit' });
rmrf(stage);
rmrf(temp);
