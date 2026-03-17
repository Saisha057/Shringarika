// Shipping Zone Management and Delivery Estimates

export type ShippingZoneType = 'domestic-metro' | 'domestic-tier1' | 'domestic-tier2' | 'domestic-remote' | 'international';
export type CourierService = 'delhivery' | 'bluedart' | 'dtdc' | 'fedex' | 'dhl' | 'aramex';

export interface ShippingZone {
  id: string;
  name: string;
  type: ShippingZoneType;
  description: string;
  deliveryDays: {
    min: number;
    max: number;
  };
  baseRate: number;
  freeShippingThreshold: number;
  pincodes?: string[]; // For domestic zones
  countries?: string[]; // For international zones
}

export interface ShippingRate {
  zone: ShippingZone;
  cost: number;
  estimatedDelivery: {
    min: Date;
    max: Date;
  };
  isFreeShipping: boolean;
  courier: CourierService;
}

export interface CourierTrackingInfo {
  trackingNumber: string;
  courier: CourierService;
  courierName: string;
  trackingUrl: string;
  status: 'pending' | 'picked-up' | 'in-transit' | 'out-for-delivery' | 'delivered' | 'failed' | 'returned';
  lastUpdate: Date;
  estimatedDelivery?: Date;
  currentLocation?: string;
}

export interface PincodeInfo {
  pincode: string;
  city: string;
  state: string;
  zone: ShippingZoneType;
  serviceable: boolean;
  deliveryDays: number;
}

// Indian States and their zones
const STATE_ZONES: Record<string, ShippingZoneType> = {
  // Metro Cities
  'Delhi': 'domestic-metro',
  'Maharashtra': 'domestic-metro', // Mumbai
  'Karnataka': 'domestic-metro', // Bangalore
  'Tamil Nadu': 'domestic-metro', // Chennai
  'West Bengal': 'domestic-metro', // Kolkata
  'Telangana': 'domestic-metro', // Hyderabad
  
  // Tier 1 Cities
  'Gujarat': 'domestic-tier1',
  'Rajasthan': 'domestic-tier1',
  'Uttar Pradesh': 'domestic-tier1',
  'Madhya Pradesh': 'domestic-tier1',
  'Punjab': 'domestic-tier1',
  'Haryana': 'domestic-tier1',
  'Kerala': 'domestic-tier1',
  
  // Tier 2 Cities
  'Andhra Pradesh': 'domestic-tier2',
  'Bihar': 'domestic-tier2',
  'Chhattisgarh': 'domestic-tier2',
  'Goa': 'domestic-tier2',
  'Jharkhand': 'domestic-tier2',
  'Odisha': 'domestic-tier2',
  'Uttarakhand': 'domestic-tier2',
  'Himachal Pradesh': 'domestic-tier2',
  'Assam': 'domestic-tier2',
  
  // Remote Areas
  'Jammu and Kashmir': 'domestic-remote',
  'Ladakh': 'domestic-remote',
  'Arunachal Pradesh': 'domestic-remote',
  'Manipur': 'domestic-remote',
  'Meghalaya': 'domestic-remote',
  'Mizoram': 'domestic-remote',
  'Nagaland': 'domestic-remote',
  'Sikkim': 'domestic-remote',
  'Tripura': 'domestic-remote',
  'Andaman and Nicobar Islands': 'domestic-remote',
  'Lakshadweep': 'domestic-remote',
};

// Predefined Shipping Zones
export const SHIPPING_ZONES: ShippingZone[] = [
  {
    id: 'domestic-metro',
    name: 'Metro Cities',
    type: 'domestic-metro',
    description: 'Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad',
    deliveryDays: { min: 2, max: 4 },
    baseRate: 50,
    freeShippingThreshold: 999,
  },
  {
    id: 'domestic-tier1',
    name: 'Tier 1 Cities',
    type: 'domestic-tier1',
    description: 'Major cities across India',
    deliveryDays: { min: 3, max: 6 },
    baseRate: 70,
    freeShippingThreshold: 1499,
  },
  {
    id: 'domestic-tier2',
    name: 'Tier 2 Cities & Towns',
    type: 'domestic-tier2',
    description: 'Smaller cities and towns',
    deliveryDays: { min: 5, max: 8 },
    baseRate: 90,
    freeShippingThreshold: 1999,
  },
  {
    id: 'domestic-remote',
    name: 'Remote Areas',
    type: 'domestic-remote',
    description: 'Hill stations, islands, and remote regions',
    deliveryDays: { min: 7, max: 14 },
    baseRate: 150,
    freeShippingThreshold: 2499,
  },
  {
    id: 'international',
    name: 'International',
    type: 'international',
    description: 'Worldwide shipping',
    deliveryDays: { min: 10, max: 21 },
    baseRate: 500,
    freeShippingThreshold: 5000,
    countries: ['US', 'UK', 'CA', 'AU', 'SG', 'UAE', 'DE', 'FR'],
  },
];

