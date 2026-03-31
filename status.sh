#!/bin/bash

# Load deployment credentials
source .env.deploy

echo "========================================"
echo "  EduTrack Service Status Check"
echo "========================================"
echo ""

# Check a URL and print status
check_service() {
  local name=$1
  local url=$2
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null)
  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    echo "  [OK]   $name  ($url)  HTTP $code"
  else
    echo "  [FAIL] $name  ($url)  HTTP $code"
  fi
}

# Extract JSON string value: extract_val <json> <key>
extract_val() {
  echo "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

# 1. Backend
echo "Backend:"
check_service "API" "$BACKEND_URL/"
echo ""

# 2. Tutor Portal
echo "Tutor Portal:"
check_service "Web" "$TUTOR_PORTAL_URL"
echo ""

# 3. Student Portal
echo "Student Portal:"
check_service "Web" "$STUDENT_PORTAL_URL"

# 4. Render backend latest deploy
echo ""
echo "----------------------------------------"
echo "  Latest Deploys"
echo "----------------------------------------"
echo ""

render_json=$(curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys?limit=1" 2>/dev/null)

if [ -n "$render_json" ]; then
  r_status=$(extract_val "$render_json" "status")
  r_commit=$(extract_val "$render_json" "message")
  r_date=$(extract_val "$render_json" "finishedAt")
  echo "Backend (Render):"
  echo "  Status:  ${r_status:-unknown}"
  echo "  Commit:  ${r_commit:-N/A}"
  echo "  Date:    ${r_date:-N/A}"
else
  echo "Backend (Render): could not fetch"
fi

# 5. Cloudflare Pages latest deployments
echo ""
for project in edutrack-tutor edutrack-student; do
  cf_json=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$project/deployments?per_page=1" 2>/dev/null)

  cf_status=$(echo "$cf_json" | tr -d '\n' | sed -n 's/.*"latest_stage"[^}]*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  cf_env=$(extract_val "$cf_json" "environment")
  cf_commit=$(extract_val "$cf_json" "commit_message")
  cf_date=$(extract_val "$cf_json" "created_on")

  echo "$project (Cloudflare Pages):"
  echo "  Status:  ${cf_status:-unknown}"
  echo "  Env:     ${cf_env:-N/A}"
  echo "  Commit:  ${cf_commit:-N/A}"
  echo "  Date:    ${cf_date:-N/A}"
  echo ""
done

echo "========================================"
