// Shipping Integration & Tax Calculation

// Shiprocket API Integration (Placeholder - requires API key)
export interface ShippingAddress {
  pincode: string;
  city: string;
  state: string;
  country: string;
}

export interface ShippingRate {
  courier: string;
  rate: number;
  estimatedDays: string;
  serviceType: 'Standard' | 'Express' | 'SameDay';
}

// Calculate shipping charges based on pin code and weight
export const calculateShipping = async (
  fromPincode: string,
  toPincode: string,
  weightKg: number,
  codAmount?: number
): Promise<ShippingRate[]> => {
  // Mock implementation - replace with actual Shiprocket/Delhivery API call
  const baseRate = 50;
  const perKgRate = 20;
  const codCharges = codAmount ? codAmount * 0.02 : 0; // 2% COD charges
  
  const standardRate = baseRate + (weightKg * perKgRate) + codCharges;
  const expressRate = standardRate * 2;
  const sameDayRate = standardRate * 3;
  
  return [
    {
      courier: 'Standard Delivery',
      rate: Math.round(standardRate),
      estimatedDays: '5-7 days',
      serviceType: 'Standard',
    },
    {
      courier: 'Express Delivery',
      rate: Math.round(expressRate),
      estimatedDays: '2-3 days',
      serviceType: 'Express',
    },
    {
      courier: 'Same Day Delivery',
      rate: Math.round(sameDayRate),
      estimatedDays: 'Same day',
      serviceType: 'SameDay',
    },
  ];
};

// Validate Indian PIN code
export const validatePincode = async (pincode: string): Promise<{
  valid: boolean;
  city?: string;
  state?: string;
  serviceable?: boolean;
}> => {
  // Mock validation - replace with actual PIN code API
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  
  if (!pincodeRegex.test(pincode)) {
    return { valid: false };
  }
  
  // Mock data - replace with actual API call
  return {
    valid: true,
    city: 'City Name',
    state: 'State Name',
    serviceable: true,
  };
};

// GST Calculation for India
export interface GSTBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
  totalGST: number;
  gstRate: number;
}

export const calculateGST = (
  amount: number,
  gstRate: number = 5, // 5% for textiles
  isInterstate: boolean = false
): GSTBreakdown => {
  const gstAmount = (amount * gstRate) / (100 + gstRate);
  
  if (isInterstate) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      totalGST: gstAmount,
      gstRate,
    };
  } else {
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    
    return {
      cgst,
      sgst,
      igst: 0,
      totalGST: gstAmount,
      gstRate,
    };
  }
};

// Generate GST Invoice
export interface GSTInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  gstin: string;
  businessName: string;
  businessAddress: string;
  customerName: string;
  customerAddress: string;
  customerGSTIN?: string;
  items: Array<{
    description: string;
    hsn: string;
    quantity: number;
    rate: number;
    taxableValue: number;
    gstRate: number;
    gstAmount: number;
  }>;
  totalTaxableValue: number;
  totalGST: number;
  grandTotal: number;
  gstBreakdown: GSTBreakdown;
}

export const generateGSTInvoice = (
  orderData: any,
  businessDetails: {
    gstin: string;
    name: string;
    address: string;
  }
): GSTInvoice => {
  const invoiceNumber = `INV-${Date.now()}`;
  const items = orderData.items.map((item: any) => {
    const taxableValue = item.price * item.quantity;
    const gstRate = 5; // 5% GST for textiles
    const gstAmount = (taxableValue * gstRate) / 100;
    
    return {
      description: item.name,
      hsn: '6217', // HSN code for garments
      quantity: item.quantity,
      rate: item.price,
      taxableValue,
      gstRate,
      gstAmount,
    };
  });
  
  const totalTaxableValue = items.reduce((sum: number, item: any) => sum + item.taxableValue, 0);
  const totalGST = items.reduce((sum: number, item: any) => sum + item.gstAmount, 0);
  const grandTotal = totalTaxableValue + totalGST;
  
  const gstBreakdown = calculateGST(grandTotal, 5, false);
  
  return {
    invoiceNumber,
    invoiceDate: new Date().toLocaleDateString('en-IN'),
    gstin: businessDetails.gstin,
    businessName: businessDetails.name,
    businessAddress: businessDetails.address,
    customerName: orderData.customer.name,
    customerAddress: orderData.customer.address,
    customerGSTIN: orderData.customer.gstin,
    items,
    totalTaxableValue,
    totalGST,
    grandTotal,
    gstBreakdown,
  };
};

// Track shipment (Mock implementation)
export interface TrackingInfo {
  status: string;
  location: string;
  timestamp: string;
  remarks: string;
}

export const trackShipment = async (trackingId: string): Promise<TrackingInfo[]> => {
  // Mock tracking data - replace with actual Shiprocket/Delhivery API
  return [
    {
      status: 'Order Placed',
      location: 'Origin Hub',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      remarks: 'Order confirmed and ready for pickup',
    },
    {
      status: 'In Transit',
      location: 'Regional Hub',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      remarks: 'Package in transit to destination',
    },
    {
      status: 'Out for Delivery',
      location: 'Local Hub',
      timestamp: new Date().toISOString(),
      remarks: 'Package out for delivery',
    },
  ];
};

// Calculate estimated delivery date
export const calculateDeliveryDate = (
  serviceType: 'Standard' | 'Express' | 'SameDay',
  orderDate: Date = new Date()
): Date => {
  const deliveryDate = new Date(orderDate);
  
  switch (serviceType) {
    case 'SameDay':
      // Same day if ordered before 2 PM
      if (orderDate.getHours() >= 14) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
      }
      break;
    case 'Express':
      deliveryDate.setDate(deliveryDate.getDate() + 2);
      break;
    case 'Standard':
    default:
      deliveryDate.setDate(deliveryDate.getDate() + 5);
      break;
  }
  
  // Skip Sundays
  if (deliveryDate.getDay() === 0) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
  }
  
  return deliveryDate;
};

// Check serviceable PIN codes
export const isServiceable = (pincode: string): boolean => {
  // Mock implementation - replace with actual serviceable PIN codes check
  const pincodeNum = parseInt(pincode);
  
  // Basic validation: Indian PIN codes
  return pincodeNum >= 100000 && pincodeNum <= 999999;
};

// Calculate delivery slots
export const getDeliverySlots = (date: Date): string[] => {
  const slots = [];
  const dayOfWeek = date.getDay();
  
  // No delivery on Sundays
  if (dayOfWeek === 0) {
    return [];
  }
  
  slots.push('9:00 AM - 12:00 PM');
  slots.push('12:00 PM - 3:00 PM');
  slots.push('3:00 PM - 6:00 PM');
  slots.push('6:00 PM - 9:00 PM');
  
  return slots;
};
