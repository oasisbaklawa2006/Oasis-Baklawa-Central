const HomeFooter = () => (
  <footer className="px-4 py-8 text-center space-y-4">
    <div className="flex items-center justify-center gap-3 flex-wrap text-[10px] font-body font-semibold text-[#4A3623]/60 uppercase tracking-wider">
      {["About Us", "Contact", "Terms", "Privacy", "GST Details", "Address"].map((item, i) => (
        <span key={item} className="flex items-center gap-3">
          {i > 0 && <span className="text-[#C4A052]">|</span>}
          <button className="hover:text-[#C4A052] transition-colors">{item}</button>
        </span>
      ))}
    </div>
    <p className="text-[10px] font-body text-[#4A3623]/40">
      © 2026 TCF Chocolates and Gifts Pvt Ltd
    </p>
  </footer>
);

export default HomeFooter;
