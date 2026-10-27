#!/bin/bash
TARGET_IP="187.127.159.28"
echo "[SSL-WATCHER] Monitoring DNS for chatgcm.in pointing to $TARGET_IP..."

for i in {1..60}; do
    APEX_IP=$(dig @ns1.dns-parking.com chatgcm.in A +short | tail -n1)
    echo "[$(date +%T)] Check $i: chatgcm.in -> '$APEX_IP'"
    
    if [ "$APEX_IP" = "$TARGET_IP" ]; then
        echo "[SSL-WATCHER] DNS matched! Requesting Let's Encrypt SSL certificate..."
        
        # Check if www also resolves or just apex
        WWW_IP=$(dig @ns1.dns-parking.com www.chatgcm.in A +short | tail -n1)
        DOMAINS="-d chatgcm.in"
        if [ "$WWW_IP" = "$TARGET_IP" ]; then
            DOMAINS="$DOMAINS -d www.chatgcm.in"
        fi
        
        certbot --nginx $DOMAINS --non-interactive --agree-tos -m gcmsafetynets@gmail.com --redirect
        systemctl reload nginx
        echo "[SSL-WATCHER] SSL setup complete!"
        exit 0
    fi
    sleep 10
done
echo "[SSL-WATCHER] Timeout waiting for DNS in this batch."
