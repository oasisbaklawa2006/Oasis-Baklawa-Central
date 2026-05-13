
UPDATE public.starter_packs
SET items = '[
  {"product_id":"9be863a4-954a-472b-8a8b-cbf7726c30be","quantity":3},
  {"product_id":"19a19dbb-313e-42a3-993c-de8f1500fdae","quantity":3},
  {"product_id":"7a023619-4bbe-41a3-8813-4ebacc3a6cab","quantity":3},
  {"product_id":"f5fdb689-4ecf-44da-9a5b-8eca6c1a40e8","quantity":3},
  {"product_id":"854c0dec-234a-4b5c-b670-75a2a98193b1","quantity":3},
  {"product_id":"5ceb34a3-4916-4f64-8c87-c4dc1d7fe1a0","quantity":3}
]'::jsonb
WHERE tier = 'basic';

UPDATE public.starter_packs
SET items = '[
  {"product_id":"9be863a4-954a-472b-8a8b-cbf7726c30be","quantity":3},
  {"product_id":"19a19dbb-313e-42a3-993c-de8f1500fdae","quantity":3},
  {"product_id":"7a023619-4bbe-41a3-8813-4ebacc3a6cab","quantity":3},
  {"product_id":"f5fdb689-4ecf-44da-9a5b-8eca6c1a40e8","quantity":3},
  {"product_id":"854c0dec-234a-4b5c-b670-75a2a98193b1","quantity":3},
  {"product_id":"5ceb34a3-4916-4f64-8c87-c4dc1d7fe1a0","quantity":3},
  {"product_id":"f1d80471-5f0e-4920-9330-e36e72ce69db","quantity":2},
  {"product_id":"78d860c8-68a8-4789-bcd2-b89d31b54b0b","quantity":2},
  {"product_id":"665efda0-1455-46d2-a6fa-a50de7deb7c8","quantity":2},
  {"product_id":"3716e6da-1cf9-4ed7-91ec-940db56ae8d9","quantity":2}
]'::jsonb
WHERE tier = 'smart';

UPDATE public.starter_packs
SET items = '[
  {"product_id":"9be863a4-954a-472b-8a8b-cbf7726c30be","quantity":3},
  {"product_id":"19a19dbb-313e-42a3-993c-de8f1500fdae","quantity":3},
  {"product_id":"7a023619-4bbe-41a3-8813-4ebacc3a6cab","quantity":3},
  {"product_id":"f5fdb689-4ecf-44da-9a5b-8eca6c1a40e8","quantity":3},
  {"product_id":"854c0dec-234a-4b5c-b670-75a2a98193b1","quantity":3},
  {"product_id":"5ceb34a3-4916-4f64-8c87-c4dc1d7fe1a0","quantity":3},
  {"product_id":"f1d80471-5f0e-4920-9330-e36e72ce69db","quantity":2},
  {"product_id":"78d860c8-68a8-4789-bcd2-b89d31b54b0b","quantity":2},
  {"product_id":"665efda0-1455-46d2-a6fa-a50de7deb7c8","quantity":2},
  {"product_id":"3716e6da-1cf9-4ed7-91ec-940db56ae8d9","quantity":2},
  {"product_id":"6df9db35-a74d-4c62-a783-ef0150dd5131","quantity":2},
  {"product_id":"61e002dc-993a-44ed-b129-0c9db9aa8513","quantity":2},
  {"product_id":"955a38e6-d5ea-43ba-91ee-ab808836c612","quantity":2},
  {"product_id":"8dac6c6d-95b2-4ac1-aaef-2f1b0abae854","quantity":2}
]'::jsonb
WHERE tier = 'premium';
