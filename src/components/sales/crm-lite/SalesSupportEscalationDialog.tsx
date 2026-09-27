import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { submitSalesSupportTicket } from "@/lib/sales-crm/salesSupportHandoff";

const ISSUE_TYPES = [
  "Order status",
  "Quality / damage",
  "Delivery delay",
  "Pricing / commercial",
  "Other",
];

type OrderOption = { orderId: string; orderNumber: string | null };

export default function SalesSupportEscalationDialog({
  open,
  onOpenChange,
  orders,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderOption[];
  onSubmitted?: () => void;
}) {
  const [orderId, setOrderId] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!orderId || !issueType || description.trim().length < 8) {
      toast({
        title: "Required fields",
        description: "Select an order, issue type, and describe the escalation (min 8 characters).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await submitSalesSupportTicket({ orderId, issueType, description });
      toast({ title: "Support ticket escalated", description: "The governed support queue will pick this up." });
      setOrderId("");
      setIssueType("");
      setDescription("");
      onOpenChange(false);
      onSubmitted?.();
    } catch (error) {
      toast({
        title: "Escalation failed",
        description: error instanceof Error ? error.message : "Could not submit support ticket.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escalate to support</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Creates a governed support ticket via Core <code className="rounded bg-muted px-1">submit_customer_support_ticket_v1</code>.
            Sales staff cannot access the admin support queue.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Order</label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.orderId} value={order.orderId}>
                    {order.orderNumber ?? order.orderId.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Issue type</label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger><SelectValue placeholder="Select issue" /></SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does support need to do?"
              rows={4}
            />
          </div>
          <Button className="w-full" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Submit escalation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
