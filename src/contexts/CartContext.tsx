import { CartProvider } from "@/contexts/CartContext";
import React, { createContext, useContext, useState } from "react";
import { toast } from "sonner";

// The shape of our product data
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

// What the Brain can do
interface CartContextType {
  cart: Record<string, CartItem>;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalValue: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<Record<string, CartItem>>({});

  // Add an item and show a premium notification
  const addToCart = (product: Product, quantity = 1) => {
    setCart((prev) => {
      const currentQty = prev[product.id]?.quantity || 0;
      toast.success(`${product.name} added to your batch.`);
      return {
        ...prev,
        [product.id]: { product, quantity: currentQty + quantity },
      };
    });
  };

  // Adjust quantities (+ or -)
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

  // Wipe the cart clean after a successful order
  const clearCart = () => setCart({});

  // Live Math calculations
  const cartItems = Object.values(cart);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = cartItems.reduce((sum, item) => sum + item.product.price_per_kg * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, updateQuantity, clearCart, totalItems, totalValue }}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook so any page can talk to the Brain
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
