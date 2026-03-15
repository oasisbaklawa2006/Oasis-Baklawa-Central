import { motion } from "framer-motion";
import promoImg from "@/assets/promo-festive.jpg";

const PromoBanner = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl shadow-card overflow-hidden relative"
    >
      <img
        src={promoImg}
        alt="Festive Special Offer"
        className="w-full h-[200px] object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent flex flex-col justify-center px-8">
        <p className="font-body text-xs font-semibold tracking-[0.2em] uppercase text-primary mb-2">
          Limited Time
        </p>
        <h3 className="font-display text-2xl text-card tracking-wide leading-tight">
          Festive Special<br />Offer
        </h3>
        <button className="mt-4 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-body font-semibold text-xs tracking-wide w-fit hover:opacity-90 transition-opacity">
          View Offer
        </button>
      </div>
    </motion.div>
  );
};

export default PromoBanner;
