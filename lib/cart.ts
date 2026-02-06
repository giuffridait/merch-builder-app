export interface CartItem {
  id: number;
  productId: string;
  productName: string;
  color: { name: string; hex: string };
  size: string | null;
  quantity: number;
  variant: string;
  designSVG: string;
  text: string;
  icon: string;
  price: number;
  total: number;
  currency?: string;
  deliveryEstimateDays?: number;
  previewUrl?: string;
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('merch-cart');
  return saved ? JSON.parse(saved) : [];
}

export function saveCart(cart: CartItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('merch-cart', JSON.stringify(cart));
}

export function addToCart(item: Omit<CartItem, 'id'>): CartItem[] {
  const cart = getCart();
  const newItem = { ...item, id: Date.now() };
  const newCart = [...cart, newItem];
  saveCart(newCart);
  return newCart;
}

export function removeFromCart(id: number): CartItem[] {
  const cart = getCart();
  const newCart = cart.filter(item => item.id !== id);
  saveCart(newCart);
  return newCart;
}

export function updateQuantity(id: number, quantity: number): CartItem[] {
  const cart = getCart();
  const newCart = cart.map(item =>
    item.id === id ? { ...item, quantity, total: item.price * quantity } : item
  );
  saveCart(newCart);
  return newCart;
}

export function clearCart(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('merch-cart');
}