// Courier service configuration
export const COURIER_SERVICES: Record<CourierService, { name: string; trackingUrl: string; apiKey?: string }> = {
  delhivery: {
    name: 'Delhivery',
    trackingUrl: 'https://www.delhivery.com/track/package/',
  },
  bluedart: {
    name: 'Blue Dart',
    trackingUrl: 'https://www.bluedart.com/tracking?trackFor=',
  },
  dtdc: {
    name: 'DTDC',
    trackingUrl: 'https://www.dtdc.in/tracking.asp?id=',
  },
  fedex: {
    name: 'FedEx',
    trackingUrl: 'https://www.fedex.com/fedextrack/?tracknumbers=',
  },
  dhl: {
    name: 'DHL',
    trackingUrl: 'https://www.dhl.com/in-en/home/tracking.html?tracking-id=',
  },
  aramex: {
    name: 'Aramex',
    trackingUrl: 'https://www.aramex.com/track/results?mode=0&ShipmentNumber=',
  },
};

/**
 * Get shipping zone based on pincode
 */
export function getShippingZoneByPincode(pincode: string, state: string): ShippingZone | null {
  // Validate pincode format
  if (!/^\d{6}$/.test(pincode)) {
    return null;
  }

  // Determine zone based on state
  const zoneType = STATE_ZONES[state] || 'domestic-tier2';
  const zone = SHIPPING_ZONES.find(z => z.type === zoneType);

  return zone || null;
}

/**
 * Get pincode information with serviceability check
 */
export async function getPincodeInfo(pincode: string): Promise<PincodeInfo | null> {
  // In production, this would call a real API (India Post, Google Maps, etc.)
  // For now, we'll use a mock implementation
  
  if (!/^\d{6}$/.test(pincode)) {
    return null;
  }

  // Mock pincode database (in production, use real API)
  const mockPincodeData: Record<string, { city: string; state: string }> = {
    '110001': { city: 'New Delhi', state: 'Delhi' },
    '400001': { city: 'Mumbai', state: 'Maharashtra' },
    '560001': { city: 'Bangalore', state: 'Karnataka' },
    '600001': { city: 'Chennai', state: 'Tamil Nadu' },
    '700001': { city: 'Kolkata', state: 'West Bengal' },
    '500001': { city: 'Hyderabad', state: 'Telangana' },
    '380001': { city: 'Ahmedabad', state: 'Gujarat' },
    '302001': { city: 'Jaipur', state: 'Rajasthan' },
    '226001': { city: 'Lucknow', state: 'Uttar Pradesh' },
    '160001': { city: 'Chandigarh', state: 'Punjab' },
  };

  const data = mockPincodeData[pincode];
  
  if (!data) {
    // If pincode not in mock data, try to determine zone by first digit
    const firstDigit = pincode[0];
    const zoneMapping: Record<string, { state: string; city: string }> = {
      '1': { state: 'Delhi', city: 'Delhi Region' },
      '2': { state: 'Haryana', city: 'Haryana Region' },
      '3': { state: 'Rajasthan', city: 'Rajasthan Region' },
      '4': { state: 'Maharashtra', city: 'Maharashtra Region' },
      '5': { state: 'Karnataka', city: 'Karnataka Region' },
      '6': { state: 'Tamil Nadu', city: 'Tamil Nadu Region' },
      '7': { state: 'West Bengal', city: 'West Bengal Region' },
      '8': { state: 'Bihar', city: 'Bihar Region' },
    };
    
    const regionData = zoneMapping[firstDigit] || { state: 'Uttar Pradesh', city: 'Unknown' };
    const zoneType = STATE_ZONES[regionData.state] || 'domestic-tier2';
    const zone = SHIPPING_ZONES.find(z => z.type === zoneType);
    
    return {
      pincode,
      city: regionData.city,
      state: regionData.state,
      zone: zoneType,
      serviceable: true,
      deliveryDays: zone?.deliveryDays.max || 7,
    };
  }

  const zoneType = STATE_ZONES[data.state] || 'domestic-tier2';
  const zone = SHIPPING_ZONES.find(z => z.type === zoneType);

  return {
    pincode,
    city: data.city,
    state: data.state,
    zone: zoneType,
    serviceable: true,
    deliveryDays: zone?.deliveryDays.max || 7,
  };
}

/**
 * Calculate shipping cost based on cart value, weight, and zone
 */
