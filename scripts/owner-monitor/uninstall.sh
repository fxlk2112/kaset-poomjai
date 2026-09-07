#!/bin/sh
set -eu
# Disable only this additive publisher; keep files and all existing data/services.
systemctl disable --now sucha-owner-monitor.timer
systemctl stop sucha-owner-monitor.service
