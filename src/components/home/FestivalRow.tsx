import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const FESTIVALS = [
  { name: "WEDDING", period: "Sep-Mar", bg: "#6B1D2A", icon: "💍" },
  { name: "DIWALI", period: "Sep-Nov", bg: "#8B4513", icon: "🪔" },
  { name: "BABY", period: "Jan-Dec", bg: "#2E7D32", icon: "👶" },
  { name: "EID", period: "Jan-Feb", bg: "#1B5E20", icon: "🌙" },
  { name: "CHRISTMAS", period: "Dec-Jan", bg: "#1A237E", icon: "🎄" },
  { name: "RAKSHABANDHAN", period: "Jul-Aug", bg: "#C4A052", icon: "🎀" },
];

const FestivalRow = () => {
  const navigate = useNavigate();

  return (
    <section className="px-4">
      <p className="text-[10px] font-body font-semibold tracking-[0.2em] uppercase text-[#C4A052] mb-4">
        FESTIVALS & EVENTS
      </p>
      <div className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 snap-x">
        {FESTIVALS.map((f) => (
          <motion.button
            key={f.name}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/catalogue?category=Gifting&festival=${f.name.toLowerCase()}`)}
            className="min-w-[110px] h-[130px] rounded-2xl overflow-hidden relative snap-start flex-shrink-0"
            style={{ backgroundColor: f.bg }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-2">
              <span className="text-3xl mb-2">{f.icon}</span>
              <span className="text-[10px] font-body font-bold tracking-wider uppercase">{f.name}</span>
              <span className="text-[9px] font-body text-white/70 mt-0.5">{f.period}</span>
            </div>
            {/* Gold line art accent */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C4A052]/60" />
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default FestivalRow;
