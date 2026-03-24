import AiOrderModal from "@/components/AiOrderModal";
import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Receipt,
  UploadCloud,
  ChevronRight,
  FileText,
  AlertTriangle,
  X,
  Megaphone,
  Download,
  Ticket,
  TrendingUp,
  IndianRupee,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const Dashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Oasis Partner");

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Modal & Upload State
  const [utrModal, setUtrModal] = useState<{ isOpen: boolean; orderId: string | null; type: "advance" | "final" }>({
    isOpen: false,
    orderId: null,
    type: "advance",
  });
  const [utrRef, setUtrRef] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(*, product:products(name))")
      .order("created_at", { ascending: false });

    if (!error && orderData) {
      setOrders(orderData);
      if (orderData[0]?.company?.business_name) {
        setCompanyName(orderData[0].company.business_name);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUploadReceipt = async () => {
    if (!utrRef) {
      toast.error("Please enter the Bank Reference No. / Transaction ID.");
      return;
    }
    if (!selectedFile) {
      toast.error("Please attach a screenshot or PDF of the receipt.");
      return;
    }
    if (!utrModal.orderId) return;

    setIsUploading(true);

    try {
      // 1. Upload file to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `receipts/${utrModal.orderId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("trade_documents").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      // 2. Get the public URL safely without complex destructuring
      const urlResponse = supabase.storage.from("trade_documents").getPublicUrl(filePath);
      const publicUrl = urlResponse.data.publicUrl;

      // 3. Update the Order in the database
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: utrModal