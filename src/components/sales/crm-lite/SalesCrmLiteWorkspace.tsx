import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertCircle, Bell, Star, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SalesCrmAssistPanel from "@/components/sales/crm-lite/SalesCrmAssistPanel";
import CreditRequestModal from "@/components/CreditRequestModal";
import { resolveCreditBinding } from "@/lib/order-authority/creditWalletAuthorityClient";
import { parseCrmLiteTickets } from "@/lib/crm-lite/parseCrmLiteTickets";
import type { CrmLiteCompany, CrmLiteInteraction, CrmLiteTask, CrmLiteTicket, GovernedCreditOrder } from "@/lib/crm-lite/salesCrmLiteTypes";

interface Props {
  userId: string;
  companies: CrmLiteCompany[];
  assistFocusCompanyId?: string | null;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");

export default function SalesCrmLiteWorkspace({ userId, companies, assistFocusCompanyId }: Props) {
  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);
  const companyMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c.business_name || "Unknown"])), [companies]);

  const [activeTab, setActiveTab] = useState("assist");

  const [loading, setLoading] = useState(true);
  const [dueFollowUps, setDueFollowUps] = useState<CrmLiteInteraction[]>([]);
  const [tasks, setTasks] = useState<CrmLiteTask[]>([]);
  const [tickets, setTickets] = useState<CrmLiteTicket[]>([]);
  const [creditOrders, setCreditOrders] = useState<GovernedCreditOrder[]>([]);

  const [taskForm, setTaskForm] = useState({ companyId: "", taskType: "follow_up", dueDate: todayIso(), description: "" });
  const [taskSaving, setTaskSaving] = useState(false);

  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditCompany, setCreditCompany] = useState<CrmLiteCompany | null>(null);
  const [creditOrderId, setCreditOrderId] = useState<string | null>(null);
  const [creditPiId, setCreditPiId] = useState<string | null>(null);
  const [creditCommercialVersionId, setCreditCommercialVersionId] = useState<string | null>(null);
  const [creditBindingLoading, setCreditBindingLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (companyIds.length === 0) {
      setDueFollowUps([]);
      setTasks([]);
      setTickets([]);
      setCreditOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const today = todayIso();

    const [followUpRes, taskRes, orderRes] = await Promise.all([
      supabase
        .from("client_interactions")
        .select("id, company_id, interaction_type, notes, outcome, follow_up_date, created_at, executive_id")
        .in("company_id", companyIds)
        .eq("executive_id", userId)
        .not("follow_up_date", "is", null)
        .lte("follow_up_date", today)
        .order("follow_up_date", { ascending: true }),
      supabase
        .from("crm_tasks")
        .select("id, company_id, sales_exec_id, task_type, status, due_date, description, completed_at, created_at")
        .eq("sales_exec_id", userId)
        .in("company_id", companyIds)
        .order("due_date", { ascending: true }),
      supabase
        .from("orders")
        .select("id, company_id, order_number, sales_order_value, status, created_at")
        .in("company_id", companyIds)
        .not("status", "in", '("draft","cart","cancelled")')
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    setDueFollowUps((followUpRes.data as CrmLiteInteraction[]) ?? []);
    setTasks((taskRes.data as CrmLiteTask[]) ?? []);

    const orders = (orderRes.data ?? []) as GovernedCreditOrder[];
    const bindingChecks = await Promise.all(
      orders.map(async (order) => {
        try {
          await resolveCreditBinding(order.id);
          return { ...order, bindingReady: true };
        } catch {
          return { ...order, bindingReady: false };
        }
      }),
    );
    setCreditOrders(bindingChecks);

    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const { data: ticketRows } = await supabase
      .from("support_tickets")
      .select(
        "id, order_id, issue_type, status, severity, created_at, commission_blocked, customer_rating, admin_rating_speed, admin_rating_quality, admin_rating_communication, sla_resolution_due, sla_resolved_at, order:orders(company_id, order_number)",
      )
      .in("order_id", orderIds)
      .order("created_at", { ascending: false })
      .limit(50);

    setTickets(parseCrmLiteTickets(ticketRows));
    setLoading(false);
  }, [companyIds, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (assistFocusCompanyId) {
      setActiveTab("assist");
    }
  }, [assistFocusCompanyId]);

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const overdueTasks = pendingTasks.filter((t) => t.due_date < todayIso());
  const openTickets = tickets.filter((t) => t.status !== "resolved");
  const commissionRiskTickets = openTickets.filter(
    (t) => t.commission_blocked || (t.customer_rating != null && t.customer_rating <= 2),
  );

  const handleCreateTask = async () => {
    if (!taskForm.companyId || !taskForm.dueDate) {
      toast({ title: "Required", description: "Select a client and due date.", variant: "destructive" });
      return;
    }
    setTaskSaving(true);
    const { error } = await supabase.from("crm_tasks").insert({
      company_id: taskForm.companyId,
      sales_exec_id: userId,
      task_type: taskForm.taskType,
      status: "pending",
      due_date: taskForm.dueDate,
      description: taskForm.description.trim() || null,
    });
    setTaskSaving(false);
    if (error) {
      toast({ title: "Task not saved", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Follow-up task created" });
    setTaskForm({ companyId: "", taskType: "follow_up", dueDate: todayIso(), description: "" });
    void refresh();
  };

  const handleCompleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("crm_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) {
      toast({ title: "Could not complete task", description: error.message, variant: "destructive" });
      return;
    }
    void refresh();
  };

  const handleCreateTaskFromFollowUp = async (interaction: CrmLiteInteraction) => {
    if (!interaction.company_id || !interaction.follow_up_date) return;
    const { error } = await supabase.from("crm_tasks").insert({
      company_id: interaction.company_id,
      sales_exec_id: userId,
      task_type: "repeat_contact",
      status: "pending",
      due_date: interaction.follow_up_date,
      description: interaction.notes ? `Repeat contact: ${interaction.notes}` : "Repeat contact from CRM follow-up",
    });
    if (error) {
      toast({ title: "Task not created", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Repeat-contact task created" });
    void refresh();
  };

  const openCreditRequest = async (company: CrmLiteCompany, orderId: string) => {
    setCreditBindingLoading(true);
    setCreditCompany(company);
    setCreditOrderId(orderId);
    try {
      const binding = await resolveCreditBinding(orderId);
      setCreditPiId(binding.piId);
      setCreditCommercialVersionId(binding.commercialVersionId);
      setCreditModalOpen(true);
    } catch (error) {
      toast({
        title: "Governed SO unavailable",
        description: error instanceof Error ? error.message : "PI/commercial binding missing for this order.",
        variant: "destructive",
      });
      setCreditCompany(null);
      setCreditOrderId(null);
    }
    setCreditBindingLoading(false);
  };

  const tierLabel = (tier: string | null | undefined) => {
    if (!tier) return "Standard";
    return tier.replace(/_/g, " ");
  };

  if (loading && companyIds.length > 0) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" size={22} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">CRM-lite workspace</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sales assistance, repeat-contact queue, credit/pricing linkage, first-line tickets, and commission feedback for your roster.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="assist">Assist</TabsTrigger>
              <TabsTrigger value="followups" className="gap-1">
                Follow-ups
                {(dueFollowUps.length + overdueTasks.length) > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{dueFollowUps.length + overdueTasks.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="credit">Credit &amp; pricing</TabsTrigger>
              <TabsTrigger value="tickets" className="gap-1">
                Tickets
                {openTickets.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{openTickets.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="commission">Commission</TabsTrigger>
            </TabsList>

            <TabsContent value="assist" className="mt-4">
              <SalesCrmAssistPanel companies={companies} userId={userId} focusCompanyId={assistFocusCompanyId} />
            </TabsContent>

            <TabsContent value="followups" className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <Bell size={16} /> Repeat-contact queue
                </div>
                <p className="mt-1 text-xs text-amber-800">
                  Follow-ups at or past due date surface here. Create a CRM task to track the next touchpoint.
                </p>
              </div>

              {dueFollowUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No due follow-ups on your roster.</p>
              ) : (
                <div className="space-y-2">
                  {dueFollowUps.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{companyMap[item.company_id || ""] || "Client"}</p>
                        <p className="text-xs text-muted-foreground">{item.notes}</p>
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          Due {item.follow_up_date ? format(new Date(item.follow_up_date), "dd MMM yyyy") : "—"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void handleCreateTaskFromFollowUp(item)}>
                        Create repeat-contact task
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Client</label>
                  <Select value={taskForm.companyId} onValueChange={(v) => setTaskForm((p) => ({ ...p, companyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Task type</label>
                  <Select value={taskForm.taskType} onValueChange={(v) => setTaskForm((p) => ({ ...p, taskType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="repeat_contact">Repeat contact</SelectItem>
                      <SelectItem value="sample">Sample</SelectItem>
                      <SelectItem value="opportunity">Opportunity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Due date</label>
                  <Input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
                  <Textarea value={taskForm.description} onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))} rows={2} />
                </div>
                <Button size="sm" disabled={taskSaving} onClick={() => void handleCreateTask()}>
                  {taskSaving ? <Loader2 className="animate-spin" size={14} /> : "Add CRM task"}
                </Button>
              </div>

              {pendingTasks.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>{companyMap[task.company_id || ""] || "—"}</TableCell>
                        <TableCell className="text-xs uppercase">{task.task_type}</TableCell>
                        <TableCell className={task.due_date < todayIso() ? "text-destructive font-semibold" : ""}>
                          {format(new Date(task.due_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {task.due_date < todayIso() ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="secondary">Pending</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => void handleCompleteTask(task.id)}>Complete</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="credit" className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Company tier and discount come from CRM onboarding. Credit requests use governed SO/PI/commercial-version binding via Core PF-6B authority.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead className="text-right">Credit limit</TableHead>
                    <TableHead>Governed SO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => {
                    const companyOrders = creditOrders.filter((o) => o.company_id === company.id && o.bindingReady);
                    return (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.business_name}</TableCell>
                        <TableCell><Badge variant="outline">{tierLabel(company.price_tier)}</Badge></TableCell>
                        <TableCell>{company.discount_percentage ? `${company.discount_percentage}%` : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">₹{(company.credit_limit || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          {companyOrders.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No PI-bound SO</span>
                          ) : (
                            <Select
                              onValueChange={(orderId) => void openCreditRequest(company, orderId)}
                              disabled={creditBindingLoading}
                            >
                              <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue placeholder="Request credit…" />
                              </SelectTrigger>
                              <SelectContent>
                                {companyOrders.map((order) => (
                                  <SelectItem key={order.id} value={order.id}>
                                    {order.order_number || order.id.slice(0, 8)} · ₹{(order.sales_order_value || 0).toLocaleString()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="tickets" className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  First-line view of support tickets on your roster orders (via order → company linkage).
                </p>
                <Button asChild size="sm" variant="outline" className="gap-1 text-xs">
                  <Link to="/admin/support"><ExternalLink size={12} /> Full support queue</Link>
                </Button>
              </div>
              {openTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open tickets on your assigned clients.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-xs">{ticket.order?.order_number || ticket.order_id.slice(0, 8)}</TableCell>
                        <TableCell>{companyMap[ticket.order?.company_id || ""] || "—"}</TableCell>
                        <TableCell className="text-xs">{ticket.issue_type}</TableCell>
                        <TableCell><Badge variant="outline">{ticket.status}</Badge></TableCell>
                        <TableCell className="space-x-1">
                          {ticket.commission_blocked && <Badge variant="destructive">Commission blocked</Badge>}
                          {ticket.severity === "critical" && <Badge variant="destructive">Critical</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="commission" className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Open tickets</p>
                    <p className="text-2xl font-semibold">{openTickets.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Commission-risk tickets</p>
                    <p className="text-2xl font-semibold text-destructive">{commissionRiskTickets.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Low customer ratings (≤2)</p>
                    <p className="text-2xl font-semibold">{openTickets.filter((t) => t.customer_rating != null && t.customer_rating <= 2).length}</p>
                  </CardContent>
                </Card>
              </div>

              {commissionRiskTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No commission-impact tickets on your roster.</p>
              ) : (
                <div className="space-y-2">
                  {commissionRiskTickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Star size={16} className="mt-0.5 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">
                          {ticket.order?.order_number || ticket.order_id.slice(0, 8)} · {companyMap[ticket.order?.company_id || ""] || "Client"}
                        </p>
                        <p className="text-xs text-muted-foreground">{ticket.issue_type} · {ticket.status}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {ticket.commission_blocked && <Badge variant="destructive">Commission blocked</Badge>}
                          {ticket.customer_rating != null && <Badge variant="secondary">Customer rating {ticket.customer_rating}/5</Badge>}
                          {ticket.admin_rating_quality != null && <Badge variant="outline">Quality {ticket.admin_rating_quality}/5</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Read-only roster lens. Payout settlement remains on Finance and Sales Performance Hub; ticket feedback fields are surfaced here for executive awareness.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <CreditRequestModal
        open={creditModalOpen}
        onClose={() => {
          setCreditModalOpen(false);
          setCreditCompany(null);
          setCreditOrderId(null);
          setCreditPiId(null);
          setCreditCommercialVersionId(null);
        }}
        company={creditCompany ? { id: creditCompany.id, business_name: creditCompany.business_name || "Client" } : null}
        orderId={creditOrderId}
        proformaInvoiceId={creditPiId}
        commercialVersionId={creditCommercialVersionId}
      />
    </>
  );
}
