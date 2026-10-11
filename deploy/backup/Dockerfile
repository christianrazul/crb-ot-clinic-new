# pg_dump (matching the server's Postgres 16) plus restic for encrypted, deduplicated off-site backups.
FROM restic/restic:0.19.1 AS restic

FROM postgres:16.15-alpine3.23
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY entrypoint.sh backup.sh /usr/local/bin/
# Times are UTC: 18:00 is 02:00 in Manila. Check a sample of the data on Sundays.
RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/backup.sh \
 && printf '0 18 * * * /usr/local/bin/backup.sh\n30 19 * * 0 /usr/local/bin/backup.sh check\n' > /etc/crontabs/root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
