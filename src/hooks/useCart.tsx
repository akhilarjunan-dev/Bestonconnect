import { useState, useEffect, useCallback } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  is_digital: boolean;
  commission_rate: number;
}

const CART_STORAGE_KEY = 'bestonconnect_cart';
const REFERRAL_STORAGE_KEY = 'bestonconnect_referral';

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    loadCart();
    
    const handleCartUpdate = (e: CustomEvent<number>) => {
      setCartCount(e.detail);
      loadCart();
    };
    
    window.addEventListener('cartUpdated', handleCartUpdate as EventListener);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate as EventListener);
    };
  }, []);

  const loadCart = useCallback(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      const items = JSON.parse(savedCart) as CartItem[];
      setCartItems(items);
      setCartCount(items.length);
    } else {
      setCartItems([]);
      setCartCount(0);
    }
  }, []);

  const addToCart = useCallback((product: {
    id: string;
    name: string;
    price: number;
    image_urls?: string[] | null;
    is_digital?: boolean;
    commission_rate: number;
  }) => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    const items: CartItem[] = savedCart ? JSON.parse(savedCart) : [];
    
    const existingIndex = items.findIndex(item => item.id === product.id);
    
    if (existingIndex >= 0) {
      items[existingIndex].quantity += 1;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_urls?.[0] || null,
        quantity: 1,
        is_digital: product.is_digital || false,
        commission_rate: product.commission_rate
      });
    }
    
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    setCartItems(items);
    setCartCount(items.length);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: items.length }));
    
    return true;
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    const items: CartItem[] = savedCart ? JSON.parse(savedCart) : [];
    const filtered = items.filter(item => item.id !== productId);
    
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(filtered));
    setCartItems(filtered);
    setCartCount(filtered.length);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: filtered.length }));
  }, []);

  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_STORAGE_KEY);
    setCartItems([]);
    setCartCount(0);
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: 0 }));
  }, []);

  const saveReferral = useCallback((promoterId: string) => {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ promoter_id: promoterId }));
  }, []);

  const getReferral = useCallback(() => {
    const saved = localStorage.getItem(REFERRAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  }, []);

  return {
    cartItems,
    cartCount,
    addToCart,
    removeFromCart,
    clearCart,
    loadCart,
    saveReferral,
    getReferral
  };
}
