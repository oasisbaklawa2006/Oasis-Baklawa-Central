## Triad Split Architecture

### Current Problem
- RGS/FGS treated as separate entities when they're the same
- 3PCS items forced through FGS unnecessarily
- Assembly items leaking into PHH views

### Changes Required

**1. Department Classification Helper** (`src/utils/departmentClassifier.ts`)
- Create a utility that classifies each order_item into one of 3 flows:
  - **FLOW_FGS**: `production_department` in (Arabic Sweets, Bakery, Chocolate, Dragees, Fusion Sweets, Nuts & Mixes)
  - **FLOW_ASSEMBLY**: `production_department` in (Packing & Assembly, Assembly, Hampers, Gifts)
  - **FLOW_3PCS**: Everything else (external packaging, decorative boxes, non-food)

**2. Refactor StockCheckEngine.tsx** (Trigger Production)
- On "Trigger Production", classify each item into its flow
- FGS items → create `production_jobs` for respective HOD handhelds
- Assembly items → push to Assembly task cards (existing logic)
- 3PCS items → mark with department "3pcs" for separate tracking
- Set order status to "manufacturing"

**3. Dispatch Readiness Gate**
- Add logic: order moves to "packed_ready" ONLY when all 3 flows have completed
- Each flow independently marks its items as "completed"
- A check function verifies all items across all flows are done

**4. Clean PHH Engine** (OperationsController.tsx)
- Filter OUT assembly/3pcs items from food handhelds
- Ensure only food production_departments appear

**5. Clean Assembly Handheld** (AssemblyManagement.tsx)  
- Already scoped correctly, just verify no food items leak in

**6. No DB migration needed** - uses existing `department` and `production_status` fields on `order_items`
