#!/bin/bash
# Sync shared-ui into both portals
rsync -av --delete shared-ui/ student-portal/shared-ui/
rsync -av --delete shared-ui/ tutor-portal/shared-ui/
echo "shared-ui synced to both portals"
