import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home as HomeIcon, Package, ShoppingBag, UserRound, Search, Plus, Minus, Trash2, ArrowLeft, LifeBuoy, LogOut, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { customerAppClient, clearCheckoutIdempotencyKey, getCheckoutIdempotencyKey, type BuyerCompany, type BuyerDraftLine, type BuyerOrder, type BuyerOrderItem, type BuyerPrice, type BuyerTeamMember, type BuyerTicket } from "@/lib/customerApp/customerAppClient";

type Product = { id: string; name?: string | null; product_name?: string | null; sku?: string | null; description?: string | null; image_url?: string | null; category?: string | null; subcategory?: string | null; is_active?: boolean; visible_in_catalog?: boolean };

const money = (value: number | null | undefined) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const title = (p: Product | null | undefined) => p?.product_name || p?.name || "Oasis product";

function useBuyerData() {
  const [prices, setPrices] = useState<BuyerPrice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<BuyerDraftLine[]>([]);
  const [company, setCompany] = useState<BuyerCompany | null>(null);
  const [team, setTeam] = useState<BuyerTeamMember[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [items, setItems] = useState<BuyerOrderItem[]>([]);
  const [tickets, setTickets] = useState<BuyerTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [priceRows, productRows, draftRows, companyRows, orderRows, itemRows, ticketRows] = await Promise.all([
        customerAppClient.prices(),
        supabase.from("products").select("id,name,product_name,sku,description,image_url,category,subcategory,is_active,visible_in_catalog").eq("is_active", true).eq("visible_in_catalog", true),
        customerAppClient.draft(),
        customerAppClient.company(),
        customerAppClient.orders(),
        customerAppClient.items(),
        customerAppClient.tickets(),
      ]);
      if (productRows.error) throw productRows.error;
      setPrices(priceRows || []);
      setProducts((productRows.data || []) as Product[]);
      setDraft(draftRows || []);
      setCompany(companyRows?.[0] || null);
      setOrders(orderRows || []);
      setItems(itemRows || []);
      setTickets(ticketRows || []);
      try { setTeam(await customerAppClient.team()); } catch { setTeam([]); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load your account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { prices, products, draft, company, team, orders, items, tickets, loading, refresh, setDraft };
}

function BuyerNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const links = [["/buyer", "Home", HomeIcon], ["/buyer/catalogue", "Catalogue", ShoppingBag], ["/buyer/cart", "Cart", Package], ["/buyer/orders", "Orders", ShoppingBag], ["/buyer/account", "Account", UserRound]] as const;
  return <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur sm:sticky sm:top-0 sm:border-b sm:border-t-0"><div className="mx-auto flex max-w-6xl justify-around px-2 py-2 sm:justify-start sm:gap-8 sm:px-6">{links.map(([href, label, Icon]) => <button key={href} onClick={() => navigate(href)} className={`flex min-w-16 flex-col items-center gap-1 text-[11px] sm:flex-row sm:text-sm ${location.pathname === href ? "text-primary" : "text-muted-foreground"}`}><Icon size={18} /><span>{label}</span></button>)}</div></nav>;
}

function ProductCard({ product, price, onAdd, onBuy, onView }: { product: Product; price?: BuyerPrice; onAdd: (id: string, quantity: number) => void; onBuy: (id: string, quantity: number) => void; onView: (id: string) => void }) {
  const [quantity, setQuantity] = useState(Number(price?.minimum_order_quantity || 1));
  const minimum = Number(price?.minimum_order_quantity || 1);
  const increment = Number(price?.order_increment || 1);
  return <article className="rounded-2xl border bg-card p-4 shadow-sm"><button onClick={() => onView(product.id)} className="block w-full text-left"><div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-muted">{product.image_url ? <img src={product.image_url} alt={title(product)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl">🍪</div>}</div><p className="font-semibold">{title(product)}</p></button><p className="text-xs text-muted-foreground">{product.sku || "SKU pending"} · {price?.uom || "unit"}</p>{price ? <><p className="mt-2 text-lg font-bold text-primary">{money(price.selling_price)}</p><p className="text-[11px] text-muted-foreground">MOQ {minimum} {price.minimum_order_uom || price.uom || "units"}</p><div className="mt-3 flex items-center gap-2"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(minimum, quantity - increment))} className="rounded-lg border p-2"><Minus size={14} /></button><span className="min-w-10 text-center text-sm">{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(quantity + increment)} className="rounded-lg border p-2"><Plus size={14} /></button><button onClick={() => onAdd(product.id, quantity)} className="ml-auto rounded-lg border px-3 py-2 text-xs font-bold">Add</button><button onClick={() => onBuy(product.id, quantity)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Buy</button></div></> : <p className="mt-3 text-xs text-muted-foreground">Pricing unavailable for this account.</p>}</article>;
}

