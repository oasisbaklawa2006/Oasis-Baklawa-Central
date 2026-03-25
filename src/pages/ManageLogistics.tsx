import AppShell from "@/components/AppShell";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Truck, Save, Loader2, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ManageLogistics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    preferred_courier: "",
    courier_account_number: ""
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
        if (profile?.company_id) {
          setCompanyId(profile.company_id);
          const { data: company } = await supabase.from("companies").select("preferred_courier, courier_account_number").eq("id", profile.company_id).single();
          if (company) {
            setFormData({
              preferred_courier: company.preferred_courier || "",
              courier_account_number: company.courier_account_number || ""
            });
          }
        }
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        preferred_courier: formData.preferred_courier,
        courier_account_number: formData.courier_account_number
      })
      .eq("id", companyId);

    if (error) toast.error("Failed to update logistics preferences.");
    else toast.success("Logistics preferences saved successfully.");
    setIsSaving(false);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-[#C5A059]" size={32} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pt-24 max-w-4xl mx-auto pb-32">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-gray-900">Preferred Transporter</h1>
          <p className="text-sm text-gray-500 mt-1">Setup your default logistics partner for bulk shipments.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/10 flex items-center justify-center border border-[#C5A059]/20">
              <Truck size={28} className="text-[#C5A059]" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-gray-900 text-xl">Logistics Configuration</h2>
              <p className="text-xs text-gray-500 mt-0.5">This helps our dispatch team route your cargo correctly.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              If left blank, Oasis Baklawa will assign the most cost-effective transporter based on your delivery pincode. Freight charges will be added to your final invoice.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="text-sm font-bold text-gray-700">Preferred Transport Company</Label>
              <Input
                value={formData.preferred_courier}
                onChange={(e) => setFormData({...formData, preferred_courier: e.target.value})}
                className="rounded-xl h-12 focus-visible:ring-[#C5A059] mt-1.5"
                placeholder="e.g. Safexpress, VRL Logistics, Delhivery"
              />
            </div>

            <div>
              <Label className="text-sm font-bold text-gray-700">Your Transport Account / To-Pay Details</Label>
              <Input
                value={formData.courier_account_number}
                onChange={(e) => setFormData({...formData, courier_account_number: e.target.value})}
                className="rounded-xl h-12 focus-visible:ring-[#C5A059] mt-1.5"
                placeholder="Account # or specific branch instructions"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#C5A059] text-white font-bold text-sm hover:bg-[#B38F48] transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Logistics Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default ManageLogistics;
