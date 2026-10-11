# Deploying CRB OT Clinic

One VPS runs the whole stack with Docker Compose (`docker-compose.prod.yml`):

| Service   | What it does                                                                  |
| --------- | ----------------------------------------------------------------------------- |
| `caddy`   | HTTPS on ports 80 and 443, automatic Let's Encrypt certificates, proxy to app |
| `app`     | The Next.js server, as an unprivileged user on a read-only filesystem         |
| `migrate` | One-off: applies database migrations, then exits. The app waits for it        |
| `db`      | Postgres 16. Not published; only reachable inside the stack                   |
| `jobs`    | Calls the daily scheduling job at 01:00 Manila time                           |
| `backup`  | Encrypted `pg_dump` to an off-site restic repository at 02:00 Manila time     |

Images are built by GitLab CI on `main` and pushed to the project's container registry. The `deploy` job (manual) copies the compose file and `deploy/` to the server and rolls the stack to that commit.

## 1. Prepare the server (once)

Any VPS with 2 GB of RAM and Ubuntu 24.04 LTS is plenty. As root:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl ufw unattended-upgrades
curl -fsSL https://get.docker.com | sh

# Firewall: SSH and web only.
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable

# A deploy user that can run Docker, with no password login.
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /srv/crb-ot-clinic && chown deploy:deploy /srv/crb-ot-clinic
```

Add the CI deploy key (see step 3) to `/home/deploy/.ssh/authorized_keys`, and set `PasswordAuthentication no` in `/etc/ssh/sshd_config`.

Point the clinic's DNS record (for example `app.crbclinic.ph`) at the server's IP before the first start, so Caddy can get a certificate.

## 2. Configure

As `deploy`, copy `deploy/.env.production.example` from the repository to `/srv/crb-ot-clinic/.env`, fill it in and lock it down:

```bash
chmod 600 /srv/crb-ot-clinic/.env
```

- Generate each secret with the command next to it. `POSTGRES_PASSWORD` and `CRON_SECRET` use hex so they are safe inside URLs.
- `SMTP_URL` and `EMAIL_FROM` are required: password reset emails are how staff set their passwords.
- `RESTIC_PASSWORD` encrypts the backups. Keep a copy somewhere other than this server (the owner's password manager); without it the backups cannot be read.
- The `BOOTSTRAP_*` values create the owner's account on the very first start (step 4). Remove them afterwards.

The app validates every variable when it starts and refuses to run with a bad value (for example an `http://` URL, a missing SMTP server, or the demo clock), and says which one.

## 3. Connect GitLab

In **Settings → CI/CD → Variables**, add these as **protected** (and masked where GitLab allows):

| Variable             | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| `DEPLOY_HOST`        | The server's hostname or IP                                             |
| `DEPLOY_USER`        | `deploy`                                                                |
| `DEPLOY_SSH_KEY`     | Type **File**: a private key made for CI only (`ssh-keygen -t ed25519`) |
| `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan <server>`, so CI can verify the server           |
| `DEPLOY_DOMAIN`      | The app's hostname, for the environment link                            |

Protect the `main` branch so only maintainers can push or merge, since protected variables are available to it.

On the server, log in to the registry once so it can pull private images (a deploy token with `read_registry` is enough):

```bash
docker login registry.gitlab.com
```

## 4. First deploy

Merge to `main`. The pipeline runs lint, type checks, unit, database, end-to-end, accessibility and security checks, then builds the images. Start the **deploy** job by hand.

On the first start the app finds an empty database and, because the `BOOTSTRAP_*` variables are set, creates the four rate classes, the main branch and the owner's account, then emails the owner a link to set a password. Check the logs:

```bash
cd /srv/crb-ot-clinic
docker compose -f docker-compose.prod.yml logs app | grep owner
```

Then remove the `BOOTSTRAP_*` lines from `.env`. The owner signs in, sets rates and session types in Settings, adds staff, and creates the other accounts; each new user gets an email to set their own password.

## 5. Everyday operations

```bash
cd /srv/crb-ot-clinic
alias dc='docker compose -f docker-compose.prod.yml'

dc ps                      # what is running and healthy
dc logs -f app             # app logs (no patient data: ids only)
curl -fsS https://$DOMAIN/api/health
dc restart app             # restart the app only
```

**Updates** go through CI: merge to `main`, then run the deploy job. It pulls the new images, runs `migrate`, and replaces the app. To roll back, re-run the deploy job of an earlier pipeline; migrations are written to be additive, so the previous image keeps working on the newer schema.

**Operating system updates** install themselves (`unattended-upgrades`). Reboot during a quiet hour when `/var/run/reboot-required` exists; every service restarts on its own.

## 6. Backups and restore

Every night `backup` streams `pg_dump` (custom format) straight into restic, so nothing unencrypted touches the disk, then keeps 14 daily, 8 weekly and 12 monthly snapshots. On Sundays it verifies a 10% sample of the stored data.

```bash
dc exec backup sh -c '. /run/backup.env && restic snapshots'      # list backups
dc exec backup /usr/local/bin/backup.sh                            # back up now
```

**Restore** (test this every few months on a spare server, not production):

```bash
dc stop app jobs
dc exec backup sh -c '. /run/backup.env && restic dump latest crb-<stamp>.dump > /tmp/crb.dump'
dc exec backup sh -c 'dropdb --if-exists crb_restore && createdb crb_restore && pg_restore --no-owner -d crb_restore /tmp/crb.dump'
# Check crb_restore, then swap it in:
dc exec db psql -U crb -d postgres -c "ALTER DATABASE crb RENAME TO crb_old" -c "ALTER DATABASE crb_restore RENAME TO crb"
dc start app jobs
```

`restic snapshots` shows the `<stamp>` of each dump. Keep `crb_old` until the clinic confirms the restored data, then drop it.

## 7. Security notes

- Only Caddy is reachable from outside. Postgres has no published port and sits on an internal network with no route to the internet; only the app (for email) and the backup service (for the off-site repository) can reach out.
- The app container runs as `node`, read-only, with every Linux capability dropped and `no-new-privileges`.
- Logs are capped at 5 × 10 MB per service. Paths in access logs contain record ids, never names.
- The daily job endpoint needs `CRON_SECRET`; health checks say only "ok" or "down".
- Secrets live only in `/srv/crb-ot-clinic/.env` (mode 600) and GitLab's protected variables; images contain none.
