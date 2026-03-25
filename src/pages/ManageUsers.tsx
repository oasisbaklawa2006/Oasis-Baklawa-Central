import AppShell from "@/components/AppShell";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, UserPlus, Shield, Mail, Trash2,
  Loader2, ArrowLeft, Building2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

const ManageUsers = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    mobile: "",
    role: "buyer_staff"
  });

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profile?.company_id) {
        setCompanyId(profile.company_id);

        const { data: companyData } = await supabase
          .from("companies")
          .select("business_name")
          .eq("id", profile.company_id)
          .single();
        if (companyData) setCompanyName(companyData.business_name);

        const { data: teamData } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: true });

        if (teamData) setTeam(teamData as unknown as TeamMember[]);
      }
    } catch (error) {
      console.error("Error fetching team:", error);
      toast.error("Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [navigate]);

  const handleInviteUser = async () => {
    if (!inviteForm.name || !inviteForm.email) {
      return toast.error("Name and Email are required.");
    }
    if (!companyId) return toast.error("Error: Company profile not found.");

    setIsInviting(true);
    try {
      const { error } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(),
        company_id: companyId,
        full_name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
        is_approved: true
      } as any);

      if (error) throw error;

      toast.success(`${inviteForm.name} has been added to your team.`);
      setShowModal(false);
      setInviteForm({ name: "", email: "", mobile: "", role: "buyer_staff" });
      fetchTeam();
    } catch (error: any) {
      toast.error(error.message || "Failed to add team member.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to remove ${userName} from your company account?`)) {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) {
        toast.error("Failed to remove user.");
      } else {
        toast.success("User removed successfully.");
        setTeam(team.filter(t => t.id !== userId));
      }
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="px-5 py-6 space-y-6 pt-24 max-w-4xl mx-auto pb-32">
        <button
          onClick={() => navigate("/account")}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} /> Back to Account
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wide text-foreground">
              Team Management
            </h1>
            <div className="flex items-center gap-2 mt-1 text-muted-foreground">
              <Building2 size={14} />
              <span className="text-sm font-medium">{companyName}</span>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-md hover:-translate-y-0.5"
          >
            <UserPlus size={16} /> Add Team Member
          </button>
        </div>

        <div className="bg-card rounded-3xl shadow-sm border border-border p-6 md:p-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-3">User Details</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-3">Contact</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-3">Access Role</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr key={member.id} className="border-b last:border-0 border-border hover:bg-muted/50 transition-colors">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {member.full_name?.charAt(0) || <Users size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{member.full_name || "Unnamed User"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail size={12} /> {member.email}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        <Shield size={12} />
                        {member.role === 'buyer' ? "Admin Buyer" : "Standard Staff"}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => handleRemoveUser(member.id, member.full_name || "User")}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Remove User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Invite Team Member</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Invite colleagues to place orders for {companyName}. They will share your company's credit limit and price tier.
          </p>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm(p => ({ ...p, name: e.target.value }))}
                className="rounded-xl h-11 border-border focus-visible:ring-primary"
                placeholder="e.g. Rahul Kumar"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input
                value={inviteForm.email}
                onChange={(e) => setInviteForm(p => ({ ...p, email: e.target.value }))}
                className="rounded-xl h-11 border-border focus-visible:ring-primary"
                placeholder="rahul@company.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mobile (Optional)</Label>
                <Input
                  value={inviteForm.mobile}
                  onChange={(e) => setInviteForm(p => ({ ...p, mobile: e.target.value }))}
                  className="rounded-xl h-11 border-border focus-visible:ring-primary"
                  placeholder="+91..."
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Level</Label>
                <Select value={inviteForm.role} onValueChange={(v) => setInviteForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer_staff">Standard Staff</SelectItem>
                    <SelectItem value="buyer">Admin Buyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <button
              onClick={handleInviteUser}
              disabled={isInviting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md disabled:opacity-50"
            >
              {isInviting ? <Loader2 size={16} className="animate-spin" /> : "Send Invitation"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default ManageUsers;
