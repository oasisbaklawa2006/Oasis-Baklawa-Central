const HomeFooter = () => (
  <footer className="px-5 py-8 text-center space-y-3">
    <div className="w-12 h-[1px] bg-primary mx-auto mb-4" />
    <div className="flex items-center justify-center gap-4 flex-wrap text-[10px] font-body text-muted-foreground tracking-wide">
      {["About", "Contact", "Terms", "Privacy"].map((item, i) => (
        <span key={item} className="flex items-center gap-4">
          {i > 0 && <span className="text-border">·</span>}
          <button className="hover:text-foreground transition-colors">{item}</button>
        </span>
      ))}
    </div>
    <p className="text-[10px] font-body text-muted-foreground/60">
      © 2026 TCF Chocolates and Gifts Pvt Ltd
    </p>
  </footer>
);

export default HomeFooter;
