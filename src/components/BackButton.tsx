import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // The button will hide itself on these root pages
  const rootPages = ['/', '/admin', '/account', '/login'];
  const isRootPage = rootPages.includes(location.pathname);

  if (isRootPage) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-4 -mb-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2.5 text-sm font-bold text-muted-foreground hover:text-primary transition-all group w-max"
      >
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors border border-transparent group-hover:border-primary/20">
          <ArrowLeft size={16} />
        </div>
        Back
      </button>
    </div>
  );
};

export default BackButton;
