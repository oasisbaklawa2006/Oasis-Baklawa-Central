import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Product {
  id: string;
  name: string;
  price_per_kg: number;
  pack_size: string | null;
  carton_type: string | null;
  image_url: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  cart: Record<string, CartItem>;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalValue: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  // 1. UPGRADE: Check Long-Term Memory when the app opens
  const [cart, setCart] = useState<Record<string, CartItem>>(() => {
    try {
      const savedCart = localStorage.getItem("oasis_cart");
      return savedCart ? JSON.parse(savedCart) : {};
    } catch (error) {
      return {};
    }
  });

  // 2. UPGRADE: Save to Long-Term Memory every single time a button is clicked
  useEffect(() => {
    localStorage.setItem("oasis_cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const currentQty = prev[product.id]?.quantity || 0;
      return {
        ...prev,
        [product.id]: { product, quantity: currentQty + quantity },
      };
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const item = prev[productId];
      if (!item) return prev;

      const newQty = Math.max(0, item.quantity + delta);
      const newCart = { ...prev };

      if (newQty === 0) {
        delete newCart[productId];
      } else {
        newCart[productId] = { ...item, quantity: newQty };
      }
      return newCart;
    });
  };

  const clearCart = () => {
    setCart({});
    localStorage.removeItem("oasis_cart"); // Wipe memory after successful order
  };

  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = cartItems.reduce((sum, item) => sum + item.product.price_per_kg * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, clearCart, totalItems, totalValue }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
