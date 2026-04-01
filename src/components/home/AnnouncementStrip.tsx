import { motion } from "framer-motion";

const ANNOUNCEMENTS = [
  "Now shipping across 24 states",
  "Export-ready packaging available",
  "Festive orders now open",
  "Bulk trade pricing on 500+ SKUs",
];

const AnnouncementStrip = () => (
  <div className="w-full bg-primary/8 overflow-hidden py-2">
    <motion.div
      className="flex whitespace-nowrap gap-12"
      animate={{ x: ["0%", "-50%"] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    >
      {[...ANNOUNCEMENTS, ...ANNOUNCEMENTS].map((text, i) => (
        <span
          key={i}
          className="font-body text-[9px] tracking-[0.2em] uppercase text-primary/70 flex items-center gap-3"
        >
          <span className="w-1 h-1 rounded-full bg-primary/40" />
          {text}
        </span>
      ))}
    </motion.div>
  </div>
);

export default AnnouncementStrip;
