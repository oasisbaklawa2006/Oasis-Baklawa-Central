# Website cutover — Wix SEO redirect inventory

Captured read-only from the live Wix SEO Redirects API on 2026-10-13.

## Authority

- Live domain: `https://www.oasisbaklawa.com/`
- Wix site ID: `880c7f4f-83ac-46aa-ac0c-5814cb68a3c8`
- Full machine-readable redirect graph: `docs/website/wix-seo-redirects-20261013.json`
- No Wix redirect was created, edited, or deleted during capture.

## Counts

- Total redirects: **147**
- Product-page redirects: **106**
- Non-product redirects: **41**
- PAGE_SLUG_RENAME redirects: **2**
- REDIRECTOR redirects: **145**

## Non-product historical paths

- `/questions` → `/faqs` (REDIRECTOR)
- `/copy-of-new-landing` → `/landingpage` (PAGE_SLUG_RENAME)
- `/you-are-invited-you-for-aahar-by-oasis-baklawa` → `/you-are-invited-to-join-aahar-by-oasis-baklawa` (REDIRECTOR)
- `/new-corporate` → `/corporate` (REDIRECTOR)
- `/blank-7` → `/the-team` (REDIRECTOR)
- `/copy-of-aboutus` → `/aboutoasis` (REDIRECTOR)
- `/loyalty` → `/loyalty-bonus` (REDIRECTOR)
- `/offers-scheme` → `/swiggy-zomato-online` (REDIRECTOR)
- `/copy-of-corporate-gifting` → `/new-corporate` (REDIRECTOR)
- `/blank` → `/home` (REDIRECTOR)
- `/weddings` → `/wedding-favours` (REDIRECTOR)
- `/copy-of-fusion-sweets` → `/turkish-delight` (REDIRECTOR)
- `/recipes` → `/weddinggifting` (REDIRECTOR)
- `/home` → `/` (REDIRECTOR)
- `/blank-6` → `/review` (REDIRECTOR)
- `/items` → `/everyday` (REDIRECTOR)
- `/quick-shop/{title}` → `/quick-shop` (REDIRECTOR)
- `/online-ordering` → `/online-order` (REDIRECTOR)
- `/blank-3` → `/customer-care` (REDIRECTOR)
- `/all-products` → `/day-to-day-gifting` (REDIRECTOR)
- `/gifting` → `/luxurygifting` (REDIRECTOR)
- `/about-3` → `/festival-gifting` (REDIRECTOR)
- `/refer-friends` → `/refer-friend` (REDIRECTOR)
- `/services-5` → `/business-services` (REDIRECTOR)
- `/weddinggifting` → `/wedding-gifting` (REDIRECTOR)
- `/locateus` → `/contactus` (REDIRECTOR)
- `/blank-5` → `/locateus` (REDIRECTOR)
- `/projects-7-1` → `/shop` (REDIRECTOR)
- `/blank-1` → `/questions` (REDIRECTOR)
- `/services` → `/corporategifting` (REDIRECTOR)
- `/recipes-1` → `/festivalgifting` (REDIRECTOR)
- `/turkish-baklava` → `/premium-baklawa` (REDIRECTOR)
- `/portfolio` → `/speciality-catering` (REDIRECTOR)
- `/coming-soon-01` → `/catelogs` (PAGE_SLUG_RENAME)
- `/copy-of-contact-us` → `/locateus` (REDIRECTOR)
- `/corporates` → `/corporategifting` (REDIRECTOR)
- `/you-are-invited-to-join-aahar-by-oasis-baklawa` → `/businessenquiry` (REDIRECTOR)
- `/everyday` → `/all-products` (REDIRECTOR)
- `/refer-terms-conditions` → `/refer-friend-conditions` (REDIRECTOR)
- `/blank-4` → `/aboutoasisbaklawa` (REDIRECTOR)
- `/aahar` → `/projects-7-1` (REDIRECTOR)

## Cutover invariants

1. Preserve every still-relevant historical `from` path.
2. Replacement rules should point directly to the final destination; do not intentionally build redirect chains.
3. Never redirect a retired product to an unrelated product merely to suppress a 404.
4. Resolve the 106 product-page redirects against the owner-approved launch assortment.
5. Validate no loops, no redirect-to-404, no redirect that masks a real route, and no canonical mismatch before DNS cutover.
6. Do not mutate the current Wix redirect graph until the replacement redirect set has passed validation.

## Remaining SEO evidence before launch

- final static-page route inventory
- approved-product route map
- replacement 301 manifest
- canonical/sitemap/robots/llms verification on the production hostname
- Search Console ownership and post-cutover crawl validation


## Dynamic route inventory captured

- **439 / 439** visible Wix Store products have been captured with their Wix product ID, name, slug and live `/product-page/...` path in `docs/website/wix-product-routes-20261013.json`.
- **35 / 35** published Wix Blog posts have been captured with their ID, title, slug, URL and publish timestamps in `docs/website/wix-blog-routes-20261013.json`.
- Wix's Google Search Console `List Sitemaps` endpoint currently returned **no submitted sitemap records** for this site. This does not prove that Google has never crawled the site; it means there is no sitemap submission record available through that connected Wix GSC endpoint at capture time.

## Static-page inventory limitation

Wix's documented sitemap-page API explicitly excludes classic Wix Editor static/main pages. The live site is a classic Wix Editor site, so the static-page route inventory cannot be certified from that API alone. Historical static routes are nevertheless preserved through the 41 non-product redirects above. Final static-page mapping still requires either the published site's generated sitemap/crawl output or an equivalent authoritative Wix page export before production DNS cutover.
