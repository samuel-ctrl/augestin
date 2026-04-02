#!/usr/bin/env bash
set -e

# Load deployment credentials
source .env.deploy

echo "========================================"
echo "  EduTrack Backend Deployment (Render)"
echo "========================================"

DEPLOY_HOOK="https://api.render.com/deploy/$RENDER_SERVICE_ID?key=8A7IEDbE_uk"
API_BASE="https://api.render.com/v1"

# Step 1: Trigger deploy
echo ""
echo "[1/3] Triggering deploy..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_HOOK")

if [ "$response" -ne 200 ] && [ "$response" -ne 201 ]; then
  echo "  ERROR: Deploy trigger failed! (HTTP $response)"
  exit 1
fi
echo "  Deploy triggered successfully."

# Step 2: Wait a moment for Render to register the deploy
echo "[2/3] Waiting for deploy to start..."
sleep 5

# Step 3: Poll deploy status
echo "[3/3] Monitoring deploy status..."
echo ""

max_attempts=60  # 10 minutes max (60 * 10s)
attempt=0

while [ $attempt -lt $max_attempts ]; do
  deploy_info=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
    "$API_BASE/services/$RENDER_SERVICE_ID/deploys?limit=1")

  status=$(echo "$deploy_info" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  case "$status" in
    live)
      echo "  Status: LIVE"
      echo ""
      echo "========================================"
      echo "  Deployment complete!"
      echo "  Backend: $BACKEND_URL"
      echo "  Status:  LIVE"
      echo "========================================"
      exit 0
      ;;
    build_in_progress)
      echo "  Status: Building... (${attempt}0s elapsed)"
      ;;
    update_in_progress)
      echo "  Status: Deploying... (${attempt}0s elapsed)"
      ;;
    created)
      echo "  Status: Queued... (${attempt}0s elapsed)"
      ;;
    build_failed|update_failed)
      echo "  Status: FAILED"
      echo ""
      echo "========================================"
      echo "  Deployment FAILED!"
      echo "  Check logs: https://dashboard.render.com"
      echo "========================================"
      exit 1
      ;;
    canceled|deactivated)
      echo "  Status: $status"
      echo ""
      echo "========================================"
      echo "  Deployment was $status."
      echo "========================================"
      exit 1
      ;;
    *)
      echo "  Status: $status (${attempt}0s elapsed)"
      ;;
  esac

  sleep 10
  attempt=$((attempt + 1))
done

echo ""
echo "========================================"
echo "  Timed out waiting for deploy."
echo "  Check status: https://dashboard.render.com"
echo "========================================"
exit 1
