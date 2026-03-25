import AppShell from "@/components/AppShell";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Loader2, ArrowLeft, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Address {
  id: string;
  label: string;
  street_address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string | null;
  contact_phone: string | null;
  is_default: boolean | null;
}

const ManageAddresses = () => {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: "", street_address: "", city: "", state: "", pincode: "", contact_person: "", contact_phone: ""
  });

  const fetchAddresses = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      if (profile?.company_id) {
        setCompanyId(profile.company_id);
        const { data } = await supabase.from("delivery_addresses").select("*").eq("company_id", profile.company_id).order("is_default", { ascending: false });
        if (data) setAddresses(data as Address[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchAddresses(); }, []);

  const handleSaveAddress = async () => {
    if (!newAddress.label || !newAddress.street_address || !newAddress.city || !newAddress.state || !newAddress.pincode) {
      return toast.error("Please fill in the required fields.");
    }
    setIsSaving(true);
    const isFirst = addresses.length === 0;

    const { error } = await supabase.from("delivery_addresses").insert({
      company_id: companyId,
      ...newAddress,
      is_default: isFirst
    });

    if (error) toast.error("Failed to add address.");
    else {
      toast.success("Address added successfully!");
      setShowModal(false);
      setNewAddress({ label: "", street_address: "", city: "", state: "", pincode: "", contact_person: "", contact_phone: "" });
      fetchAddresses();
    }
    setIsSaving(false);
  };

  const setAsDefault = async (id: string) => {
    await supabase.from("delivery_addresses").update({ is_default: false }).eq("company_id", companyId!);
    await supabase.from("delivery_addresses").update({ is_default: true }).eq("id", id);
    toast.success("Default delivery address updated.");
    fetchAddresses();
  };

  const deleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    await supabase.from("delivery_addresses").delete().eq("id", id);
    toast.success("Address removed.");
    fetchAddresses();
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
        <button onClick={() => navigate("/account")} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#C5A059] transition-colors mb-4">
          <ArrowLeft size={16} /> Back to Account
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-gray-900">Delivery Addresses</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your warehouse and outlet locations.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-[#C5A059] text-white hover:bg-[#B38F48] transition-all shadow-md hover:-translate-y-0.5">
            <Plus size={16} /> Add New Address
          </button>
        </div>

        <div className="space-y-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative">
              {addr.is_default && (
                <span className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#C5A059] bg-[#C5A059]/10 px-3 py-1 rounded-full">
                  <Star size={12} /> Default
                </span>
              )}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-[#C5A059]" />
                  <h3 className="font-bold text-gray-900">{addr.label}</h3>
                </div>
                <button onClick={() => deleteAddress(addr.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="ml-8 space-y-1">
                <p className="text-sm text-gray-700">{addr.street_address}</p>
                <p className="text-sm text-gray-500">{addr.city}, {addr.state} {addr.pincode}</p>
                {(addr.contact_person || addr.contact_phone) && (
                  <p className="text-xs text-gray-400 mt-2">
                    Attn: {addr.contact_person} ({addr.contact_phone})
                  </p>
                )}
              </div>

              {!addr.is_default && (
                <button onClick={() => setAsDefault(addr.id)} className="ml-8 mt-3 text-xs font-bold text-[#C5A059] hover:underline">
                  Set as Default Delivery Location
                </button>
              )}
            </div>
          ))}

          {addresses.length === 0 && (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">No delivery addresses saved yet.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Delivery Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Location Label (e.g. Warehouse 1) *</Label>
              <Input value={newAddress.label} onChange={(e) => setNewAddress({...newAddress, label: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
            </div>
            <div>
              <Label>Street Address *</Label>
              <Input value={newAddress.street_address} onChange={(e) => setNewAddress({...newAddress, street_address: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City *</Label>
                <Input value={newAddress.city} onChange={(e) => setNewAddress({...newAddress, city: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
              </div>
              <div>
                <Label>Pincode *</Label>
                <Input value={newAddress.pincode} onChange={(e) => setNewAddress({...newAddress, pincode: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
              </div>
            </div>
            <div>
              <Label>State *</Label>
              <Input value={newAddress.state} onChange={(e) => setNewAddress({...newAddress, state: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Person</Label>
                <Input value={newAddress.contact_person} onChange={(e) => setNewAddress({...newAddress, contact_person: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input value={newAddress.contact_phone} onChange={(e) => setNewAddress({...newAddress, contact_phone: e.target.value})} className="rounded-xl h-11 focus-visible:ring-[#C5A059]" />
              </div>
            </div>
            <button onClick={handleSaveAddress} disabled={isSaving} className="w-full py-3.5 rounded-xl bg-[#C5A059] text-white font-bold text-sm hover:bg-[#B38F48] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Save Address"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default ManageAddresses;
