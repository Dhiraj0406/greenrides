# Used Cars Marketplace — Phase 6 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A public used-car marketplace where anyone can submit a listing (admin approves before it goes live), buyers submit in-app inquiries, and the admin brokers the connection — with a remote-config flag gating the homepage entry point.

**Architecture:** Two new Prisma models (`CarListing`, `CarInquiry`). Photos stored in a Supabase Storage public bucket; the API route handles uploads server-side using the service role. All public read/write endpoints require no auth. Admin endpoints use the existing `x-admin-token` pattern. A new remote config flag `used_cars.module_enabled` gates the homepage banner.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Supabase Storage (service-role client), Zod validation, existing Bearer/admin-token auth pattern.

---

## 1. Data Layer

### Prisma Models

Add to `prisma/schema.prisma`:

```prisma
model CarListing {
  id           String      @id @default(uuid())
  make         String
  model        String
  year         Int
  price_paise  BigInt
  mileage_km   Int?
  fuel_type    String      // PETROL | DIESEL | CNG | ELECTRIC | HYBRID
  transmission String      // MANUAL | AUTOMATIC
  location     String
  description  String?
  seller_name  String
  seller_phone String
  status       String      @default("PENDING")  // PENDING | APPROVED | REJECTED | SOLD
  photos       String[]
  created_at   DateTime    @default(now())
  updated_at   DateTime    @default(now()) @updatedAt

  inquiries    CarInquiry[]

  @@index([status])
  @@index([make])
}

model CarInquiry {
  id          String     @id @default(uuid())
  listing_id  String
  buyer_name  String
  buyer_phone String
  message     String?
  created_at  DateTime   @default(now())

  listing     CarListing @relation(fields: [listing_id], references: [id], onDelete: Cascade)

  @@index([listing_id])
}
```

`price_paise` stores price in paise (consistent with `fare_paise` throughout the codebase). E.g. ₹3,50,000 = 35,000,000 paise.

> **BigInt serialization:** Prisma's `BigInt` type maps to a JavaScript `bigint`, which `JSON.stringify` cannot serialize. Every API route that returns a `CarListing` row must convert `price_paise` to a string before sending the response: `{ ...listing, price_paise: listing.price_paise.toString() }`. The client receives a string and parses it as needed (e.g. `BigInt(price_paise)` or format as rupees).

### Migration File

`supabase/migrations/010_car_listings.sql`

```sql
-- CarListing
CREATE TABLE IF NOT EXISTS "CarListing" (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  make         TEXT        NOT NULL,
  model        TEXT        NOT NULL,
  year         INT         NOT NULL,
  price_paise  BIGINT      NOT NULL,
  mileage_km   INT,
  fuel_type    TEXT        NOT NULL,
  transmission TEXT        NOT NULL,
  location     TEXT        NOT NULL,
  description  TEXT,
  seller_name  TEXT        NOT NULL,
  seller_phone TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'PENDING',
  photos       TEXT[]      NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_listing_status ON "CarListing"(status);
CREATE INDEX IF NOT EXISTS idx_car_listing_make   ON "CarListing"(make);

ALTER TABLE "CarListing" ENABLE ROW LEVEL SECURITY;

-- Public can read APPROVED and SOLD listings
CREATE POLICY "car_listing_public_read" ON "CarListing"
  FOR SELECT
  USING (status IN ('APPROVED', 'SOLD'));

-- Anyone can submit a new listing (goes to PENDING)
CREATE POLICY "car_listing_public_insert" ON "CarListing"
  FOR INSERT
  WITH CHECK (status = 'PENDING');

-- CarInquiry
CREATE TABLE IF NOT EXISTS "CarInquiry" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID        NOT NULL REFERENCES "CarListing"(id) ON DELETE CASCADE,
  buyer_name  TEXT        NOT NULL,
  buyer_phone TEXT        NOT NULL,
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_inquiry_listing ON "CarInquiry"(listing_id);

ALTER TABLE "CarInquiry" ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an inquiry
CREATE POLICY "car_inquiry_public_insert" ON "CarInquiry"
  FOR INSERT
  WITH CHECK (true);

-- No public read (admin only via service role)
```

### Supabase Storage Bucket

Bucket name: `used-car-photos`
- Public read
- No direct client uploads — all writes go through the API route using the service role client

