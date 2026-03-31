#!/bin/bash
set -e

# Load deployment credentials
source .env.deploy
export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

echo "========================================"
echo "  EduTrack Frontend Deployment"
echo "========================================"

# Step 1: Sync shared-ui
echo ""
echo "[1/4] Syncing shared-ui to both portals..."
rm -rf tutor-portal/shared-ui && cp -r shared-ui tutor-portal/shared-ui
rm -rf student-portal/shared-ui && cp -r shared-ui student-portal/shared-ui
echo "  Done."

# Step 2: Set production env
echo "[2/4] Setting production environment..."
BACKEND=https://edutrack-api-55kb.onrender.com
for portal in tutor-portal student-portal; do
  cat > "$portal/.env.production" <<EOF
VITE_ENV=production
VITE_API_URL=$BACKEND
EOF
done
echo "  Done."

# Step 3: Build both portals
echo "[3/4] Building tutor-portal..."
(cd tutor-portal && npm run build) || { echo "ERROR: tutor-portal build failed"; exit 1; }

echo "       Building student-portal..."
(cd student-portal && npm run build) || { echo "ERROR: student-portal build failed"; exit 1; }
echo "  Done."

# Step 4: Deploy to Cloudflare Pages
echo "[4/4] Deploying to Cloudflare Pages..."
echo ""
echo "  Deploying tutor-portal..."
npx wrangler pages deploy tutor-portal/dist --project-name=edutrack-tutor --commit-dirty=true

echo ""
echo "  Deploying student-portal..."
npx wrangler pages deploy student-portal/dist --project-name=edutrack-student --commit-dirty=true

echo ""
echo "========================================"
echo "  Deployment complete!"
echo "  Tutor:   $TUTOR_PORTAL_URL"
echo "  Student: $STUDENT_PORTAL_URL"
echo "========================================"
