

## "Imperial Luxury" Product UI Redesign

Two components to restyle: the **ProductCard** (catalogue grid) and **ProductDetail** (full page). No backend changes needed — purely visual, using existing data fields.

### Design Tokens (applied via Tailwind arbitrary values)
- Background: `bg-[#F9F8F3]`
- Border: `border-[1.5px] border-[#C4A052]`
- Text: `text-[#4A3623]`
- Veg badge: `bg-[#2E7D32]`
- Border radius: `rounded-[24px]` for cards, `rounded-full` for pills
- Font: thin sans-serif (Montserrat via existing config)

---

### File 1: `src/pages/Catalogue.tsx` — ProductCard component (lines 452-511)

Restyle the `ProductCard` to match the reference image:
- Container: `bg-[#F9F8F3] border-[1.5px] border-[#C4A052] rounded-[24px] p-5`
- Image area: square aspect ratio, clean white background, product image centered
- Veg badge: small green square (`bg-[#2E7D32]`) in top-right of image area
- Carousel dots: 3 dots below image (1 gold `bg-[#C4A052]`, 2 light gray)
- Title: uppercase, thin weight, `text-[#4A3623]`
- Subtitle: category name below title, smaller
- B2B details: "Pack Size : {pack_size}" and "Pack Price : ₹{packPrice}/-" in bold brown
- Main price: large `₹ {perKg}/ Per kg` with "Taxes & Transportation Extra" in tiny text
- Cart button: circular `bg-[#4A3623]` with white ShoppingCart icon, bottom-right

### File 2: `src/pages/ProductDetail.tsx` — Full page redesign (lines 126-396)

Restructure to match the long design reference:

**Hero image section:**
- White/cream background, large product image, centered carousel dots below (gold + gray)
- Veg badge top-right corner (green square)
- Remove the maximize button and prev/next nav bar

**Gold title banner:**
- Full-width `bg-[#C4A052]` banner with product name in uppercase `text-[#4A3623]` and category below

**Description block:**
- Cream background, centered italic text in `text-[#4A3623]`

**Pricing block (cream bg):**
- Strikethrough MRP line: `MRP : {mrp}/- PER KG` with line-through
- Large selling price: `₹ {price} Per kg` in bold
- B2B calculation row: `Pack Price ₹{perKg}/kg x {weightKg} kg = ₹{packPrice}/-`
- Small "Taxes & Transportation Extra" note

**Cross-sell section:**
- "You may also like:" heading
- Horizontal scroll of mini ProductCards (same Imperial style as Component 1)

**Spec table:**
- 6 rows, alternating gold (`bg-[#C4A052] text-white`) and cream (`bg-[#F9F8F3]`) backgrounds
- Labels left, values right, all in `text-[#4A3623]`

**Sticky bottom bar:**
- Fixed at bottom, cream/gold background
- Left: "Total Price including GST@{rate}%" with large `₹ {total}` 
- Center: gold pill quantity selector (`bg-[#C4A052]`) with +/- buttons in dark brown circles
- Right: "Add to Cart" gold pill button with cart icon

### File 3: `src/components/ProductRecommendations.tsx`

Restyle mini recommendation cards to match the Imperial card style:
- `bg-[#F9F8F3] border-[1.5px] border-[#C4A052] rounded-[24px]`
- Product name uppercase, price in gold, small cart icon button
- Add B2B details (pack size, pack price) in tiny text
- "Taxes & Transportation Extra" note

### Technical Notes
- All pricing logic (`calculatePackPrice`, `getDisplayPrice`, etc.) stays unchanged
- Auth gating for prices remains
- Carton fill logic moves to subtle helper text (not a progress bar)
- The bottom bar uses `fixed bottom-0` with safe area for mobile nav bar clearance

