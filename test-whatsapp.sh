#!/bin/bash

# Load env variables
source .env

# Test send-whatsapp function locally
echo "Testing send-whatsapp with Click2API..."

curl -X POST http://localhost:54321/functions/v1/send-whatsapp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "to": "+919876543210",
    "message": "Test WhatsApp from Oasis Baklawa",
    "order_id": "test-order-123",
    "company_id": "test-company-123"
  }'

echo ""
echo "Testing send-whatsapp-automation..."

curl -X POST http://localhost:54321/functions/v1/send-whatsapp-automation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "orderId": "test-order-123",
    "triggerType": "so_created"
  }'
