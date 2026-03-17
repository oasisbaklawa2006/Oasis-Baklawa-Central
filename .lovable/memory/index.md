Design system & business rules for Oasis Baklawa B2B ERP

- Fonts: Playfair Display (display), Montserrat (body), Inter (UI/numbers/labels), Bantayog (fine print)
- Palette: #f3f5f9 bg, #ffffff cards, #1c1c1c foreground, #c6a769 primary (Champagne Gold)
- Admin theme: light (bg-background, white cards, border-border) — NOT dark
- 9 Packs = 1 Carton (global rule). Always show "Total Packs: X | Total Cartons: Y"
- Category C MOQ: 9 packs/carton, min 3 per variant, valid combos: 3+3+3, 6+3, 4+5, 9
- 50% advance required for production
- Company: TCF Chocolates & Gifts Private Limited
- Splash shows for 3 seconds, routes by role: admin→/admin, buyer→/, unauth→/login
- Logout button is inside avatar dropdown only (TopNavBar)
- Finance uses dynamic action dropdown (request advance, mark advance paid, request balance, mark fully paid)
- Register writes to b2b_applications table directly
- Logo sizing: Splash 145-220px, Login h-10/h-12, Navbar h-8/h-9, Admin sidebar h-7
