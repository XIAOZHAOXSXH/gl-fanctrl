import json
import os
import posixpath
import sys
import time
import base64

import paramiko


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IPK = os.path.join(ROOT, "dist", "gl-fanctrl_0.1.0_all.ipk")


def env(name, default=None):
    value = os.environ.get(name, default)
    if value is None:
        raise SystemExit(f"Missing environment variable: {name}")
    return value


def run(client, command, timeout=30):
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def upload(client, local, remote):
    try:
        sftp = client.open_sftp()
        sftp.put(local, remote)
        sftp.close()
        return
    except Exception:
        pass

    chan = client.get_transport().open_session()
    chan.exec_command(f"cat > {remote}")
    with open(local, "rb") as f:
        while True:
            chunk = f.read(32768)
            if not chunk:
                break
            chan.sendall(chunk)
    chan.shutdown_write()
    rc = chan.recv_exit_status()
    if rc != 0:
        raise SystemExit(f"upload failed with rc={rc}")


def main():
    if not os.path.exists(IPK):
        raise SystemExit(f"IPK not found: {IPK}. Run npm run build:ipk first.")

    host = env("GL_ROUTER_HOST", "192.168.1.1")
    user = env("GL_ROUTER_USER", "root")
    password = env("GL_ROUTER_PASSWORD")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=10, banner_timeout=10, auth_timeout=10)

    remote = "/tmp/gl-fanctrl_0.1.0_all.ipk"
    upload(client, IPK, remote)

    checks = [
        ("board", "ubus call system board"),
        ("cleanup", "opkg remove gl-fanctrl >/dev/null 2>&1 || true"),
        ("install", f"opkg install {remote}"),
        ("config", "uci show gl_fanctrl"),
        ("services", "ps w | grep -E '[g]l_fan|[g]l-fanctrl'"),
        (
            "rpc",
            "i=0; while [ $i -lt 10 ]; do "
            "curl -s -H glinet:1 -X POST http://127.0.0.1/rpc "
            "-d '{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":[\"\",\"fanctrl\",\"get_status\",{}],\"id\":1}' && exit 0; "
            "i=$((i + 1)); sleep 1; "
            "done; exit 1",
        ),
    ]

    for name, cmd in checks:
        rc, out, err = run(client, cmd, timeout=60)
        print(f"## {name} rc={rc}")
        print(out.strip())
        if err.strip():
            print("STDERR:")
            print(err.strip())
        if name in {"install", "rpc"} and rc != 0:
            raise SystemExit(f"{name} failed")

    client.close()


if __name__ == "__main__":
    main()
