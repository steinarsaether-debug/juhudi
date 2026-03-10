#!/bin/bash
# ── Juhudi Kilimo – macOS LAN Firewall Setup ─────────────────────────────────
# Allows other devices on 172.16.12.0/24 to reach the app.
# Run once with: sudo bash scripts/open-firewall.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

NODE_PATH=$(which node 2>/dev/null || echo "/usr/local/bin/node")
echo "➤ Node binary: $NODE_PATH"

# ── 1. macOS Application Firewall ────────────────────────────────────────────
echo ""
echo "➤ Adding Node.js to the Application Firewall allow list..."
/usr/libexec/ApplicationFirewall/socketfilterfw --add "$NODE_PATH"
/usr/libexec/ApplicationFirewall/socketfilterfw --unblock "$NODE_PATH"
echo "  ✅ Node.js unblocked in Application Firewall"

# ── 2. pf (packet filter) rules for ports 4000 and 5173 ─────────────────────
echo ""
echo "➤ Adding pf rules to allow LAN access on ports 4000 and 5173..."

PF_RULES_FILE="/etc/pf.anchors/juhudi_kilimo"

# Write the anchor rules
cat > "$PF_RULES_FILE" << 'PFRULES'
# Juhudi Kilimo – allow LAN subnet (172.16.12.0/24) to access dev servers
# Backend API
pass in proto tcp from 172.16.12.0/24 to any port 4000
# Frontend dev server
pass in proto tcp from 172.16.12.0/24 to any port 5173
PFRULES

echo "  ✅ Rules written to $PF_RULES_FILE"

# Add anchor reference to pf.conf if not already present
PF_CONF="/etc/pf.conf"
ANCHOR_LINE='anchor "juhudi_kilimo"'
LOAD_LINE='load anchor "juhudi_kilimo" from "/etc/pf.anchors/juhudi_kilimo"'

if ! grep -qF 'juhudi_kilimo' "$PF_CONF"; then
  echo "" >> "$PF_CONF"
  echo "# ── Juhudi Kilimo LAN dev access ──" >> "$PF_CONF"
  echo "$ANCHOR_LINE" >> "$PF_CONF"
  echo "$LOAD_LINE" >> "$PF_CONF"
  echo "  ✅ Anchor added to $PF_CONF"
else
  echo "  ℹ  Anchor already in $PF_CONF – skipping"
fi

# Load / reload pf
pfctl -f "$PF_CONF" 2>/dev/null && echo "  ✅ pf rules reloaded"

# Ensure pf is enabled
pfctl -e 2>/dev/null && echo "  ✅ pf enabled" || echo "  ℹ  pf already enabled"

# ── 3. Summary ────────────────────────────────────────────────────────────────
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅  Firewall configured. Other devices can now access:"
echo ""
echo "  Frontend  →  http://${LAN_IP}:5173"
echo "  Backend   →  http://${LAN_IP}:4000"
echo ""
echo "  Share the Frontend URL with other users on this network."
echo "  The backend URL is only needed for direct API testing."
echo "═══════════════════════════════════════════════════════════════"
