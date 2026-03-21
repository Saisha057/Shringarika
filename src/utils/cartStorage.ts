export interface GuestCartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
  price: number;
  name: string;
  image: string;
  color: string;
  size: string;
}

const GUEST_CART_KEY = 'guest_cart';

export function getGuestCart(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestCart(items: GuestCartItem[]): void {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function addToGuestCart(item: GuestCartItem): GuestCartItem[] {
  const current = getGuestCart();
  const existingIndex = current.findIndex(
    (i) =>
      i.productId === item.productId &&
      (i.variantId || null) === (item.variantId || null) &&
      i.size === item.size &&
      i.color === item.color,
  );

  if (existingIndex > -1) {
    current[existingIndex] = {
      ...current[existingIndex],
      quantity: current[existingIndex].quantity + item.quantity,
    };
  } else {
    current.push(item);
  }

  saveGuestCart(current);
  return current;
}

export function removeFromGuestCart(
  productId: string,
  size: string,
  color?: string,
  variantId?: string | null,
): GuestCartItem[] {
  const next = getGuestCart().filter(
    (item) =>
      !(
        item.productId === productId &&
        item.size === size &&
        (color === undefined || item.color === color) &&
        (variantId === undefined || (item.variantId || null) === (variantId || null))
      ),
  );
  saveGuestCart(next);
  return next;
}

export function updateGuestCartQuantity(
  productId: string,
  size: string,
  quantity: number,
  color?: string,
  variantId?: string | null,
): GuestCartItem[] {
  const current = getGuestCart();
  const next = current
    .map((item) => {
      const isTarget =
        item.productId === productId &&
        item.size === size &&
        (color === undefined || item.color === color) &&
        (variantId === undefined || (item.variantId || null) === (variantId || null));

      if (!isTarget) return item;
      return { ...item, quantity };
    })
    .filter((item) => item.quantity > 0);

  saveGuestCart(next);
  return next;
}

export function clearGuestCart(): void {
  localStorage.removeItem(GUEST_CART_KEY);
}