function Catalogue({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const priceById = useMemo(() => new Map(data.prices.map((p) => [p.product_id, p])), [data.prices]);
  const categories = useMemo(() => ["all", ...Array.from(new Set(data.products.map((p) => p.category).filter(Boolean) as string[]))], [data.products]);
  const visible = data.products.filter((p) => (!query || `${title(p)} ${p.sku || ""}`.toLowerCase().includes(query.toLowerCase())) && (category === "all" || p.category === category));
  const add = async (id: string, quantity: number) => { try { await customerAppClient.addLine(id, quantity); toast.success("Added to your cart"); await data.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to add item"); } };
  const buy = async (id: string, quantity: number) => { await add(id, quantity); navigate("/buyer/cart"); };
  return <section className="space-y-5"><div><p className="text-sm text-muted-foreground">Shop approved B2B products</p><h1 className="text-2xl font-bold">Catalogue</h1></div><div className="flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3"><Search size={18} className="text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or SKU" className="w-full bg-transparent py-3 text-sm outline-none" /></label><select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border bg-card px-3 py-3 text-sm">{categories.map((c) => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}</select></div>{visible.length === 0 ? <Empty title="No products found" text="Try another search or check back after catalogue updates." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((p) => <ProductCard key={p.id} product={p} price={priceById.get(p.id)} onAdd={add} onBuy={buy} onView={(id) => navigate(`/buyer/catalogue/${id}`)} />)}</div>}</section>;
}

function ProductDetail({ data, productId }: { data: ReturnType<typeof useBuyerData>; productId: string }) {
  const navigate = useNavigate();
  const product = data.products.find((p) => p.id === productId);
  const price = data.prices.find((p) => p.product_id === productId);
  const [quantity, setQuantity] = useState(Number(price?.minimum_order_quantity || 1));
  if (!product) return <Empty title="Product unavailable" text="This product is not currently published for your account." />;
  const add = async () => { try { await customerAppClient.addLine(productId, quantity); toast.success("Added to your cart"); navigate("/buyer/cart"); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to add item"); } };
  return <section className="space-y-5"><button onClick={() => navigate("/buyer/catalogue")} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} /> Back to catalogue</button><div className="grid gap-6 md:grid-cols-2"><div className="aspect-square overflow-hidden rounded-3xl bg-muted">{product.image_url ? <img src={product.image_url} alt={title(product)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-6xl">🍪</div>}</div><div className="space-y-4"><p className="text-sm text-muted-foreground">{product.category || "Approved catalogue"}</p><h1 className="text-3xl font-bold">{title(product)}</h1><p className="text-sm text-muted-foreground">{product.description || "Premium Oasis Baklawa product for approved B2B buyers."}</p>{price ? <><p className="text-2xl font-bold text-primary">{money(price.selling_price)} <span className="text-sm font-normal text-muted-foreground">/ {price.uom || "unit"}</span></p><p className="text-sm">MOQ {price.minimum_order_quantity || 1} {price.minimum_order_uom || price.uom || "units"}</p><div className="flex items-center gap-3"><button onClick={() => setQuantity(Math.max(Number(price.minimum_order_quantity || 1), quantity - Number(price.order_increment || 1)))} className="rounded-lg border p-2"><Minus size={16} /></button><span className="w-12 text-center">{quantity}</span><button onClick={() => setQuantity(quantity + Number(price.order_increment || 1))} className="rounded-lg border p-2"><Plus size={16} /></button></div><button onClick={add} className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">Add to cart</button></> : <p className="text-sm text-muted-foreground">Pricing is not available for this account.</p>}</div></div></section>;
}

function Cart({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const productById = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);
  const priceById = useMemo(() => new Map(data.prices.map((p) => [p.product_id, p])), [data.prices]);
  const lines = data.draft.filter((l) => l.line_id && l.product_id);
  const total = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price_snapshot || priceById.get(l.product_id!)?.selling_price || 0), 0);
  const mutate = async (action: () => Promise<unknown>) => { try { await action(); await data.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Cart update failed"); } };
  const submit = async () => { setSubmitting(true); try { const result = await customerAppClient.submit(getCheckoutIdempotencyKey()); const row = result?.[0]; if (!row) throw new Error("Checkout returned no order"); clearCheckoutIdempotencyKey(); toast.success(`Order ${row.order_number} submitted`); await data.refresh(); navigate(`/buyer/orders/${row.order_id}`); } catch (e) { toast.error(e instanceof Error ? e.message : "Order submission failed. You can safely retry."); } finally { setSubmitting(false); } };
  return <section className="space-y-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Review before submission</p><h1 className="text-2xl font-bold">Your cart</h1></div><button onClick={() => mutate(() => customerAppClient.clearDraft())} className="text-xs text-muted-foreground">Clear cart</button></div>{lines.length === 0 ? <Empty title="Your cart is empty" text="Browse the catalogue to add approved products." action={<button onClick={() => navigate("/buyer/catalogue")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Browse catalogue</button>} /> : <><div className="space-y-3">{lines.map((line) => { const p = productById.get(line.product_id!); const price = priceById.get(line.product_id!); const increment = Number(price?.order_increment || 1); return <div key={line.line_id} className="flex items-center gap-3 rounded-xl border bg-card p-3"><div className="flex-1"><p className="font-semibold">{line.product_name_snapshot || title(p)}</p><p className="text-xs text-muted-foreground">{money(line.unit_price_snapshot || price?.selling_price)} · {line.uom_snapshot || price?.uom || "unit"}</p></div><button onClick={() => mutate(() => customerAppClient.updateLine(line.line_id!, Math.max(Number(price?.minimum_order_quantity || 1), Number(line.quantity || 1) - increment)))} className="rounded-lg border p-2"><Minus size={14} /></button><span className="w-8 text-center text-sm">{line.quantity}</span><button onClick={() => mutate(() => customerAppClient.updateLine(line.line_id!, Number(line.quantity || 1) + increment))} className="rounded-lg border p-2"><Plus size={14} /></button><button onClick={() => mutate(() => customerAppClient.removeLine(line.line_id!))} className="rounded-lg p-2 text-destructive"><Trash2 size={16} /></button></div>; })}</div><div className="rounded-2xl border bg-card p-5"><div className="flex justify-between text-sm"><span>Authoritative preview subtotal</span><strong>{money(total)}</strong></div><p className="mt-2 text-xs text-muted-foreground">Final tax, charges and 30% upward-to-₹500 advance are resolved by Core at submission.</p><button disabled={submitting || data.draft[0]?.readiness_status !== "ready"} onClick={submit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{submitting && <Loader2 size={16} className="animate-spin" />} {submitting ? "Submitting…" : "Submit order"}</button>{data.draft[0]?.readiness_status !== "ready" && <p className="mt-2 text-xs text-destructive">Resolve MOQ, carton or availability issues before submitting.</p>}</div></>}</section>;
}

function Orders({ data }: { data: ReturnType<typeof useBuyerData> }) { const navigate = useNavigate(); return <section className="space-y-5"><div><p className="text-sm text-muted-foreground">Customer-safe progress</p><h1 className="text-2xl font-bold">Your orders</h1></div>{data.orders.length === 0 ? <Empty title="No orders yet" text="Your submitted orders will appear here." action={<button onClick={() => navigate("/buyer/catalogue")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Start shopping</button>} /> : <div className="space-y-3">{data.orders.map((o) => <button key={o.order_id} onClick={() => navigate(`/buyer/orders/${o.order_id}`)} className="w-full rounded-2xl border bg-card p-4 text-left"><div className="flex items-center justify-between"><strong>{o.order_number}</strong><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{o.customer_stage}</span></div><div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>{new Date(o.created_at).toLocaleDateString("en-IN")}</span><span>{money(o.order_value)}</span></div></button>)}</div>}</section>; }

function OrderDetail({ data, orderId }: { data: ReturnType<typeof useBuyerData>; orderId: string }) { const order = data.orders.find((o) => o.order_id === orderId); const lines = data.items.filter((i) => i.order_id === orderId); const [reordering, setReordering] = useState(false); if (!order) return <Empty title="Order not found" text="This order is not available for your company." />; const reorder = async () => { setReordering(true); try { for (const line of lines) await customerAppClient.addLine(line.product_id, line.quantity); toast.success("Order items added to your cart"); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to reorder these items"); } finally { setReordering(false); } }; return <section className="space-y-5"><Link to="/buyer/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} /> Back to orders</Link><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{order.order_number}</p><h1 className="text-2xl font-bold">Order details</h1></div><button disabled={reordering || lines.length === 0} onClick={reorder} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{reordering ? "Adding…" : "Reorder"}</button></div><div className="rounded-2xl border bg-card p-5"><div className="flex justify-between"><span>Status</span><strong className="text-primary">{order.customer_stage}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Payment</span><span>{order.payment_stage}</span></div><div className="mt-2 flex justify-between text-sm"><span>Dispatch</span><span>{order.promised_dispatch_date || order.requested_dispatch_date || "To be confirmed"}</span></div></div><div className="space-y-2"><h2 className="font-semibold">Items</h2>{lines.map((l) => <div key={l.item_id} className="flex justify-between rounded-xl border bg-card p-3 text-sm"><span>{l.product_name || l.sku || "Product"} × {l.quantity}</span><span>{l.pack_size || ""}</span></div>)}</div></section>; }

function Account({ data }: { data: ReturnType<typeof useBuyerData> }) { const { logout } = useAuth(); return <section className="space-y-5"><div><p className="text-sm text-muted-foreground">Customer context</p><h1 className="text-2xl font-bold">Account</h1></div><div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">{data.company?.business_name || "Your company"}</h2><p className="mt-1 text-sm text-muted-foreground">{data.company?.gst_number || "GST details pending"}</p><p className="mt-3 text-sm">{data.company?.registered_address || "Company address not available"}</p></div><div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Team</h2>{data.team.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No additional approved buyers.</p> : data.team.map((m) => <div key={m.profile_id} className="mt-2 flex justify-between text-sm"><span>{m.full_name || m.email}</span><span className="text-muted-foreground">{m.role}</span></div>)}</div><button onClick={() => void logout()} className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"><LogOut size={16} /> Sign out</button></section>; }

function Support({ data }: { data: ReturnType<typeof useBuyerData> }) { const [orderId, setOrderId] = useState(""); const [issue, setIssue] = useState("Damaged Goods"); const [description, setDescription] = useState(""); const [sending, setSending] = useState(false); const submit = async () => { if (!orderId || !description.trim()) return; setSending(true); try { await customerAppClient.submitTicket(orderId, issue, description.trim()); toast.success("Support ticket submitted"); setDescription(""); await data.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to submit ticket"); } finally { setSending(false); } }; return <section className="space-y-5"><div><p className="text-sm text-muted-foreground">We are here to help</p><h1 className="text-2xl font-bold">Support</h1></div><div className="rounded-2xl border bg-card p-5 space-y-3"><select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-3 text-sm"><option value="">Select an order</option>{data.orders.map((o) => <option key={o.order_id} value={o.order_id}>{o.order_number}</option>)}</select><select value={issue} onChange={(e) => setIssue(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-3 text-sm"><option>Damaged Goods</option><option>Missing Items</option><option>Wrong Shipment</option><option>Other</option></select><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue" rows={4} className="w-full rounded-xl border bg-background px-3 py-3 text-sm" /><button disabled={sending || !orderId || !description.trim()} onClick={submit} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{sending ? "Submitting…" : "Submit ticket"}</button></div><div className="space-y-2">{data.tickets.map((t) => <div key={t.ticket_id} className="rounded-xl border bg-card p-4 text-sm"><div className="flex justify-between"><strong>{t.issue_type}</strong><span className="text-muted-foreground">{t.customer_status}</span></div><p className="mt-1 text-muted-foreground">{t.description}</p></div>)}</div></section>; }

function Home({ data }: { data: ReturnType<typeof useBuyerData> }) { const navigate = useNavigate(); return <section className="space-y-5"><div className="rounded-3xl bg-primary p-6 text-primary-foreground"><p className="text-sm opacity-80">Welcome back</p><h1 className="mt-1 text-3xl font-bold">{data.company?.business_name || "Oasis buyer"}</h1><p className="mt-3 max-w-md text-sm opacity-90">Browse approved products, keep your carton rules intact, and submit a governed order in a few taps.</p><button onClick={() => navigate("/buyer/catalogue")} className="mt-5 rounded-xl bg-background px-4 py-3 text-sm font-bold text-foreground">Browse catalogue</button></div><div className="grid gap-3 sm:grid-cols-3"><button onClick={() => navigate("/buyer/cart")} className="rounded-2xl border bg-card p-4 text-left"><ShoppingBag className="text-primary" /><p className="mt-3 font-semibold">Cart</p><p className="text-xs text-muted-foreground">{data.draft.filter((l) => l.line_id).length} lines ready</p></button><button onClick={() => navigate("/buyer/orders")} className="rounded-2xl border bg-card p-4 text-left"><Package className="text-primary" /><p className="mt-3 font-semibold">Orders</p><p className="text-xs text-muted-foreground">{data.orders.length} submitted</p></button><button onClick={() => navigate("/buyer/support")} className="rounded-2xl border bg-card p-4 text-left"><LifeBuoy className="text-primary" /><p className="mt-3 font-semibold">Support</p><p className="text-xs text-muted-foreground">{data.tickets.length} tickets</p></button></div></section>; }

function Empty({ title: heading, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="rounded-2xl border border-dashed p-10 text-center"><p className="font-semibold">{heading}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</div>; }

export default function BuyerApp() {
  const location = useLocation();
  const data = useBuyerData();
  const path = location.pathname;
  let content: React.ReactNode;
  if (path === "/buyer" || path === "/buyer/") content = <Home data={data} />;
  else if (/^\/buyer\/catalogue\/[^/]+$/.test(path)) content = <ProductDetail data={data} productId={path.split("/").pop() || ""} />;
  else if (path.startsWith("/buyer/catalogue")) content = <Catalogue data={data} />;
  else if (path === "/buyer/cart") content = <Cart data={data} />;
  else if (path === "/buyer/orders") content = <Orders data={data} />;
  else if (path.startsWith("/buyer/orders/")) content = <OrderDetail data={data} orderId={path.split("/").pop() || ""} />;
  else if (path === "/buyer/account") content = <Account data={data} />;
  else if (path === "/buyer/support") content = <Support data={data} />;
  else content = <Home data={data} />;
  return <div className="min-h-screen bg-background pb-20 text-foreground sm:pb-0"><BuyerNav /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{data.loading ? <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : <>{content}<button onClick={() => void data.refresh()} className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw size={13} /> Refresh</button></>}</main></div>;
}
