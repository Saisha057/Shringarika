-- =====================================================
-- PRODUCT REVIEWS & RATINGS SCHEMA
-- =====================================================

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  comment TEXT,
  
  -- Verified purchase badge
  is_verified_purchase BOOLEAN DEFAULT false,
  
  -- Moderation
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMP WITH TIME ZONE,
  
  -- Helpful votes
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  
  -- Media attachments
  images JSONB DEFAULT '[]',
  
  -- Response from seller/admin
  seller_response TEXT,
  seller_response_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one review per user per product
  CONSTRAINT unique_user_product_review UNIQUE (user_id, product_id)
);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  vote VARCHAR(20) NOT NULL CHECK (vote IN ('helpful', 'not_helpful')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One vote per user per review
  CONSTRAINT unique_user_review_vote UNIQUE (review_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id ON review_votes(user_id);

-- Function to update product average rating
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
      FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND status = 'approved'
    ),
    review_count = (
      SELECT COUNT(*)
      FROM reviews
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND status = 'approved'
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update product ratings
DROP TRIGGER IF EXISTS trigger_update_product_rating ON reviews;
CREATE TRIGGER trigger_update_product_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_product_rating();

-- Function to update helpful counts
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE reviews
    SET 
      helpful_count = (
        SELECT COUNT(*)
        FROM review_votes
        WHERE review_id = NEW.review_id AND vote = 'helpful'
      ),
      not_helpful_count = (
        SELECT COUNT(*)
        FROM review_votes
        WHERE review_id = NEW.review_id AND vote = 'not_helpful'
      ),
      updated_at = NOW()
    WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews
    SET 
      helpful_count = (
        SELECT COUNT(*)
        FROM review_votes
        WHERE review_id = OLD.review_id AND vote = 'helpful'
      ),
      not_helpful_count = (
        SELECT COUNT(*)
        FROM review_votes
        WHERE review_id = OLD.review_id AND vote = 'not_helpful'
      ),
      updated_at = NOW()
    WHERE id = OLD.review_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update helpful counts
DROP TRIGGER IF EXISTS trigger_update_review_helpful_count ON review_votes;
CREATE TRIGGER trigger_update_review_helpful_count
AFTER INSERT OR UPDATE OR DELETE ON review_votes
FOR EACH ROW
EXECUTE FUNCTION update_review_helpful_count();

-- Add rating columns to products table if not exists
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Create index on average_rating for sorting
CREATE INDEX IF NOT EXISTS idx_products_average_rating ON products(average_rating DESC);

-- Sample review data for testing (optional)
-- INSERT INTO reviews (product_id, user_id, rating, title, comment, status, is_verified_purchase)
-- VALUES 
--   ('product-uuid-1', 'user-uuid-1', 5, 'Excellent quality!', 'Loved the fabric and fit. Highly recommended!', 'approved', true),
--   ('product-uuid-1', 'user-uuid-2', 4, 'Good product', 'Nice design but slightly expensive.', 'approved', true),
--   ('product-uuid-2', 'user-uuid-3', 5, 'Best purchase', 'Amazing quality for the price.', 'approved', false);

-- Row Level Security (RLS) Policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view approved reviews
CREATE POLICY "Anyone can view approved reviews"
  ON reviews FOR SELECT
  USING (status = 'approved' OR user_id = auth.uid());

-- Policy: Users can create reviews for their own orders
CREATE POLICY "Users can create their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (user_id = auth.uid());

-- Policy: Admins can view all reviews
CREATE POLICY "Admins can view all reviews"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Admins can moderate reviews
CREATE POLICY "Admins can moderate reviews"
  ON reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Policy: Users can vote on reviews
CREATE POLICY "Users can vote on reviews"
  ON review_votes FOR ALL
  USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON review_votes TO authenticated;
GRANT ALL ON reviews TO service_role;
GRANT ALL ON review_votes TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Product reviews schema created successfully!';
  RAISE NOTICE '📊 Tables: reviews, review_votes';
  RAISE NOTICE '🔧 Triggers: Auto-update product ratings and helpful counts';
  RAISE NOTICE '🔒 RLS policies enabled for data security';
END $$;
