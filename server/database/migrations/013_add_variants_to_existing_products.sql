-- ================================================
-- PHASE 1.5: ADD MISSING VARIANTS TO EXISTING PRODUCTS
-- ================================================

-- This script adds default variants to the 4 existing products
-- that currently have NO variants

-- Step 1: Get list of products without variants
SELECT 
    p.id,
    p.name,
    (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variant_count
FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM product_variants WHERE product_id = p.id
);

-- Step 2: Add default variants to each product
-- Replace the UUIDs with actual product IDs from Step 1

-- For product: AROHI COLLECTION (bec196d0-4890-4763-a7bb-53ae5c6f7dad)
INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
VALUES 
    ('bec196d0-4890-4763-a7bb-53ae5c6f7dad', 'S', 'Red', 10, 'AROHI-COLLECTION-S-RED'),
    ('bec196d0-4890-4763-a7bb-53ae5c6f7dad', 'M', 'Red', 10, 'AROHI-COLLECTION-M-RED'),
    ('bec196d0-4890-4763-a7bb-53ae5c6f7dad', 'L', 'Red', 10, 'AROHI-COLLECTION-L-RED'),
    ('bec196d0-4890-4763-a7bb-53ae5c6f7dad', 'XL', 'Red', 10, 'AROHI-COLLECTION-XL-RED');

-- For product: JYOTSANA WINTER COLLECTION (92c060fb-9a21-42c5-b092-7cb3a102d464)
INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
VALUES 
    ('92c060fb-9a21-42c5-b092-7cb3a102d464', 'S', 'Blue', 10, 'JYOTSANA-WINTER-S-BLUE'),
    ('92c060fb-9a21-42c5-b092-7cb3a102d464', 'M', 'Blue', 10, 'JYOTSANA-WINTER-M-BLUE'),
    ('92c060fb-9a21-42c5-b092-7cb3a102d464', 'L', 'Blue', 10, 'JYOTSANA-WINTER-L-BLUE'),
    ('92c060fb-9a21-42c5-b092-7cb3a102d464', 'XL', 'Blue', 10, 'JYOTSANA-WINTER-XL-BLUE');

-- For product: SAREE (08f5018d-0cbd-4627-bbd6-39c74ba4ea6b)
INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
VALUES 
    ('08f5018d-0cbd-4627-bbd6-39c74ba4ea6b', 'Free Size', 'Multi', 15, 'SAREE-FREESIZE-MULTI');

-- For product: AROHI COLLECTION (c8fd27ae-3640-42c2-8188-3c2f8b8ad645)
INSERT INTO product_variants (product_id, size, color, stock_quantity, sku)
VALUES 
    ('c8fd27ae-3640-42c2-8188-3c2f8b8ad645', 'S', 'Pink', 10, 'AROHI-COLLECTION-2-S-PINK'),
    ('c8fd27ae-3640-42c2-8188-3c2f8b8ad645', 'M', 'Pink', 10, 'AROHI-COLLECTION-2-M-PINK'),
    ('c8fd27ae-3640-42c2-8188-3c2f8b8ad645', 'L', 'Pink', 10, 'AROHI-COLLECTION-2-L-PINK'),
    ('c8fd27ae-3640-42c2-8188-3c2f8b8ad645', 'XL', 'Pink', 10, 'AROHI-COLLECTION-2-XL-PINK');

-- Step 3: Verify all products now have variants
SELECT 
    p.id,
    p.name,
    COUNT(pv.id) as variant_count
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
GROUP BY p.id, p.name
ORDER BY p.name;

-- Expected result: All 4 products should have variants now

-- ================================================
-- IMPORTANT: Run this in Supabase SQL Editor
-- ================================================
