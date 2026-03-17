// Integration Example: Adding ProductVariantsPanel to AdminDashboard
// Location: src/components/AdminDashboard.tsx or similar admin products page

import React, { useState } from 'react';
import { ProductVariantsPanel } from './ProductVariantsPanel';
import { Package } from 'lucide-react';

// Example: In your products list or product detail page
function AdminProductsPage() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showVariantsPanel, setShowVariantsPanel] = useState(false);

  const handleManageVariants = (productId: string) => {
    setSelectedProductId(productId);
    setShowVariantsPanel(true);
  };

  return (
    <div>
      {/* Your existing products table */}
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>₹{product.price}</td>
              <td>
                <button
                  onClick={() => handleManageVariants(product.id)}
                  className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
                >
                  <Package size={16} />
                  Manage Variants
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Variants Panel Modal/Overlay */}
      {showVariantsPanel && selectedProductId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-7xl max-h-[90vh] overflow-auto">
            <ProductVariantsPanel
              productId={selectedProductId}
              onClose={() => setShowVariantsPanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminProductsPage;

/* 
ALTERNATIVE INTEGRATION: As a separate route
Add to your router:

import { ProductVariantsPanel } from './components/ProductVariantsPanel';

<Route 
  path="/admin/products/:productId/variants" 
  element={<ProductVariantsPanel productId={useParams().productId} />} 
/>

Then link to it from products page:
<Link to={`/admin/products/${product.id}/variants`}>Manage Variants</Link>
*/

/*
TESTING THE INTEGRATION:

1. Ensure backend server is running on http://localhost:5000
2. Ensure you have admin token in localStorage (key: 'token')
3. Navigate to admin products page
4. Click "Manage Variants" on any product
5. Test features:
   ✅ View existing variants
   ✅ Auto-generate new variants
   ✅ Edit individual variant (change stock, color, size)
   ✅ Click Save button
   ✅ Verify low stock alerts appear when stock < 5
   ✅ Test restock functionality
   ✅ Delete a variant
6. Place a test order with the product
7. Verify stock decreases in real-time
*/
