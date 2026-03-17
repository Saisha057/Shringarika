-- ============================================
-- FINAL DATABASE SCHEMA FOR SHRINGARIKA E-COMMERCE
-- Aligned with project entity names and structure
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table (not customers)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_verified BOOLEAN DEFAULT false,
    reset_password_token VARCHAR(255),
    reset_password_expire TIMESTAMP,
    refresh_token TEXT,
    settings JSONB DEFAULT '{"emailNotifications": true, "smsNotifications": false, "orderUpdates": true, "promotions": true, "darkMode": false, "language": "en", "currency": "USD"}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Addresses table (one user can have multiple)
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'India',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products table (clothing items)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    discount_price DECIMAL(10, 2),
    images TEXT[] DEFAULT '{}',
    colors TEXT[] DEFAULT '{}',
    is_featured BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    rating DECIMAL(3, 2) DEFAULT 0.0,
    num_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Product inventory (size-based stock management)
CREATE TABLE IF NOT EXISTS product_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(10) NOT NULL, -- S, M, L, XL
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, size)
);

-- 5. Product variants (optional - for size/color combos with different prices/SKUs)
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(10), -- S, M, L, XL
    color VARCHAR(50),
    price DECIMAL(10, 2), -- can override base price
    stock INTEGER DEFAULT 0,
    sku VARCHAR(100) UNIQUE, -- unique identifier like TSHIRT-BLUE-M
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, size, color)
);

-- 6. Orders master table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL, -- ORD-001, ORD-002
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    shipping_address_id UUID REFERENCES addresses(id),
    guest_uuid UUID, -- for guest checkout
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    order_items JSONB NOT NULL, -- Array of order items with product details
    shipping_address JSONB NOT NULL,
    contact_details JSONB,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Refunded', 'Failed')),
    order_status VARCHAR(50) DEFAULT 'Pending', -- Alias for status
    subtotal DECIMAL(10, 2) NOT NULL,
    items_price DECIMAL(10, 2) NOT NULL, -- Alias for subtotal
    tax DECIMAL(10, 2) DEFAULT 0,
    tax_price DECIMAL(10, 2) DEFAULT 0, -- Alias for tax
    shipping_charge DECIMAL(10, 2) DEFAULT 0,
    shipping_price DECIMAL(10, 2) DEFAULT 0, -- Alias for shipping_charge
    delivery_charge DECIMAL(10, 2) DEFAULT 0, -- Alias for shipping_charge
    discount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL, -- Alias for total_amount
    currency VARCHAR(10) DEFAULT '₹',
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
    payment_method VARCHAR(50), -- UPI, card, COD
    payment_result JSONB,
    payment_txn_id VARCHAR(100),
    is_paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMP,
    is_delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMP,
    actual_delivery_date DATE,
    estimated_delivery_date DATE,
    tracking_number VARCHAR(100),
    courier_name VARCHAR(100),
    delivery_notes TEXT,
    notes TEXT, -- admin notes
    status_history JSONB DEFAULT '[]'::jsonb, -- Array of status changes with timestamps
    cancellation_reason TEXT,
    refund_amount DECIMAL(10, 2),
    refund_status VARCHAR(50),
    refunded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Order items table (normalized version - optional, as order_items is also stored as JSONB in orders)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    product_variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    size VARCHAR(10),
    color VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Payments table (one order can have multiple payment attempts)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) NOT NULL,
    provider VARCHAR(50), -- Razorpay, Paytm, etc.
    txn_id VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    payment_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Order status history (tracks status changes)
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100), -- admin email or 'system'
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Alias for created_at
);