Run once in Supabase dashboard or via migration:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('used-car-photos', 'used-car-photos', true)
ON CONFLICT (id) DO NOTHING;
```

### Remote Config Flag

Insert seed row (in migration or via Supabase dashboard):
```sql
INSERT INTO "AppRemoteConfig" (key, module_scope, enabled, value_json)
VALUES ('used_cars.module_enabled', 'USED_CARS', false, '{}')
ON CONFLICT (key) DO NOTHING;
```

---

## 2. API Layer

### `POST /api/used-cars/listings`

**Auth:** None.

**Body:** `multipart/form-data`
```
make, model, year, price_paise, mileage_km?, fuel_type, transmission,
location, description?, seller_name, seller_phone
photos[]  — up to 6 image files, max 5 MB each
```

**Zod validation:**
```typescript
const schema = z.object({
  make:         z.string().min(1).max(60),
  model:        z.string().min(1).max(60),
  year:         z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  price_paise:  z.coerce.bigint().positive(),
  mileage_km:   z.coerce.number().int().positive().optional(),
  fuel_type:    z.enum(["PETROL", "DIESEL", "CNG", "ELECTRIC", "HYBRID"]),
  transmission: z.enum(["MANUAL", "AUTOMATIC"]),
  location:     z.string().min(1).max(100),
  description:  z.string().max(1000).optional(),
  seller_name:  z.string().min(1).max(100),
  seller_phone: z.string().regex(/^\+?[0-9]{10,15}$/),
});
```

**Logic:**
1. Parse and validate text fields.
2. For each uploaded file: validate size ≤ 5 MB, MIME type is `image/*`. Reject entire request if any file fails.
3. Upload all photos to `used-car-photos/{uuid}/{filename}` using `getAdminClient().storage`. Collect public URLs.
4. Create `CarListing` row via Prisma with `status: "PENDING"` and `photos: [urls]`.
5. Return `{ id, ok: true }`.

If any storage upload fails, return 500 — no partial listing is created.

---

### `GET /api/used-cars/listings`

**Auth:** None.

**Query params:**
- `page` (default 1), `limit` (default 12, max 48)
- `make` (optional, case-insensitive filter)
- `fuel_type` (optional)
- `min_price` (paise), `max_price` (paise)

**Logic:** Prisma `findMany` where `status = "APPROVED"`, applying filters, ordered by `created_at DESC`. Returns `{ data: [...], total, page }`.

---

### `GET /api/used-cars/listings/[id]`

**Auth:** None.

**Logic:** Prisma `findUnique` where `id = params.id`. Returns 404 if not found or if `status === "PENDING" || status === "REJECTED"`. SOLD listings are returned with a `status: "SOLD"` field (still visible to show sold inventory).

---

### `POST /api/used-cars/listings/[id]/inquire`

**Auth:** None.

**Body:**
```json
{ "buyer_name": "...", "buyer_phone": "...", "message": "..." }
```

**Zod validation:**
```typescript
const schema = z.object({
  buyer_name:  z.string().min(1).max(100),
  buyer_phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  message:     z.string().max(500).optional(),
});
```

**Logic:**
1. Confirm listing exists with `status = "APPROVED"` (reject if PENDING/REJECTED/SOLD).
2. Create `CarInquiry` row.
3. Return `{ ok: true }`.

---

### `GET /api/admin/used-cars`

**Auth:** `x-admin-token`.

**Query params:** `?status=PENDING|APPROVED|REJECTED|SOLD` (optional).

**Logic:** Prisma `findMany` with optional status filter + `_count: { select: { inquiries: true } }`. Returns listings with `inquiry_count` appended. Ordered by `created_at DESC`.

---

### `PATCH /api/admin/used-cars/[id]`

**Auth:** `x-admin-token`.

**Body:**
```json
{ "status": "APPROVED" | "REJECTED" | "SOLD" }
```

**Logic:** Prisma `update`. Returns updated listing or 404.

---

### `GET /api/admin/used-cars/[id]/inquiries`

**Auth:** `x-admin-token`.

**Logic:** Prisma `findMany` on `CarInquiry` where `listing_id = params.id`, ordered by `created_at DESC`. Returns `{ data: [...] }`.

---

## 3. UI — Public Pages

### `/used-cars` — Listing Grid

**File:** `src/app/used-cars/page.tsx` (`"use client"`)

Layout:
- Header: "Used Cars" title + "Sell your car →" link to `/used-cars/sell`
- Filter bar: Make (text input or select), Fuel type (pill buttons), Price range (two number inputs)
- Listing grid: 2 columns on mobile. Each card: primary photo (aspect-ratio 4:3, `object-cover`), make/model/year, formatted price (₹X,XX,XXX), location chip, mileage chip (if present), fuel type chip. Tapping card → `/used-cars/[id]`.
- "Load more" button (not infinite scroll — simpler, no IntersectionObserver complexity)
- SOLD listings show a "SOLD" overlay on the photo

---

### `/used-cars/[id]` — Listing Detail

**File:** `src/app/used-cars/[id]/page.tsx` (`"use client"`)

Layout:
- Photo carousel: horizontal scroll with dot indicators (CSS snap scroll, no external library)
- Specs grid: Year · Mileage · Fuel · Transmission · Location
- Price (prominent, forest color)
- Description (if present)
- "I'm Interested" button → expands an inline inquiry form (buyer_name, buyer_phone, message optional) → on submit shows success state: "We'll connect you with the seller soon"
- SOLD listings show a "This car has been sold" banner; inquiry form hidden

---

### `/used-cars/sell` — Listing Submission Form

**File:** `src/app/used-cars/sell/page.tsx` (`"use client"`)

Three-step form managed with local state (no URL-based step routing):

- **Step 1 — Vehicle details:** Make, Model, Year (number input, 1990–current), Mileage (km, optional), Fuel type (pill select), Transmission (pill select)
- **Step 2 — Price & location:** Price (₹ formatted input, converted to paise on submit), Location (text), Description (textarea, optional), Seller name, Seller phone
- **Step 3 — Photos:** File input accepting `image/*`, up to 6 files, 5 MB each. Shows thumbnail previews. "Remove" button per photo.

On submit: POST `multipart/form-data` to `/api/used-cars/listings`. On success: full-screen confirmation — "Your listing is under review. We'll publish it within 24 hours."

Progress stepper shown at top (Step 1 / 2 / 3).

---

## 4. UI — Admin Pages

### `/admin/used-cars` — Listings Management

**File:** `src/app/(admin)/admin/used-cars/page.tsx`

- Status tabs: PENDING · APPROVED · REJECTED · SOLD (pill tabs, default = PENDING)
- Table rows: thumbnail (40×40, rounded), make/model/year, price, seller name, submitted date, inquiry count badge
- Actions on PENDING rows: "Approve" (green button) + "Reject" (red outline button) — inline optimistic update
- Tapping a row → `/admin/used-cars/[id]`
- Follows existing `AdminGate` + `x-admin-token` pattern

---

### `/admin/used-cars/[id]` — Listing + Inquiries

**File:** `src/app/(admin)/admin/used-cars/[id]/page.tsx`

- Full listing detail (all fields + photos)
- Status badge with inline status-change select (APPROVED / REJECTED / SOLD)
- "Inquiries" section: each inquiry shows buyer name, phone (copyable), message, timestamp
- Back to listings link

---

## 5. Homepage Integration

**File:** `src/app/page.tsx`

Add a "Services" section below the existing `<CustomRouteBox />` component:

```tsx
{usedCarsEnabled && (
  <div className="px-4 mt-4">
    <p className="text-xs font-semibold text-sub uppercase tracking-wider mb-2">More Services</p>
    <Link href="/used-cars"
      className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
      <div className="flex items-center gap-3">
        <Car className="w-5 h-5 text-leaf" />
        <div>
          <p className="text-sm font-semibold text-text">Used Cars</p>
          <p className="text-xs text-sub">Buy or sell a car in Odisha</p>
        </div>
      </div>
      <span className="text-sub text-sm">→</span>
    </Link>
  </div>
)}
```

`usedCarsEnabled` is fetched server-side from `getFlag("used_cars.module_enabled", false)`. Since `page.tsx` is a server component (`export const dynamic = "force-dynamic"`), this is a direct `await getFlag(...)` call — no client fetch needed.

`Car` icon imported from `lucide-react`.

---

## 6. Admin Dashboard Integration

**File:** `src/app/(admin)/admin/page.tsx`

Add "Used Cars" link to the nav section (after "KYC Documents"):

```tsx
<Link href="/admin/used-cars"
  className="flex items-center justify-between bg-white border border-border rounded-2xl px-4 py-4 hover:border-leaf/50 transition-colors">
  <div className="flex items-center gap-3">
    <Car className="w-5 h-5 text-leaf" />
    <span className="text-sm font-semibold text-text">Used Cars</span>
  </div>
  <span className="text-sub text-sm">→</span>
</Link>
```

---

## 7. Error Handling

| Scenario | Handling |
|---|---|
| Photo upload fails (storage error) | 500 returned; no listing row created. Client shows "Upload failed — please try again." |
| Photo too large (> 5 MB) | 400 with `{ error: "Photo exceeds 5 MB limit" }` |
| Too many photos (> 6) | 400 with `{ error: "Maximum 6 photos allowed" }` |
| Inquiry on non-APPROVED listing | 403 — listing must be APPROVED to accept inquiries |
| Admin PATCH non-existent listing | 404 |
| `used_cars.module_enabled = false` | Homepage banner not rendered. `/used-cars/*` routes still accessible via direct URL. |
| Listing with no photos | `photos: []` — detail page shows a grey placeholder instead of carousel |

---

## 8. Testing

- POST `/api/used-cars/listings` with valid multipart data → 200, status PENDING, photos in bucket
- POST with oversized photo → 400
- GET `/api/used-cars/listings` → only APPROVED listings returned (not PENDING/REJECTED)
- Admin PATCH to APPROVED → listing now appears in public GET
- Admin PATCH to REJECTED → listing returns 404 on public GET `[id]`
- POST `/api/used-cars/listings/[id]/inquire` → CarInquiry row created
- POST inquire on PENDING listing → 403
- GET `/api/admin/used-cars/[id]/inquiries` → returns all inquiries for that listing
- `used_cars.module_enabled = false` → no homepage banner rendered
- `used_cars.module_enabled = true` → homepage banner visible
- No regression on existing booking, driver, fleet, or admin flows
