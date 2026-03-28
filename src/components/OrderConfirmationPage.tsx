import { CheckCircle, Package, Home, ShoppingBag, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';

interface OrderConfirmationPageProps {
  orderId: string;
  onNavigateHome: () => void;
  onContinueShopping: () => void;
}

interface OrderData {
  orderId: string;
  orderDate: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: Array<{
    name: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
    total: number;
    image?: string | null;
  }>;
  subtotal: string;
  deliveryCharge: string;
  total: string;
  paymentMethod: string;
  estimatedDelivery: string;
  deliveryNotes: string;
}

export function OrderConfirmationPage({ orderId, onNavigateHome, onContinueShopping }: OrderConfirmationPageProps) {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrderData = async () => {
      setLoading(true);
      setError(null);
      
      console.log('📦 OrderConfirmationPage: orderId received:', orderId);
      
      if (!orderId) {
        console.error('❌ OrderConfirmationPage: orderId is empty!');
        setError('Order ID is missing');
        setLoading(false);
        return;
      }
      
      try {
        // Retrieve order data from user-specific localStorage
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const userId = user?.id;
        
        console.log('📦 User ID:', userId);
        
        if (!userId) {
          console.log('⚠️ No user authenticated - cannot load order');
          setError('User not authenticated');
          setLoading(false);
          return;
        }
        
        // SECURITY FIX: Load orders from user-specific key
        const userOrdersKey = `fashionOrders_${userId}`;
        const storedOrders = localStorage.getItem(userOrdersKey);
        console.log('📦 Stored orders key:', userOrdersKey, 'Found:', !!storedOrders);
        
        const orders = JSON.parse(storedOrders || '[]');
        console.log('📦 Total orders in localStorage:', orders.length);
        
        const order = orders.find((o: OrderData) => o.orderId === orderId);
        
        if (order) {
          setOrderData(order);
          console.log('✅ Loaded order confirmation for order:', orderId);
        } else {
          console.warn('⚠️ Order not found in localStorage for orderId:', orderId);
          console.log('📦 Available orders:', orders.map((o: any) => o.orderId));
          setError(`Order not found: ${orderId}`);
        }
      } catch (err) {
        console.error('❌ Error loading order data:', err);
        setError('Failed to load order data');
      } finally {
        setLoading(false);
      }
    };
    
    loadOrderData();
  }, [orderId]);

  const downloadReceipt = () => {
    if (!orderData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('SHRINGARIKA', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Premium Fashion & Lifestyle', pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 3;
    doc.text('www.shringarika.live | shringarika11@gmail.com', pageWidth / 2, yPosition, { align: 'center' });
    
    // Divider
    yPosition += 8;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    
    yPosition += 10;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDER RECEIPT', 15, yPosition);
    
    const rightX = pageWidth - 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order ID: ${orderData.orderId}`, rightX, yPosition - 2, { align: 'right' });
    doc.text(`Date: ${orderData.orderDate}`, rightX, yPosition + 4, { align: 'right' });
    
    yPosition += 20;

    // Customer Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER DETAILS:', 15, yPosition);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    yPosition += 6;
    doc.text(orderData.customer.name, 15, yPosition);
    yPosition += 5;
    doc.text(orderData.customer.email, 15, yPosition);
    yPosition += 5;
    doc.text(orderData.customer.phone, 15, yPosition);
    
    yPosition += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY ADDRESS:', 15, yPosition);
    
    doc.setFont('helvetica', 'normal');
    yPosition += 6;
    const addressLines = doc.splitTextToSize(orderData.customer.address, pageWidth - 30);
    addressLines.forEach((line: string) => {
      doc.text(line, 15, yPosition);
      yPosition += 5;
    });
    
    yPosition += 10;

    // Order Items
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDER ITEMS:', 15, yPosition);
    yPosition += 8;

    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPosition - 5, pageWidth - 30, 8, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('ITEM', 18, yPosition);
    doc.text('QTY', 130, yPosition);
    doc.text('PRICE', 155, yPosition);
    doc.text('TOTAL', 180, yPosition);
    doc.setFont('helvetica', 'normal');
    
    yPosition += 8;
    doc.setTextColor(0, 0, 0);
    
    orderData.items.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');
      }
      
      const itemName = doc.splitTextToSize(item.name, 100);
      doc.text(itemName[0], 18, yPosition);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Size: ${item.size} | Color: ${item.color}`, 18, yPosition + 4);
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      
      doc.text(item.quantity.toString(), 130, yPosition);
      doc.text(`₹${item.price.toFixed(2)}`, 155, yPosition);
      doc.text(`₹${item.total.toFixed(2)}`, 180, yPosition);
      
      yPosition += 10;
    });
    
    yPosition += 5;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(130, yPosition, pageWidth - 15, yPosition);
    
    // Totals
    yPosition += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Subtotal:', 155, yPosition);
    doc.text(`₹${orderData.subtotal}`, 180, yPosition);
    
    yPosition += 6;
    doc.text('Delivery:', 155, yPosition);
    doc.text(`₹${orderData.deliveryCharge}`, 180, yPosition);
    
    yPosition += 10;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(130, yPosition - 3, pageWidth - 15, yPosition - 3);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL:', 135, yPosition + 3);
    doc.text(`₹${orderData.total}`, rightX, yPosition + 3, { align: 'right' });
    
    yPosition += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Payment Method: ${orderData.paymentMethod}`, 15, yPosition);
    
    yPosition += 8;
    doc.text(`Estimated Delivery: ${orderData.estimatedDelivery}`, 15, yPosition);
    
    if (orderData.deliveryNotes && orderData.deliveryNotes !== 'None') {
      yPosition += 6;
      doc.text(`Notes: ${orderData.deliveryNotes}`, 15, yPosition);
    }
    
    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(0, 0, 0);
    doc.line(15, footerY, pageWidth - 15, footerY);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for shopping with Shringarika!', pageWidth / 2, footerY + 5, { align: 'center' });
    doc.text('For queries: shringarika11@gmail.com | +91-8299103181', pageWidth / 2, footerY + 10, { align: 'center' });
    
    // Save PDF
    doc.save(`Shringarika_Order_${orderData.orderId}.pdf`);
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Loading order details...</p>
          <p className="text-neutral-600">Order ID: {orderId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">❌ {error}</p>
          <p className="text-neutral-600 mb-6">Order ID: {orderId}</p>
          <button
            onClick={onNavigateHome}
            className="bg-black text-white px-6 py-2 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Order data not available</p>
          <p className="text-neutral-600 mb-6">Order ID: {orderId}</p>
          <button
            onClick={onNavigateHome}
            className="bg-black text-white px-6 py-2 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
          >
            BACK TO HOME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* Success Message */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl tracking-wider mb-3">ORDER SUCCESSFULLY PLACED!</h1>
          <p className="text-neutral-600 text-lg mb-2">
            Thank you for your order, {orderData.customer.name}
          </p>
          <p className="text-neutral-500">
            You can download your order receipt below
          </p>
        </div>

        {/* Order Details Card */}
        <div className="border border-neutral-300 rounded-lg p-8 mb-8">
          {/* Order Info */}
          <div className="flex justify-between items-start mb-8 pb-8 border-b border-neutral-200">
            <div>
              <h2 className="text-2xl tracking-wider mb-2">Order #{orderData.orderId || orderId}</h2>
              <p className="text-sm text-neutral-600">{orderData.orderDate}</p>
            </div>
            <button
              onClick={downloadReceipt}
              className="flex items-center gap-2 bg-black text-white px-6 py-2 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              DOWNLOAD RECEIPT
            </button>
          </div>

          {/* Delivery Information */}
          <div className="mb-8 pb-8 border-b border-neutral-200">
            <div className="flex items-start gap-4 mb-6">
              <Package className="w-6 h-6 mt-1" />
              <div>
                <h3 className="tracking-wider mb-2">ESTIMATED DELIVERY</h3>
                <p className="text-2xl mb-1">{orderData.estimatedDelivery}</p>
                <p className="text-sm text-neutral-600">Your order will be delivered within 5-7 business days</p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded p-4">
              <h4 className="text-sm tracking-wider mb-2">DELIVERY ADDRESS</h4>
              <p className="text-sm text-neutral-700">{orderData.customer.address}</p>
              <p className="text-sm text-neutral-600 mt-2">Phone: {orderData.customer.phone}</p>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-8 pb-8 border-b border-neutral-200">
            <h3 className="tracking-wider mb-4">ORDER ITEMS</h3>
            <div className="space-y-4">
              {orderData.items.map((item, index) => {
                const itemImage = item.image || '';
                return (
                  <div key={index} className="flex justify-between items-start">
                    <div className="flex gap-4">
                      <div className="w-20 h-24 bg-neutral-200 border border-neutral-300 shrink-0 overflow-hidden rounded">
                        {itemImage ? (
                          <img 
                            src={itemImage} 
                            alt={item.name} 
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><span class="text-xs text-neutral-500">No Image</span></div>';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs text-neutral-500">No Image</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm tracking-wider mb-1">{item.name}</h4>
                        <p className="text-xs text-neutral-600 mb-1">
                          Size: {item.size} | Color: {item.color}
                        </p>
                        <p className="text-xs text-neutral-600">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="text-sm">₹{item.total.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="space-y-3">
            <h3 className="tracking-wider mb-4">PAYMENT SUMMARY</h3>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Subtotal</span>
              <span>₹{orderData.subtotal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Delivery Charge</span>
              <span>₹{orderData.deliveryCharge}</span>
            </div>
            <div className="border-t border-neutral-300 pt-3 flex justify-between">
              <span className="tracking-wider">TOTAL PAID</span>
              <span className="text-2xl">₹{orderData.total}</span>
            </div>
            <div className="bg-neutral-50 rounded p-3 mt-4">
              <p className="text-sm">
                <span className="text-neutral-600">Payment Method:</span>{' '}
                <span className="tracking-wider">{orderData.paymentMethod}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onNavigateHome}
            className="flex-1 flex items-center justify-center gap-2 border border-black py-4 rounded-full text-sm tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" />
            BACK TO HOME
          </button>
          <button
            onClick={onContinueShopping}
            className="flex-1 flex items-center justify-center gap-2 bg-black text-white py-4 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            CONTINUE SHOPPING
          </button>
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center space-y-2 text-sm text-neutral-600">
          <p>Need help with your order?</p>
          <p>
            Contact us at{' '}
            <a href="mailto:support@fashion.com" className="text-black underline">
              support@fashion.com
            </a>
            {' '}or call{' '}
            <a href="tel:+911234567890" className="text-black underline">
              +91 123-456-7890
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
