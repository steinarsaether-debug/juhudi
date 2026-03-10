#!/bin/bash
# ── Juhudi Kilimo – Remove LAN Firewall Rules ─────────────────────────────────
# Run with: sudo bash scripts/close-firewall.sh
# ─────────────────────────────────────────────────────────────────────────────

echo "➤ Removing Juhudi Kilimo pf rules..."
rm -f /etc/pf.anchors/juhudi_kilimo

# Remove anchor lines from pf.conf
sed -i '' '/juhudi_kilimo/d' /etc/pf.conf
sed -i '' '/Juhudi Kilimo LAN/d' /etc/pf.conf

pfctl -f /etc/pf.conf 2>/dev/null && echo "✅ pf rules removed and reloaded"
echo "✅ Firewall rules cleaned up"