-- 10. Reviews table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Wishlist table
CREATE TABLE IF NOT EXISTS wishlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_txn_id ON payments(txn_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
CREATE TRIGGER update_addresses_updated_at 
    BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_inventory_updated_at ON product_inventory;
CREATE TRIGGER update_product_inventory_updated_at 
    BEFORE UPDATE ON product_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at 
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION TO GENERATE ORDER NUMBER
-- ============================================

-- Drop existing function if it exists (to handle return type changes)
-- CASCADE will also drop any triggers that depend on this function
DROP FUNCTION IF EXISTS generate_order_number() CASCADE;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_order_number TEXT;
    date_part TEXT;
    seq_part TEXT;
BEGIN
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO seq_part
    FROM orders
    WHERE order_number LIKE 'ORD-' || date_part || '-%';
    
    new_order_number := 'ORD-' || date_part || '-' || LPAD(seq_part::TEXT, 4, '0');
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE users IS 'User accounts for the e-commerce platform';
COMMENT ON TABLE addresses IS 'Shipping addresses for users';
COMMENT ON TABLE products IS 'Product catalog items';
COMMENT ON TABLE product_inventory IS 'Size-based inventory tracking for products';
COMMENT ON TABLE product_variants IS 'Product variants with size/color combinations and SKUs';
COMMENT ON TABLE orders IS 'Order master table with complete order information';
COMMENT ON TABLE order_items IS 'Normalized order line items (optional, as items are also stored as JSONB in orders)';
COMMENT ON TABLE payments IS 'Payment transaction records for orders';
COMMENT ON TABLE order_status_history IS 'Audit trail of order status changes';
COMMENT ON TABLE reviews IS 'Product reviews and ratings';
COMMENT ON TABLE wishlist IS 'User wishlist items';

-- ============================================
-- EXAMPLE QUERIES
-- ============================================

-- Query: Orders with Customer Information (handles both registered users and guest orders)
-- SELECT 
--     o.id, 
--     o.order_number, 
--     o.total_amount, 
--     o.status, 
--     o.created_at,
--     COALESCE(u.name, o.customer_name) as customer_name,
--     COALESCE(u.phone, o.customer_phone) as customer_phone,
--     u.email as customer_email,
--     COUNT(oi.id) as item_count
-- FROM orders o
-- LEFT JOIN users u ON o.user_id = u.id
-- LEFT JOIN order_items oi ON o.id = oi.order_id
-- GROUP BY o.id, o.order_number, o.total_amount, o.status, o.created_at, 
--          u.name, u.phone, u.email, o.customer_name, o.customer_phone
-- ORDER BY o.created_at DESC;

-- Query: Orders with Customer Information (registered users only)
-- SELECT 
--     o.id, 
--     o.order_number, 
--     o.total_amount, 
--     o.status, 
--     o.created_at,
--     u.name as customer_name, 
--     u.phone,
--     u.email as customer_email,
--     COUNT(oi.id) as item_count
-- FROM orders o
-- INNER JOIN users u ON o.user_id = u.id
-- LEFT JOIN order_items oi ON o.id = oi.order_id
-- GROUP BY o.id, o.order_number, o.total_amount, o.status, o.created_at, 
--          u.name, u.phone, u.email
-- ORDER BY o.created_at DESC;

-- Query: Using JSONB order_items (if not using normalized order_items table)
-- SELECT 
--     o.id, 
--     o.order_number, 
--     o.total_amount, 
--     o.status, 
--     o.created_at,
--     COALESCE(u.name, o.customer_name) as customer_name,
--     COALESCE(u.phone, o.customer_phone) as customer_phone,
--     u.email as customer_email,
--     jsonb_array_length(o.order_items) as item_count
-- FROM orders o
-- LEFT JOIN users u ON o.user_id = u.id
-- ORDER BY o.created_at DESC;

-- Query: Get complete order details with customer, address, and product information
-- SELECT 
--     o.*, 
--     COALESCE(u.name, o.customer_name) as name,
--     COALESCE(u.email, o.customer_email) as email,
--     COALESCE(u.phone, o.customer_phone) as phone,
--     a.address_line1, 
--     a.address_line2,
--     a.city, 
--     a.state,
--     a.postal_code,
--     a.country,
--     a.full_name as address_full_name,
--     a.phone as address_phone,
--     p.name as product_name, 
--     COALESCE(pv.size, oi.size) as size, 
--     COALESCE(pv.color, oi.color) as color,
--     oi.quantity, 
--     oi.unit_price,
--     oi.total_price as item_total_price
-- FROM orders o
-- LEFT JOIN users u ON o.user_id = u.id  -- LEFT JOIN for guest orders
-- LEFT JOIN addresses a ON o.shipping_address_id = a.id  -- LEFT JOIN as address might be in JSONB
-- LEFT JOIN order_items oi ON o.id = oi.order_id
-- LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id  -- LEFT JOIN as variant might not exist
-- LEFT JOIN products p ON COALESCE(pv.product_id, oi.product_id) = p.id
-- WHERE o.id = '00000000-0000-0000-0000-000000000000';  -- Replace with actual order UUID in application code

-- Query: Alternative - Get order details with JSONB shipping address extraction
-- SELECT 
--     o.*, 
--     COALESCE(u.name, o.customer_name) as name,
--     COALESCE(u.email, o.customer_email) as email,
--     COALESCE(u.phone, o.customer_phone) as phone,
--     -- Extract from JSONB shipping_address if address table not used
--     o.shipping_address->>'address_line1' as address_line1,
--     o.shipping_address->>'address_line2' as address_line2,
--     o.shipping_address->>'city' as city,
--     o.shipping_address->>'state' as state,
--     o.shipping_address->>'postal_code' as postal_code,
--     o.shipping_address->>'country' as country,
--     o.shipping_address->>'fullName' as address_full_name,
--     o.shipping_address->>'phone' as address_phone,
--     p.name as product_name, 
--     COALESCE(pv.size, oi.size) as size, 
--     COALESCE(pv.color, oi.color) as color,
--     oi.quantity, 
--     oi.unit_price,
--     oi.total_price as item_total_price
-- FROM orders o
-- LEFT JOIN users u ON o.user_id = u.id
-- LEFT JOIN order_items oi ON o.id = oi.order_id
-- LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
-- LEFT JOIN products p ON COALESCE(pv.product_id, oi.product_id) = p.id
-- WHERE o.id = '00000000-0000-0000-0000-000000000000';  -- Replace with actual order UUID in application code

-- ============================================
-- INDEX CREATION STATEMENTS (Updated)
-- ============================================

-- Updated index statements matching the project schema
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);  -- Changed from customer_id to user_id
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);  -- Changed from idx_orders_date
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);  -- Changed from idx_order_items_order

-- Note: These indexes are already included in the schema above, but these are the corrected versions
-- if you need to create them separately

