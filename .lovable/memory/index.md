# Memory: index.md
Updated: now

Design system: #f3f5f9 bg, #ffffff cards with box-shadow 0 8px 24px rgba(0,0,0,0.12), Cinzel headers, Montserrat body, champagne gold #c6a769 primary
- Category C MOQ: 9 packs/carton, min 3 per variant, valid combos: 3+3+3, 6+3, 4+5, 9
- 50% advance required for production
- Company: TCF Chocolates & Gifts Private Limited
- All colors use HSL design tokens from index.css
- Golden Pipeline: submitted → in_production → packed_ready → awaiting_final_payment → cleared_for_dispatch → dispatched → delivered (+ cancelled)
- payment_status uses "awaiting_receipt" not "awaiting_utr"
- UI terminology: "Upload Payment Receipt" not "Upload UTR", "Bank Reference No. / Transaction ID" not "UTR Number"
- B2B pricing: 3 categories (bulk_kg, ready_pc, premium_pc) with per-line GST. See mem://features/pricing-rules

## Memories
- [Pricing rules](mem://features/pricing-rules) — 3 category pricing model, sealed carton rules, per-line GST
