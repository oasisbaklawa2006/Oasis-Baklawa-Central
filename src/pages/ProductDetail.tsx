import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { useState } from "react";
import { Heart, ShoppingCart, Minus, Plus, AlertTriangle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

import pistachioImg from "@/assets/baklawa-pistachio.jpg";

const product = {
  name: "Turkish Pistachio Baklawa",
  price: "₹2,250",
  priceNote: "per kg + taxes",
  packSize: "1kg",
  category: "C",
  minPacks: 3,
  cartonSize: 9,
  image: pistachioImg,
  description:
    "Hand-layered with 40 sheets of paper-thin phyllo, filled with premium Antep pistachios sourced from Gaziantep, Turkey. Each piece is bathed in a light rose-water syrup and finished with a crown of crushed green pistachios. A centuries-old recipe perfected by Oasis Baklawa's master craftsmen.",
  ingredients: [
    "Wheat flour", "Clarified butter (Ghee)", "Pistachios (28%)", "Sugar",
    "Rose water", "Corn starch", "Salt",
  ],
  nutrition: [
    { label: "Energy", value: "428 kcal" },
    { label: "Total Fat", value: "22g" },
    { label: "Saturated Fat", value: "9g" },
    { label: "Carbohydrates", value: "52g" },
    { label: "Sugars", value: "30g" },
    { label: "Protein", value: "8g" },
    { label: "Salt", value: "0.3g" },
  ],
  shelfLife: "45 Days",
  storage: "Ambient (Cool & Dry)",
  cartonCategory: "C (9 Packs/Carton)",
};

const ProductDetail = () => {
  const [qty, setQty] = useState(product.minPacks);
  const [isFav, setIsFav] = useState(false);
  const navigate = useNavigate();

  const adjustQty = (delta: number) => {
    setQty((prev) => {
      const next = prev + delta;
      if (next < product.minPacks) return product.minPacks;
      if (next > product.cartonSize * 3) return prev;
      return next;
    });
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden"
        >
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => setIsFav(!isFav)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center shadow-card hover:bg-card transition-colors"
          >
            <Heart
              size={20}
              className={isFav ? "text-primary fill-primary" : "text-muted-foreground"}
            />
          </button>
        </motion.div>

        <div className="px-5 py-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <h1 className="font-display text-2xl tracking-wide text-foreground">
              {product.name}
            </h1>
            <p className="font-body text-lg text-foreground font-bold">
              {product.price}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {product.priceNote}
              </span>
            </p>
            <p className="font-body text-xs text-muted-foreground">
              Pack Size: {product.packSize}
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="w-full bg-muted/60 rounded-xl p-1">
                <TabsTrigger
                  value="description"
                  className="flex-1 rounded-lg font-body text-xs data-[state=active]:bg-card data-[state=active]:shadow-card"
                >
                  Description
                </TabsTrigger>
                <TabsTrigger
                  value="nutrition"
                  className="flex-1 rounded-lg font-body text-xs data-[state=active]:bg-card data-[state=active]:shadow-card"
                >
                  Ingredients
                </TabsTrigger>
                <TabsTrigger
                  value="logistics"
                  className="flex-1 rounded-lg font-body text-xs data-[state=active]:bg-card data-[state=active]:shadow-card"
                >
                  Logistics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="description" className="mt-4">
                <div className="bg-card rounded-2xl shadow-card p-5">
                  <p className="font-body text-sm text-foreground leading-relaxed">
                    {product.description}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="nutrition" className="mt-4">
                <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
                  <div>
                    <h3 className="font-body font-bold text-foreground text-sm mb-2">Ingredients</h3>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed">
                      {product.ingredients.join(", ")}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-body font-bold text-foreground text-sm mb-2">Nutrition (per 100g)</h3>
                    <div className="space-y-1.5">
                      {product.nutrition.map((n) => (
                        <div key={n.label} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                          <span className="font-body text-xs text-muted-foreground">{n.label}</span>
                          <span className="font-body text-xs font-semibold text-foreground">{n.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="logistics" className="mt-4">
                <div className="bg-card rounded-2xl shadow-card p-5 space-y-3">
                  {[
                    { label: "Shelf Life", value: product.shelfLife },
                    { label: "Storage", value: product.storage },
                    { label: "Carton Category", value: product.cartonCategory },
                    { label: "Min. Order Qty", value: `${product.minPacks} Packs (${product.packSize} each)` },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                      <span className="font-body text-xs text-muted-foreground">{row.label}</span>
                      <span className="font-body text-xs font-semibold text-foreground">{row.value}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Order Action */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl shadow-card p-5 space-y-4"
          >
            <h3 className="font-body font-bold text-foreground text-sm">Order Quantity</h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => adjustQty(-1)}
                  className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                >
                  <Minus size={16} className="text-foreground" />
                </button>
                <div className="text-center min-w-[60px]">
                  <p className="font-body font-bold text-foreground text-xl">{qty}</p>
                  <p className="font-body text-[11px] text-muted-foreground">× {product.packSize} Packs</p>
                </div>
                <button
                  onClick={() => adjustQty(1)}
                  className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                >
                  <Plus size={16} className="text-foreground" />
                </button>
              </div>
              <p className="font-body font-bold text-foreground text-lg">
                {product.price}
                <span className="text-xs font-normal text-muted-foreground"> /pack</span>
              </p>
            </div>

            {qty < product.minPacks && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/15">
                <AlertTriangle size={12} className="text-destructive" />
                <p className="font-body text-[11px] text-destructive font-medium">
                  Minimum {product.minPacks} packs required for Category {product.category}
                </p>
              </div>
            )}

            <button
              onClick={() => navigate("/cart")}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-body font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-fab"
            >
              <ShoppingCart size={18} />
              Add {qty} × {product.packSize} Packs to Cart
            </button>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
};

export default ProductDetail;
