import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ClipboardList,
  CreditCard,
  Loader2,
  MessageSquare,
  Package,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomer360 } from "@/hooks/useCustomer360";
import type { Customer360Slice, Customer360SliceAvailability } from "@/lib/customer-360/customer360Types";

function availabilityBadge(availability: Customer360SliceAvailability) {
  switch (availability) {
    case "available":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Authoritative</Badge>;
    case "partial_crm_lite":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">CRM-lite partial</Badge>;
    case "unavailable_not_governed":
      return <Badge variant="outline">Not yet governed</Badge>;
    case "unavailable_core_prerequisite":
      return <Badge variant="outline">Core prerequisite pending</Badge>;
    case "unavailable_unlinked":
      return <Badge variant="outline">Unlinked</Badge>;
    case "error":
      return <Badge variant="destructive">Read error</Badge>;
    default:
      return null;
  }
}

function SliceUnavailable({ slice }: { slice: Customer360Slice<unknown> }) {
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Unavailable — {slice.programmeOwner}</p>
      <p className="mt-1">{slice.reason ?? slice.errorMessage ?? "This slice is not yet governed."}</p>
      {slice.corePrerequisiteId && (
        <p className="mt-2 text-xs">
          Core prerequisite: <code className="rounded bg-muted px-1 py-0.5">{slice.corePrerequisiteId}</code>
        </p>
      )}
    </div>
  );
}

export default function Customer360Page() {
  const { companyId } = useParams<{ companyId: string }>();
  const { state, refresh } = useCustomer360(companyId);

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.status === "identity_error" || state.status === "error") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Customer 360 access blocked</h1>
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Button asChild variant="outline">
          <Link to="/admin/clients">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to client governance
          </Link>
        </Button>
      </div>
    );
  }

  const { model } = state;
  const profile = model.profile.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 px-0">
            <Link to="/admin/clients">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Client governance
            </Link>
          </Button>
          <h1 className="flex items-center gap-3 text-2xl font-bold">
            <Users className="h-7 w-7 text-[#B8860B]" />
            Customer 360
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Canonical operational read model bound to company identity{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{model.identity.companyId}</code>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {profile && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>{profile.businessName}</CardTitle>
                  <CardDescription>
                    {profile.status ?? "unknown status"}
                    {profile.gstNumber ? ` · GST ${profile.gstNumber}` : ""}
                  </CardDescription>
                </div>
              </div>
              {availabilityBadge(model.profile.availability)}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Phone</p>
              <p className="font-medium">{profile.phone ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{profile.registeredAddress ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Credit limit</p>
              <p className="font-medium">₹{(profile.creditLimit ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wallet balance</p>
              <p className="font-medium">₹{(profile.walletBalance ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
              <p className="font-medium">₹{(profile.totalOutstanding ?? 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Branches & contacts
            </CardTitle>
            {availabilityBadge(model.branchesAndContacts.availability)}
          </div>
          {model.branchesAndContacts.reason && (
            <CardDescription>{model.branchesAndContacts.reason}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {model.branchesAndContacts.availability === "available" && model.branchesAndContacts.data ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Branches</p>
                {model.branchesAndContacts.data.branches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No governed branches linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {model.branchesAndContacts.data.branches.map((branch) => (
                      <li key={branch.branchId} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{branch.branchName}</p>
                        <p className="text-muted-foreground">
                          {[branch.branchType, branch.status].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Contacts</p>
                {model.branchesAndContacts.data.contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No governed contacts linked.</p>
                ) : (
                  <ul className="space-y-2">
                    {model.branchesAndContacts.data.contacts.map((contact) => (
                      <li key={contact.contactId} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{contact.displayName}</p>
                        <p className="text-muted-foreground">
                          {[contact.email, contact.phone, contact.membershipStatus]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <SliceUnavailable slice={model.branchesAndContacts} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" />
                Orders
              </CardTitle>
              {availabilityBadge(model.orders.availability)}
            </div>
          </CardHeader>
          <CardContent>
            {model.orders.availability === "available" && model.orders.data ? (
              model.orders.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active orders for this company.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.orders.data.map((order) => (
                      <TableRow key={order.orderId}>
                        <TableCell>
                          <Link
                            className="font-medium text-primary hover:underline"
                            to={`/admin/order-management?orderId=${order.orderId}`}
                          >
                            {order.orderNumber ?? order.orderId.slice(0, 8)}
                          </Link>
                          {order.createdAt && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.createdAt), "dd MMM yyyy")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{order.status ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          ₹{(order.salesOrderValue ?? 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : (
              <SliceUnavailable slice={model.orders} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5" />
                Support tickets
              </CardTitle>
              {availabilityBadge(model.tickets.availability)}
            </div>
          </CardHeader>
          <CardContent>
            {model.tickets.availability === "available" && model.tickets.data ? (
              model.tickets.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No support tickets linked via orders.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {model.tickets.data.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>{ticket.issueType}</TableCell>
                        <TableCell>{ticket.orderNumber ?? ticket.orderId.slice(0, 8)}</TableCell>
                        <TableCell>{ticket.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : (
              <SliceUnavailable slice={model.tickets} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Interactions
              </CardTitle>
              {availabilityBadge(model.interactions.availability)}
            </div>
            {model.interactions.reason && (
              <CardDescription>{model.interactions.reason}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {model.interactions.availability === "partial_crm_lite" && model.interactions.data ? (
              model.interactions.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No CRM-lite interactions recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {model.interactions.data.map((item) => (
                    <li key={item.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{item.interactionType ?? "interaction"}</p>
                      <p className="text-muted-foreground">{item.notes ?? "—"}</p>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <SliceUnavailable slice={model.interactions} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5" />
                Tasks & follow-ups
              </CardTitle>
              {availabilityBadge(model.tasks.availability)}
            </div>
            {model.tasks.reason && <CardDescription>{model.tasks.reason}</CardDescription>}
          </CardHeader>
          <CardContent>
            {model.tasks.availability === "partial_crm_lite" && model.tasks.data ? (
              model.tasks.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No CRM-lite tasks recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {model.tasks.data.map((task) => (
                    <li key={task.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">{task.taskType ?? "task"} · {task.status ?? "open"}</p>
                      <p className="text-muted-foreground">{task.description ?? "—"}</p>
                      {task.dueDate && (
                        <p className="mt-1 text-xs text-muted-foreground">Due {task.dueDate}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <SliceUnavailable slice={model.tasks} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Deferred programme slices
          </CardTitle>
          <CardDescription>
            Customer 360 surfaces only authoritative or explicitly blocked slices — no fabricated demo values.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <SliceUnavailable slice={model.communicationsLedger} />
          <SliceUnavailable slice={model.dispatchHistory} />
          <SliceUnavailable slice={model.financeExposure} />
          <SliceUnavailable slice={model.customerHealth} />
        </CardContent>
      </Card>
    </div>
  );
}
