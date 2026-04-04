import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const BackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const rootPages = ['/', '/home', '/admin', '/account', '/login', '/dashboard'];
  const isRootPage = rootPages.includes(location.pathname);

  if (isRootPage) return null;

  return (
    <button
      onClick={() => navigate(-1)}
      className="fixed top-[62px] left-4 z-40 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-lg bg-card/80 border border-border shadow-md hover:bg-primary/10 hover:border-primary/20 transition-all"
      aria-label="Go back"
    >
      <ArrowLeft size={16} className="text-foreground" />
    </button>
  );
};

export default BackButton;
