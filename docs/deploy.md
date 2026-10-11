# Deploying CRB OT Clinic

One VPS runs the whole stack with Docker Compose (`docker-compose.prod.yml`):

| Service   | What it does                                                                      |
| --------- | --------------------------------------------------------------------------------- |
| `caddy`   | HTTPS on ports 80 and 443, automatic Let's Encrypt certificates, proxy to app     |
| `app`     | The Next.js server, as an unprivileged user on a read-only filesystem             |
| `migrate` | One-off: applies database migrations, then exits. The app waits for it            |
| `db`      | Postgres 16. Not published; only reachable inside the stack                       |
| `jobs`    | Calls the daily scheduling job at 01:00 Manila time                               |
| `backup`  | Encrypted `pg_dump` into restic at 02:00 Manila time (on the server, or off-site) |

Images are built by GitHub Actions on `main` and pushed to the GitHub Container Registry (`ghcr.io/christianrazul/crb-ot-clinic-new`). The deploy job waits for your approval, then copies the compose file and `deploy/` to the server and rolls the stack to that commit.

Production: **https://crbotclinic.com** on the VPS at **103.167.150.117**.

## 1. Prepare the server (once)

`deploy/setup-server.sh` does it all and is safe to re-run: updates and automatic security updates, Docker from Docker's apt repository, the firewall (SSH, 80, 443), 2 GB of swap, fail2ban, the `deploy` user with the CI key, and `/srv/crb-ot-clinic`. As root on the server:

```bash
DEPLOY_PUBKEY="ssh-ed25519 AAAA... github-actions deploy crbotclinic.com" bash setup-server.sh
# Once your own key login works, turn off SSH passwords:
HARDEN_SSH=1 DEPLOY_PUBKEY="..." bash setup-server.sh
```

At your domain registrar, add an **A record** for `crbotclinic.com` (host `@`) pointing to `103.167.150.117`, and remove any parking-page records for `@`. Do this before the first start so Caddy can get a certificate; check with `dig +short crbotclinic.com`.

## 2. Configure

As `deploy`, copy `deploy/.env.production.example` from the repository to `/srv/crb-ot-clinic/.env`, fill it in and lock it down:

```bash
chmod 600 /srv/crb-ot-clinic/.env
```

- Generate each secret with the command next to it. `POSTGRES_PASSWORD` and `CRON_SECRET` use hex so they are safe inside URLs.
- `SMTP_URL` and `EMAIL_FROM` are required: password reset emails are how staff set their passwords.
- `RESTIC_REPOSITORY` empty keeps backups in `/srv/crb-ot-clinic/backups` on the server. That covers mistakes and bad updates but not losing the server, so set an S3-compatible bucket (Backblaze B2's free 10 GB is plenty) with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as soon as you can; the next start creates the repository there. Copy any snapshots you want to keep from the local one with `restic copy`.
- `RESTIC_PASSWORD` encrypts the backups. Keep a copy somewhere other than this server (the owner's password manager); without it the backups cannot be read.
- The `BOOTSTRAP_*` values create the owner's account on the very first start (step 4). Remove them afterwards.

The app validates every variable when it starts and refuses to run with a bad value (for example an `http://` URL, a missing SMTP server, or the demo clock), and says which one.

## 3. Connect GitHub

Make a key pair for CI only, on your own computer:

```bash
ssh-keygen -t ed25519 -f crb-deploy -C "github-actions deploy" -N ""
ssh-keyscan -t ed25519 103.167.150.117 > crb-known-hosts
```

Append `crb-deploy.pub` to `/home/deploy/.ssh/authorized_keys` on the server.

In the repository, **Settings → Environments → New environment**, name it `production`, then:

- **Required reviewers:** add yourself, so every deploy waits for your approval.
- **Deployment branches:** "Selected branches", `main` only.
- **Environment secret** `DEPLOY_SSH_KEY`: the contents of `crb-deploy` (the private key). Then delete the local copy.
- **Environment variables:**

| Variable             | Value                             |
| -------------------- | --------------------------------- |
| `DEPLOY_HOST`        | `103.167.150.117`                 |
| `DEPLOY_USER`        | `deploy`                          |
| `DEPLOY_DOMAIN`      | `crbotclinic.com`                 |
| `DEPLOY_KNOWN_HOSTS` | the contents of `crb-known-hosts` |

Also protect `main` (**Settings → Branches**: require pull requests and passing checks), since it is the only branch that can deploy.

**Images.** After the first pipeline on `main` pushes them, open **your profile → Packages**, and for both `crb-ot-clinic-new` and `crb-ot-clinic-new/migrate` choose **Package settings → Change visibility → Public**. The code is public already and the images hold no secrets, so the server can pull without logging in. To keep them private instead, make a classic token with only `read:packages` and run `docker login ghcr.io -u christianrazul` once on the server as `deploy`.

## 4. First deploy

Push or merge to `main`. The CI workflow runs lint, type checks, unit, database, end-to-end, accessibility and security checks, then builds and pushes the images. The **deploy** job then waits: open the run in the **Actions** tab and choose **Review deployments → Approve**. (The very first run pushes the images before you can make them public, so if the deploy fails to pull, make them public and re-run the deploy job.)

On the first start the app finds an empty database and, because the `BOOTSTRAP_*` variables are set, creates the four rate classes, the main branch and the owner's account, then emails the owner a link to set a password. Check the logs:

```bash
cd /srv/crb-ot-clinic
docker compose -f docker-compose.prod.yml logs app | grep owner
```

Then remove the `BOOTSTRAP_*` lines from `.env`. The owner signs in and sets rates and session types in Settings.

**Onboarding people.** Nobody sets a password for anyone else:

- **Therapists, aides and tutors:** Settings → Staff → Add staff member, with a login email. Or, for someone already on staff, Settings → Team accounts → Add account → "Therapist login for …".
- **Front desk (secretaries) and other owners:** Settings → Team accounts → Add account, pick the access and branches.

They get "You're invited to CRB OT Clinic", follow the link (it works once, for 3 days), choose a password and sign in. Team accounts shows who is still **Invited**, who is **Active** and when they last signed in, and lets the owner resend an invite, change someone's access, or **Turn off** an account when someone leaves (they are signed out at once; their history stays).

## 5. Everyday operations

```bash
cd /srv/crb-ot-clinic
alias dc='docker compose -f docker-compose.prod.yml'

dc ps                      # what is running and healthy
dc logs -f app             # app logs (no patient data: ids only)
curl -fsS https://$DOMAIN/api/health
dc restart app             # restart the app only
```

**Updates** go through CI: merge to `main`, then approve the deploy. It pulls the new images, runs `migrate`, and replaces the app. To roll back, run the **Deploy** workflow by hand (**Actions → Deploy → Run workflow**) with an earlier commit's full SHA; migrations are written to be additive, so the previous image keeps working on the newer schema.

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
- Secrets live only in `/srv/crb-ot-clinic/.env` (mode 600) and the `production` environment secret on GitHub; images contain none.
