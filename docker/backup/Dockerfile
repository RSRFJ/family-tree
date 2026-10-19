FROM postgres:17-alpine
RUN apk add --no-cache tzdata
COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh && mkdir -p /backups
ENTRYPOINT ["crond", "-f", "-l", "2", "-c", "/etc/crontabs"]
