// Shared in-memory store for reviews.
// Both /api/reviews and /api/products/:id/reviews routes import from here
// so they operate on the same data set.
const reviews = new Map();
export default reviews;
