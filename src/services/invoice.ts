import { jsPDF } from "jspdf"

interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  size?: string
  color?: string
}

interface ShippingAddress {
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
  phone: string
}

interface InvoiceData {
  orderId: string
  orderDate: string
  customerName: string
  customerEmail: string
  shippingAddress: ShippingAddress
  items: OrderItem[]
  subtotal: number
  shipping: number
  tax: number
  total: number
  paymentMethod: string
  paymentStatus: string
}

export const generateInvoicePDF = (data: InvoiceData) => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Brand colors
  const brandBlack = "#000000"
  const lightGray = "#f5f5f5"
  
  let yPosition = 20

  // Header with company name
  doc.setFontSize(24)
  doc.setFont("helvetica", "bold")
  doc.text("SHRINGARIKA", pageWidth / 2, yPosition, { align: "center" })
  
  yPosition += 8
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Premium Fashion & Lifestyle", pageWidth / 2, yPosition, { align: "center" })
  
  yPosition += 3
  doc.text("www.shringarika.com | support@shringarika.com", pageWidth / 2, yPosition, { align: "center" })
  
  // Divider line
  yPosition += 8
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(15, yPosition, pageWidth - 15, yPosition)
  
  yPosition += 10

  // Invoice title
  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.text("INVOICE", 15, yPosition)
  
  // Order details (right side)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const rightX = pageWidth - 15
  doc.text(`Order ID: ${data.orderId}`, rightX, yPosition - 2, { align: "right" })
  doc.text(`Date: ${new Date(data.orderDate).toLocaleDateString()}`, rightX, yPosition + 4, { align: "right" })
  doc.text(`Payment: ${data.paymentMethod}`, rightX, yPosition + 10, { align: "right" })
  
  yPosition += 20

  // Customer & Shipping Info
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("BILL TO:", 15, yPosition)
  
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  yPosition += 6
  doc.text(data.customerName, 15, yPosition)
  yPosition += 5
  doc.text(data.customerEmail, 15, yPosition)
  
  yPosition += 10
  doc.setFont("helvetica", "bold")
  doc.text("SHIP TO:", 15, yPosition)
  
  doc.setFont("helvetica", "normal")
  yPosition += 6
  doc.text(data.shippingAddress.fullName, 15, yPosition)
  yPosition += 5
  doc.text(data.shippingAddress.addressLine1, 15, yPosition)
  if (data.shippingAddress.addressLine2) {
    yPosition += 5
    doc.text(data.shippingAddress.addressLine2, 15, yPosition)
  }
  yPosition += 5
  doc.text(`${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.pincode}`, 15, yPosition)
  yPosition += 5
  doc.text(`Phone: ${data.shippingAddress.phone}`, 15, yPosition)
  
  yPosition += 15

  // Items table header
  doc.setFillColor(0, 0, 0)
  doc.rect(15, yPosition, pageWidth - 30, 8, "F")
  
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  
  const colX = {
    item: 18,
    details: 75,
    qty: 130,
    price: 155,
    total: 180
  }
  
  yPosition += 6
  doc.text("ITEM", colX.item, yPosition)
  doc.text("DETAILS", colX.details, yPosition)
  doc.text("QTY", colX.qty, yPosition)
  doc.text("PRICE", colX.price, yPosition)
  doc.text("TOTAL", colX.total, yPosition)
  
  // Items
  yPosition += 8
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  
  data.items.forEach((item, index) => {
    // Alternate row background
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245)
      doc.rect(15, yPosition - 5, pageWidth - 30, 10, "F")
    }
    
    doc.text(item.name, colX.item, yPosition)
    
    const details = []
    if (item.size) details.push(`Size: ${item.size}`)
    if (item.color) details.push(`Color: ${item.color}`)
    if (details.length > 0) {
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text(details.join(" | "), colX.details, yPosition)
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
    }
    
    doc.text(item.quantity.toString(), colX.qty, yPosition)
    doc.text(`₹${item.price.toFixed(2)}`, colX.price, yPosition)
    doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, colX.total, yPosition)
    
    yPosition += 10
  })
  
  // Divider before totals
  yPosition += 5
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(130, yPosition, pageWidth - 15, yPosition)
  
  // Totals
  yPosition += 8
  doc.setFontSize(10)
  
  const totalsX = 155
  const amountsX = 180
  
  doc.setFont("helvetica", "normal")
  doc.text("Subtotal:", totalsX, yPosition)
  doc.text(`₹${data.subtotal.toFixed(2)}`, amountsX, yPosition)
  
  yPosition += 6
  doc.text("Shipping:", totalsX, yPosition)
  doc.text(`₹${data.shipping.toFixed(2)}`, amountsX, yPosition)
  
  yPosition += 6
  doc.text("Tax (GST):", totalsX, yPosition)
  doc.text(`₹${data.tax.toFixed(2)}`, amountsX, yPosition)
  
  // Total with background
  yPosition += 8
  doc.setFillColor(0, 0, 0)
  doc.rect(130, yPosition - 5, pageWidth - 130 - 15, 10, "F")
  
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("TOTAL:", totalsX, yPosition + 1)
  doc.text(`₹${data.total.toFixed(2)}`, amountsX, yPosition + 1)
  
  // Payment status
  yPosition += 15
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  
  const statusText = data.paymentStatus === "paid" ? "PAID" : "PENDING"
  const statusColor = data.paymentStatus === "paid" ? [34, 197, 94] : [234, 179, 8]
  
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
  doc.text(`Payment Status: ${statusText}`, rightX, yPosition, { align: "right" })
  
  // Footer
  yPosition = pageHeight - 30
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(15, yPosition, pageWidth - 15, yPosition)
  
  yPosition += 8
  doc.setTextColor(100, 100, 100)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text("Thank you for shopping with Shringarika!", pageWidth / 2, yPosition, { align: "center" })
  
  yPosition += 5
  doc.text("For any queries, contact us at support@shringarika.com or call +91-1800-123-4567", pageWidth / 2, yPosition, { align: "center" })
  
  yPosition += 5
  doc.text("Terms & Conditions apply | Visit www.shringarika.com for details", pageWidth / 2, yPosition, { align: "center" })
  
  // Save the PDF
  doc.save(`Invoice-${data.orderId}.pdf`)
}

export const downloadInvoice = async (orderId: string) => {
  try {
    // Fetch order details from API (using proxy)
    const response = await fetch(`/api/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
    
    if (!response.ok) {
      throw new Error("Failed to fetch order details")
    }
    
    const order = await response.json()
    
    // Transform order data to invoice format
    const invoiceData: InvoiceData = {
      orderId: order.id || order._id,
      orderDate: order.createdAt || order.orderDate || new Date().toISOString(),
      customerName: order.shippingAddress?.fullName || "Customer",
      customerEmail: order.user?.email || "customer@email.com",
      shippingAddress: order.shippingAddress,
      items: order.items || [],
      subtotal: order.subtotal || 0,
      shipping: order.shippingCost || 0,
      tax: order.tax || 0,
      total: order.totalAmount || 0,
      paymentMethod: order.paymentMethod || "Online",
      paymentStatus: order.paymentStatus || "pending",
    }
    
    generateInvoicePDF(invoiceData)
    return { success: true }
  } catch (error) {
    console.error("Error generating invoice:", error)
    return { success: false, error: "Failed to generate invoice" }
  }
}
