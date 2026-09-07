#!/bin/sh
set -eu
cd "$(dirname "$0")"
test -f /var/lib/sucha-water-dashboard/water-level.sqlite3
test -f /etc/sucha-irrigation/farmultimate-device-token.secret
install -d -m 755 /opt/sucha-owner-monitor
install -m 644 publisher.py /opt/sucha-owner-monitor/publisher.py
install -m 644 sucha-owner-monitor.service /etc/systemd/system/sucha-owner-monitor.service
install -m 644 sucha-owner-monitor.timer /etc/systemd/system/sucha-owner-monitor.timer
systemd-analyze verify /etc/systemd/system/sucha-owner-monitor.service /etc/systemd/system/sucha-owner-monitor.timer
systemctl daemon-reload
systemctl enable --now sucha-owner-monitor.timer
systemctl start sucha-owner-monitor.service
systemctl is-active sucha-owner-monitor.timer
