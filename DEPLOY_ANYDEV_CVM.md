## Deploy a Next.js (or similar Node) app on a DevCloud AnyDev CVM

### TL;DR — the mental model

`sbryankusno-any{N}.devcloud.woa.com` is just a **DNS alias** that resolves
to your CVM's internal IP. It does **not** do any magic port-forwarding, so
your browser hits **port 80 (HTTP)** or **port 443 (HTTPS)** of the CVM
directly. If nothing is listening on those ports, the site is unreachable.

```
Browser ──► {user}-any{N}.devcloud.woa.com
          (DNS A record)
              │
              ▼
        CVM internal IP (e.g. 9.134.41.81)
              │
              ▼
        Port 80 / 443  ◄── YOUR app must listen here
```

### The 7 rules that make it work

1. **Listen on `0.0.0.0`** — never `127.0.0.1` or `localhost`.
2. **Bind to port 80** (HTTP). Don't use 3000/5173/8080 unless your domain
   pattern supports a port prefix — the plain `…woa.com` domain won't.
3. **Run as root** (`sudo`) so you can bind the privileged port (<1024).
4. **Use `http://` in `AUTH_URL` and `NEXT_PUBLIC_APP_URL`**. Standard
   AnyDev CVMs don't terminate TLS for the `-any{N}` hostname. If you
   need HTTPS, front the app with a CLB or nginx + cert yourself.
5. **Build for production** (`next build` + `next start`). `npm run dev`
   has websocket/HMR quirks that misbehave behind a bare-IP domain.
6. **Run Prisma before build**:
   ```bash
   npx prisma generate
   npx prisma db push --accept-data-loss --skip-generate
   ```
   Otherwise `next build` will fail because `@prisma/client` types
   aren't materialised yet.
7. **Detach the process** with `nohup … & disown` so it survives the
   SSH session closing.

### Copy-paste recipe

```bash
# 1. SSH in (from iOA / office network)
ssh root@<CVM_IP> -p 36000

# 2. Deps (once per CVM)
#    Node 20+ and a build toolchain.
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# 3. Clone / pull your project
cd /data/workspace
git clone <your repo> || (cd <your project> && git pull)
cd <your project>

# 4. Point the app at the public hostname (HTTP, port 80)
cat >> .env <<'EOF'
AUTH_URL=http://<user>-any<N>.devcloud.woa.com
NEXT_PUBLIC_APP_URL=http://<user>-any<N>.devcloud.woa.com
EOF

# 5. Install + generate prisma + build
npm ci --registry=https://mirrors.tencent.com/npm/
npx prisma generate
npx prisma db push --accept-data-loss --skip-generate
npm run build

# 6. Free port 80 and launch
fuser -k 80/tcp 2>/dev/null || true
nohup npx next start -H 0.0.0.0 -p 80 \
    > /tmp/app.log 2>&1 &
disown

# 7. Smoke test
sleep 6
curl -I http://127.0.0.1/          # from CVM itself
curl -I http://<CVM_IP>/           # from CVM using its IP
# Then in your browser:
#   http://<user>-any<N>.devcloud.woa.com/
```

### Common failure modes & fixes

| Symptom                                           | Root cause                                  | Fix                                      |
| ------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Browser: ERR_CONNECTION_REFUSED                   | Nothing listening on port 80                | `ss -tlnp \| grep :80` then start app    |
| `EACCES: permission denied 0.0.0.0:80`            | Not running as root                         | Re-run under `sudo`                      |
| `Error: listen EADDRINUSE :::80`                  | Another process already holds port 80       | `fuser -k 80/tcp` then retry             |
| NextAuth "Configuration" error / redirect loop    | `AUTH_URL` scheme mismatches what's served  | Set `AUTH_URL=http://…` (no https)       |
| `next build` fails at "Cannot find @prisma/client"| Prisma client not generated                 | `npx prisma generate` before build       |
| Works on `curl 127.0.0.1` but not from browser    | App listens on 127.0.0.1, not 0.0.0.0       | `next start -H 0.0.0.0 -p 80`            |
| Site goes down after you log out of SSH           | Process killed with the shell               | Use `nohup … & disown` (or PM2/systemd)  |

### Going further (optional, not required)

- **PM2** (`npm i -g pm2 && pm2 start "npx next start -H 0.0.0.0 -p 80" --name app`)
  gives you auto-restart + log rotation.
- **systemd unit** for reboot-persistence — ask the AI to generate one
  from the command above.
- **HTTPS** — terminate TLS with nginx + a cert (Let's Encrypt won't
  work on internal domains; use an internal CA or a CLB in front).
