import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import giftingImage from "@/assets/gifting-story.jpg";

const GiftingStoryBlock = () => {
  const navigate = useNavigate();

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="mx-5 mb-8 relative rounded-2xl overflow-hidden"
      style={{ height: 200 }}
    >
      <img
        src={giftingImage}
        alt="Premium Gifting"
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        width={1024}
        height={640}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center px-6 z-10">
        <p className="font-body text-[8px] tracking-[0.3em] uppercase text-primary/80 mb-2">
          The Art of Giving
        </p>
        <h3 className="font-display text-[22px] leading-[1.15] text-white mb-1">
          Designed for<br />Gifting
        </h3>
        <p className="font-body text-[10px] text-white/50 tracking-wider mb-4">
          Crafted for Impressions
        </p>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/catalogue?category=Premium%20Gift%20Packs")}
          className="self-start font-body text-[9px] tracking-[0.2em] uppercase text-white border border-primary/50 rounded-full px-5 py-1.5 backdrop-blur-sm bg-primary/15 hover:bg-primary/25 transition-colors"
        >
          Explore Gift Range
        </motion.button>
      </div>
    </motion.section>
  );
};

export default GiftingStoryBlock;
