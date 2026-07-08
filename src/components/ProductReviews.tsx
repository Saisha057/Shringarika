import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { authAPI } from '../services/api';
import API from '../lib/api';

interface Review {
  id: number;
  rating: number;
  comment: string;
  user: {
    name: string;
  };
  created_at: string;
}

interface ProductReviewsProps {
  productId: string | number;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(authAPI.isAuthenticated());
    loadReviews();
  }, [productId]);

  const loadReviews = async () => {
    try {
      const response = await API.get(`/reviews/product/${productId}`);
      setReviews(response.data.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const submitReview = async () => {
    if (!comment.trim()) {
      alert('Please write a review comment');
      return;
    }

    if (!isAuthenticated) {
      alert('Please login to submit a review');
      return;
    }

    setIsSubmitting(true);
    try {
      await API.post(
        '/reviews',
        { productId, rating, comment },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );
      
      alert('Review submitted successfully!');
      loadReviews();
      setRating(5);
      setComment('');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, readOnly = false }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !readOnly && onChange && onChange(star)}
            className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
            disabled={readOnly}
          >
            <Star
              className={`w-5 h-5 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            />
          </button>
        ))}
      </div>
    );
  };

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="mt-12 border-t pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold">Customer Reviews</h3>
          <div className="flex items-center gap-2 mt-1">
            <StarRating value={Number(averageRating)} readOnly />
            <span className="text-sm text-gray-600">
              {averageRating} out of 5 ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {isAuthenticated ? (
        <div className="mb-8 p-6 bg-neutral-50 rounded-lg">
          <h4 className="font-semibold mb-3">Write a Review</h4>
          <div className="mb-3">
            <label className="block text-sm mb-1">Rating</label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="mb-3">
            <label className="block text-sm mb-1">Your Review</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
              placeholder="Share your experience with this product..."
              rows={4}
            />
          </div>
          <button
            onClick={submitReview}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded-full text-sm tracking-wider transition-colors ${
              isSubmitting
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-black text-white hover:bg-neutral-800'
            }`}
          >
            {isSubmitting ? 'SUBMITTING...' : 'SUBMIT REVIEW'}
          </button>
        </div>
      ) : (
        <div className="mb-8 p-6 bg-neutral-50 rounded-lg text-center">
          <p className="text-gray-600">Please login to write a review</p>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No reviews yet. Be the first to review!</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="pb-6 border-b border-gray-200 last:border-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{review.user?.name || 'Anonymous'}</span>
                    <span className="text-sm text-gray-500">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'Recently'}
                    </span>
                  </div>
                  <StarRating value={review.rating} readOnly />
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed">{review.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