export function calculateShippingCost(
  cartValue: number,
  weight: number, // in kg
  zone: ShippingZone,
  promoCode?: string
): ShippingRate {
  let cost = zone.baseRate;

  // Weight-based charges (₹20 per kg after first kg)
  if (weight > 1) {
    cost += (weight - 1) * 20;
  }

  // Check for free shipping
  const isFreeShipping = cartValue >= zone.freeShippingThreshold;
  
  // Apply promo code discounts
  if (promoCode) {
    const discount = applyShippingPromo(promoCode, cost);
    cost = Math.max(0, cost - discount);
  }

  if (isFreeShipping) {
    cost = 0;
  }

  // Calculate estimated delivery dates
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + zone.deliveryDays.min);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + zone.deliveryDays.max);

  // Select appropriate courier based on zone
  const courier = selectCourier(zone.type);

  return {
    zone,
    cost,
    estimatedDelivery: {
      min: minDate,
      max: maxDate,
    },
    isFreeShipping,
    courier,
  };
}

/**
 * Select courier service based on shipping zone
 */
function selectCourier(zoneType: ShippingZoneType): CourierService {
  const courierMap: Record<ShippingZoneType, CourierService> = {
    'domestic-metro': 'delhivery',
    'domestic-tier1': 'bluedart',
    'domestic-tier2': 'dtdc',
    'domestic-remote': 'dtdc',
    'international': 'dhl',
  };

  return courierMap[zoneType];
}

/**
 * Apply shipping promo code discounts
 */
function applyShippingPromo(promoCode: string, shippingCost: number): number {
  const promos: Record<string, number> = {
    'FREESHIP': shippingCost, // 100% off
    'SHIP50': shippingCost * 0.5, // 50% off
    'SHIP30': shippingCost * 0.3, // 30% off
    'FLAT50': 50, // Flat ₹50 off
  };

  return promos[promoCode.toUpperCase()] || 0;
}

/**
 * Generate tracking number (mock implementation)
 */
export function generateTrackingNumber(courier: CourierService, orderId: string): string {
  const prefix = courier.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  return `${prefix}${timestamp}${random}`;
}

/**
 * Get tracking information from courier API
 */
export async function getTrackingInfo(
  trackingNumber: string,
  courier: CourierService
): Promise<CourierTrackingInfo | null> {
  // In production, this would call the actual courier API
  // For now, we'll return mock data
  
  const courierInfo = COURIER_SERVICES[courier];
  
  // Mock tracking data
  const statuses: CourierTrackingInfo['status'][] = [
    'pending',
    'picked-up',
    'in-transit',
    'out-for-delivery',
    'delivered',
  ];
  
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

  return {
    trackingNumber,
    courier,
    courierName: courierInfo.name,
    trackingUrl: `${courierInfo.trackingUrl}${trackingNumber}`,
    status: randomStatus,
    lastUpdate: new Date(),
    estimatedDelivery,
    currentLocation: 'Mumbai Distribution Center',
  };
}

/**
 * Check if pincode is serviceable
 */
export async function checkServiceability(pincode: string): Promise<{
  serviceable: boolean;
  message: string;
  zone?: ShippingZone;
  estimatedDays?: number;
}> {
  const pincodeInfo = await getPincodeInfo(pincode);
  
  if (!pincodeInfo) {
    return {
      serviceable: false,
      message: 'Invalid pincode or area not serviceable',
    };
  }

  if (!pincodeInfo.serviceable) {
    return {
      serviceable: false,
      message: `Sorry, we don't deliver to ${pincodeInfo.city} yet`,
    };
  }

  const zone = SHIPPING_ZONES.find(z => z.type === pincodeInfo.zone);
  
  return {
    serviceable: true,
    message: `Delivery available in ${pincodeInfo.deliveryDays} days`,
    zone: zone,
    estimatedDays: pincodeInfo.deliveryDays,
  };
}

/**
 * Format delivery estimate for display
 */
export function formatDeliveryEstimate(estimatedDelivery: { min: Date; max: Date }): string {
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric',
    year: estimatedDelivery.min.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  };
  
  const minDate = estimatedDelivery.min.toLocaleDateString('en-IN', options);
  const maxDate = estimatedDelivery.max.toLocaleDateString('en-IN', options);
  
  if (minDate === maxDate) {
    return `Expected by ${minDate}`;
  }
  
  return `Expected between ${minDate} - ${maxDate}`;
}

/**
 * Get shipping zones for admin configuration
 */
export function getAvailableShippingZones(): ShippingZone[] {
  return SHIPPING_ZONES;
}

/**
 * Update shipping zone configuration (admin only)
 */
export function updateShippingZone(
  zoneId: string,
  updates: Partial<ShippingZone>
): ShippingZone | null {
  const zoneIndex = SHIPPING_ZONES.findIndex(z => z.id === zoneId);
  
  if (zoneIndex === -1) {
    return null;
  }

  SHIPPING_ZONES[zoneIndex] = {
    ...SHIPPING_ZONES[zoneIndex],
    ...updates,
  };

  // In production, save to database
  localStorage.setItem('shipping_zones', JSON.stringify(SHIPPING_ZONES));

  return SHIPPING_ZONES[zoneIndex];
}
