import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Heart,
  ImageOff,
  LifeBuoy,
  Loader2,
  LogOut,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/database.types";
import { useAuth } from "@/hooks/useAuth";
import {
  customerAppClient,
  clearCheckoutIdempotencyKey,
  clearGeneralQueryIdempotencyKey,
  GENERAL_QUERY_CATEGORIES,
  getCheckoutIdempotencyKey,
  getGeneralQueryIdempotencyKey,
  getLocalDateInputValue,
  type BuyerCompany,
  type BuyerCommercialFacts,
  type BuyerDraftLine,
  type BuyerDocument,
  type BuyerFinanceFacts,
  type BuyerFinalPaymentPiFacts,
  type BuyerGeneralQuery,
  type BuyerOrder,
  type BuyerOrderItem,
  type BuyerPrice,
  type BuyerProformaInvoiceFacts,
  type BuyerStatement,
  type BuyerTeamMember,
  type BuyerTicket,
} from "@/lib/customerApp/customerAppClient";
import {
  buildCustomerOrderTimeline,
  customerFinanceAction,
  customerFinanceStatusLabel,
  customerGeneralQueryStatusLabel,
  customerOrderAction,
  customerOrderStageLabel,
  customerPaymentStageLabel,
  customerReadinessMessages,
} from "@/lib/customerApp/customerPresentation";
import { buildBuyerCommunicationLog, buyerCommunicationLogCount } from "@/lib/customerApp/buyerCommunicationLog";
import logoImg from "@/assets/logo-open.png";
import { CustomerOrderTimeline } from "@/components/customer/CustomerOrderTimeline";
import SystemAlertMarquee from "@/components/buyer/SystemAlertMarquee";

type Product = Pick<Database["public"]["Tables"]["products"]["Row"], "id" | "name" | "sku" | "description" | "image_url" | "category" | "sub_category" | "is_active" | "visible_in_catalog">;

const money = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "Not available";
const productTitle = (product: Product | null | undefined) => product?.name || "Oasis product";
const BUYER_DATA_LOAD_ERROR = "We couldn't refresh your Buyer data. Check your connection and try again.";
const BUYER_CART_ADD_ERROR = "We couldn't add that item to your cart. Please try again.";
const BUYER_CART_UPDATE_ERROR = "We couldn't update your cart. Please try again.";
const BUYER_ORDER_SUBMIT_ERROR = "We couldn't submit your order. Your cart is still saved; please try again.";
const BUYER_REORDER_ERROR = "We couldn't add these order items to your cart. Please try again.";
const BUYER_SUPPORT_ERROR = "We couldn't submit your support request. Please try again.";
const BUYER_ACCESS_REQUEST_ERROR = "We couldn't submit your access request. Please try again.";
const BUYER_FAVOURITE_ERROR = "We couldn't update favourites. Please try again.";
const BUYER_QUERY_ERROR = "We couldn't submit your enquiry. Please try again.";

function positiveNumber(value: number | string | null | undefined, fallback = 1): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Not available" : date.toLocaleDateString("en-IN");
}

function companyStatusLabel(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase();
  if (["approved", "active"].includes(normalized)) return "Active buyer account";
  if (["pending", "submitted", "under_review"].includes(normalized)) return "Application under review";
  if (["suspended", "frozen", "inactive"].includes(normalized)) return "Account access is temporarily unavailable";
  return "Account status will appear when available";
}

function teamRoleLabel(role: string | null | undefined): string {
  const normalized = (role || "").toLowerCase();
  if (normalized.includes("admin") || normalized.includes("owner")) return "Company administrator";
  if (normalized.includes("buyer") || normalized.includes("customer")) return "Buyer";
  return "Approved team member";
}

function ticketStatusLabel(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase();
  if (["resolved", "closed"].includes(normalized)) return "Resolved";
  if (["in_progress", "assigned", "working"].includes(normalized)) return "In progress";
  return "Received";
}

function ticketIssueLabel(issueType: string | null | undefined): string {
  const normalized = (issueType || "").trim().toLowerCase();
  if (normalized === "damaged goods" || normalized === "damaged_goods") return "Damaged goods";
  if (normalized === "missing items" || normalized === "missing_items") return "Missing items";
  if (normalized === "wrong shipment" || normalized === "wrong_shipment") return "Wrong shipment";
  if (normalized === "delivery question" || normalized === "other order question" || normalized === "other") return "Order question";
  return "Order support request";
}

/** Presents governed order tickets and general enquiries in one newest-first communication log. */
function BuyerCommunicationLog({ tickets, generalQueries }: { tickets: BuyerTicket[]; generalQueries: BuyerGeneralQuery[] }) {
  const entries = useMemo(() => buildBuyerCommunicationLog(tickets, generalQueries), [tickets, generalQueries]);
  if (entries.length === 0) {
    return <Empty title="No communications yet" text="Order support tickets and general enquiries will appear here after you submit them." />;
  }
  return (
    <div className="space-y-2" aria-live="polite">
      {entries.map((entry) => {
        if (entry.kind === "order_ticket" && entry.ticket) {
          return (
            <div key={entry.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex justify-between gap-3">
                <strong>{ticketIssueLabel(entry.ticket.issue_type)}</strong>
                <span className="text-muted-foreground">{ticketStatusLabel(entry.ticket.customer_status)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Order ticket · {entry.ticket.order_number || "reference pending"}</p>
              <p className="mt-1 text-muted-foreground">{entry.ticket.description}</p>
            </div>
          );
        }
        if (entry.kind === "general_enquiry" && entry.query) {
          return (
            <div key={entry.id} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex justify-between gap-3">
                <strong>{entry.query.subject}</strong>
                <span className="text-muted-foreground">{customerGeneralQueryStatusLabel(entry.query.status)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">General enquiry · {entry.query.category}</p>
              <p className="mt-1 text-muted-foreground">{entry.query.message}</p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function BuyerProductImage({ src, alt, compact = false }: { src: string | null; alt: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[#e8e3d8] text-[#766b5c] ${compact ? "text-[10px]" : "text-xs"}`}>
        <ImageOff size={compact ? 16 : 24} aria-hidden />
        <span>Image coming soon</span>
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => { setFailed(true); }} className="h-full w-full object-contain" />;
}

type SafeReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; value: undefined };

/** Loads customer-safe read models and refreshes them after governed actions. */
function useBuyerData() {
  const [prices, setPrices] = useState<BuyerPrice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [draft, setDraft] = useState<BuyerDraftLine[]>([]);
  const [company, setCompany] = useState<BuyerCompany | null>(null);
  const [team, setTeam] = useState<BuyerTeamMember[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [items, setItems] = useState<BuyerOrderItem[]>([]);
  const [tickets, setTickets] = useState<BuyerTicket[]>([]);
  const [commercialFacts, setCommercialFacts] = useState<BuyerCommercialFacts[]>([]);
  const [financeFacts, setFinanceFacts] = useState<Record<string, BuyerFinanceFacts>>({});
  const [finalPaymentPiFacts, setFinalPaymentPiFacts] = useState<Record<string, BuyerFinalPaymentPiFacts>>({});
  const [proformaInvoices, setProformaInvoices] = useState<BuyerProformaInvoiceFacts[]>([]);
  const [documents, setDocuments] = useState<BuyerDocument[]>([]);
  const [statement, setStatement] = useState<BuyerStatement | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [generalQueries, setGeneralQueries] = useState<BuyerGeneralQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const projectionState = useRef({
    commercialFacts: [] as BuyerCommercialFacts[],
    financeFacts: {} as Record<string, BuyerFinanceFacts>,
    finalPaymentPiFacts: {} as Record<string, BuyerFinalPaymentPiFacts>,
    proformaInvoices: [] as BuyerProformaInvoiceFacts[],
    documents: [] as BuyerDocument[],
    statement: null as BuyerStatement | null,
    favourites: [] as string[],
    generalQueries: [] as BuyerGeneralQuery[],
  });

  const safeRead = useCallback(async <T,>(read: () => Promise<T>): Promise<SafeReadResult<T>> => {
    try {
      return { ok: true, value: await read() };
    } catch {
      return { ok: false, value: undefined };
    }
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    const isCurrentRefresh = () => generation === refreshGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const [priceRows, productRows, draftRows, companyRows, orderRows, itemRows, ticketRows] = await Promise.all([
        customerAppClient.prices(),
        supabase.from("products").select("id,name,sku,description,image_url,category,sub_category,is_active,visible_in_catalog").eq("is_active", true).eq("visible_in_catalog", true),
        customerAppClient.draft(),
        customerAppClient.company(),
        customerAppClient.orders(),
        customerAppClient.items(),
        customerAppClient.tickets(),
      ]);
      if (productRows.error) throw productRows.error;
      const [commercialResult, proformaResult, documentResult, statementResult, favouriteResult, queryResult] = await Promise.all([
        safeRead(() => customerAppClient.commercialFacts()),
        safeRead(() => customerAppClient.proformaInvoices()),
        safeRead(() => customerAppClient.documents()),
        safeRead(() => customerAppClient.statement()),
        safeRead(() => customerAppClient.favourites()),
        safeRead(() => customerAppClient.generalQueries()),
      ]);
      if (!isCurrentRefresh()) return;
      const commercialRows = commercialResult.ok && Array.isArray(commercialResult.value) ? commercialResult.value : projectionState.current.commercialFacts;
      const proformaRows = proformaResult.ok && Array.isArray(proformaResult.value) ? proformaResult.value : projectionState.current.proformaInvoices;
      const documentRows = documentResult.ok && Array.isArray(documentResult.value) ? documentResult.value : projectionState.current.documents;
      const statementRow = statementResult.ok && statementResult.value ? statementResult.value : projectionState.current.statement;
      const favouriteRows = favouriteResult.ok && Array.isArray(favouriteResult.value) ? favouriteResult.value : projectionState.current.favourites.map((product_id) => ({ product_id }));
      const queryRows = queryResult.ok && Array.isArray(queryResult.value) ? queryResult.value : projectionState.current.generalQueries;
      const orderRowsWithFacts = (orderRows || []).map((order) => {
        const facts = (commercialRows || []).find((row) => row.order_id === order.order_id);
        return facts
          ? {
              ...order,
              order_number: facts.order_number,
              order_value: facts.frozen_sales_order_value,
              requested_dispatch_date: facts.requested_dispatch_date,
              promised_dispatch_date: facts.promised_dispatch_date,
              commercial_version_id: facts.commercial_version_id,
              commercial_version_number: facts.commercial_version_number,
              commercial_status: facts.commercial_status,
              finance_status: facts.finance_status,
            }
          : order;
      });
      const financeRowsPromise = Promise.all((orderRowsWithFacts || []).map(async (order) => [
        order.order_id,
        await safeRead(() => customerAppClient.financeFacts(order.order_id)),
      ] as const));
      const finalPaymentPiRowsPromise = Promise.all((orderRowsWithFacts || []).map(async (order) => [
        order.order_id,
        await safeRead(() => customerAppClient.finalPaymentPiFacts(order.order_id)),
      ] as const));
      const teamPromise = safeRead(() => customerAppClient.team());
      setPrices(priceRows || []);
      setProducts(productRows.data || []);
      setDraft(draftRows || []);
      setCompany(companyRows?.[0] || null);
      setOrders(orderRowsWithFacts || []);
      setItems(itemRows || []);
      setTickets(ticketRows || []);
      setCommercialFacts(commercialRows || []);
      setProformaInvoices(proformaRows || []);
      setDocuments(documentRows || []);
      setStatement(statementRow);
      setFavourites((favouriteRows || []).map((row) => row.product_id));
      setGeneralQueries(queryRows || []);
      projectionState.current.commercialFacts = commercialRows || [];
      projectionState.current.proformaInvoices = proformaRows || [];
      projectionState.current.documents = documentRows || [];
      projectionState.current.statement = statementRow;
      projectionState.current.favourites = (favouriteRows || []).map((row) => row.product_id);
      projectionState.current.generalQueries = queryRows || [];
      // The core Buyer surface is usable as soon as its base projections land;
      // the per-order Finance fan-out continues without holding the page behind
      // a loading state.
      setLoading(false);
      void teamPromise.then((teamResult) => {
        if (isCurrentRefresh() && teamResult.ok) setTeam(teamResult.value || []);
      }).catch(() => undefined);
      void financeRowsPromise.then((financeRows) => {
        if (!isCurrentRefresh()) return;
        const previousFinanceFacts = projectionState.current.financeFacts;
        const financeByOrder: Record<string, BuyerFinanceFacts> = {};
        for (const [orderId, result] of financeRows) {
          if (result.ok && result.value) financeByOrder[orderId] = result.value;
          else if (!result.ok && previousFinanceFacts[orderId]) financeByOrder[orderId] = previousFinanceFacts[orderId];
        }
        projectionState.current.financeFacts = financeByOrder;
        setFinanceFacts(financeByOrder);
      }).catch(() => undefined);
      void finalPaymentPiRowsPromise.then((finalPaymentPiRows) => {
        if (!isCurrentRefresh()) return;
        const previousFacts = projectionState.current.finalPaymentPiFacts;
        const factsByOrder: Record<string, BuyerFinalPaymentPiFacts> = {};
        for (const [orderId, result] of finalPaymentPiRows) {
          if (result.ok && result.value) factsByOrder[orderId] = result.value;
          else if (!result.ok && previousFacts[orderId]) factsByOrder[orderId] = previousFacts[orderId];
        }
        projectionState.current.finalPaymentPiFacts = factsByOrder;
        setFinalPaymentPiFacts(factsByOrder);
      }).catch(() => undefined);
    } catch {
      if (!isCurrentRefresh()) return;
      setError(BUYER_DATA_LOAD_ERROR);
      toast.error(BUYER_DATA_LOAD_ERROR);
    } finally {
      if (isCurrentRefresh()) setLoading(false);
    }
  }, [safeRead]);

  useEffect(() => { void refresh(); }, [refresh]);
  const toggleFavourite = useCallback(async (productId: string, isFavourite: boolean) => {
    const optimisticFavourites = isFavourite
      ? Array.from(new Set([...projectionState.current.favourites, productId]))
      : projectionState.current.favourites.filter((id) => id !== productId);
    projectionState.current.favourites = optimisticFavourites;
    setFavourites(optimisticFavourites);
    try {
      const result = await customerAppClient.setFavourite(productId, isFavourite);
      const row = result?.[0];
      if (!row || row.product_id !== productId || row.is_favourite !== isFavourite) throw new Error("Favourite update was not acknowledged");
      try {
        const serverRows = await customerAppClient.favourites();
        if (Array.isArray(serverRows)) {
          const serverFavourites = serverRows.map((favourite) => favourite.product_id);
          projectionState.current.favourites = serverFavourites;
          setFavourites(serverFavourites);
        }
      } catch {
        // Keep the acknowledged optimistic state when a follow-up read is unavailable.
      }
    } catch (cause) {
      const rollbackFavourites = isFavourite
        ? projectionState.current.favourites.filter((id) => id !== productId)
        : Array.from(new Set([...projectionState.current.favourites, productId]));
      projectionState.current.favourites = rollbackFavourites;
      setFavourites(rollbackFavourites);
      throw cause;
    }
  }, []);
  return {
    prices,
    products,
    draft,
    company,
    team,
    orders,
    items,
    tickets,
    commercialFacts,
    financeFacts,
    finalPaymentPiFacts,
    proformaInvoices,
    documents,
    statement,
    favourites,
    generalQueries,
    loading,
    error,
    refresh,
    setDraft,
    toggleFavourite,
  };
}

/** Keeps the required five-point Buyer navigation semantic and touch friendly. */
function BuyerNav() {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] transition-colors sm:min-w-0 sm:flex-row sm:gap-2 sm:text-sm ${isActive ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <nav aria-label="Buyer navigation" className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/80 bg-background/95 shadow-[var(--nav-shadow)] backdrop-blur sm:sticky sm:top-0 sm:border-b sm:border-t-0">
      <div className="mx-auto grid max-w-6xl grid-cols-5 items-end px-2 py-2 sm:flex sm:justify-center sm:gap-10 sm:px-6">
        <NavLink to="/buyer/catalogue" className={itemClass}>
          <ShoppingBag size={18} aria-hidden /><span>Catalogue</span>
        </NavLink>
        <NavLink to="/buyer/orders" className={itemClass}>
          <Package size={18} aria-hidden /><span>Orders</span>
        </NavLink>
        <NavLink to="/buyer" end aria-label="Dashboard" className={({ isActive }) => `-mt-6 flex flex-col items-center gap-1 text-[11px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-[#e8e3d8] shadow-md">
            <img src={logoImg} alt="Oasis Baklawa" className="h-10 w-10 object-contain" />
          </span>
          <span className="font-semibold">Dashboard</span>
        </NavLink>
        <NavLink to="/buyer/cart" aria-label="Quick order and cart" className={itemClass}>
          <ShoppingBag size={18} aria-hidden /><span>Cart</span>
        </NavLink>
        <NavLink to="/buyer/account" className={itemClass}>
          <UserRound size={18} aria-hidden /><span>Account</span>
        </NavLink>
      </div>
    </nav>
  );
}

function BuyerSupportFab() {
  return (
    <Link to="/buyer/support" aria-label="Open customer support" className="fixed bottom-24 right-4 z-20 inline-flex items-center gap-2 rounded-full bg-[#5f6848] px-4 py-3 text-sm font-semibold text-white shadow-[var(--fab-shadow)] transition-transform hover:-translate-y-0.5 sm:bottom-6 sm:right-6">
      <LifeBuoy size={17} aria-hidden /> <span>Support</span>
    </Link>
  );
}

/** Displays one approved catalogue item and delegates cart/favourite actions to its parent. */
function ProductCard({ product, price, isFavourite, onAdd, onBuy, onToggleFavourite, onView }: { product: Product; price?: BuyerPrice; isFavourite: boolean; onAdd: (id: string, quantity: number) => Promise<unknown>; onBuy: (id: string, quantity: number) => Promise<unknown>; onToggleFavourite: (id: string, next: boolean) => Promise<unknown>; onView: (id: string) => void }) {
  const minimum = positiveNumber(price?.minimum_order_quantity);
  const increment = positiveNumber(price?.order_increment);
  const hasUsablePrice = Boolean(price && typeof price.selling_price === "number" && Number.isFinite(price.selling_price));
  const [quantity, setQuantity] = useState(minimum);
  const [busy, setBusy] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  useEffect(() => { setQuantity(minimum); }, [minimum]);
  const runCartAction = (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    void action().finally(() => { setBusy(false); });
  };
  return (
    <article className="flex flex-col rounded-2xl border border-border/80 bg-card p-4 shadow-[var(--card-shadow)]">
      <button
        type="button"
        aria-label={isFavourite ? `Remove ${productTitle(product)} from favourites` : `Add ${productTitle(product)} to favourites`}
        aria-pressed={isFavourite}
        disabled={favouriteBusy}
        onClick={() => {
          if (favouriteBusy) return;
          setFavouriteBusy(true);
          void onToggleFavourite(product.id, !isFavourite).catch(() => { toast.error(BUYER_FAVOURITE_ERROR); }).finally(() => { setFavouriteBusy(false); });
        }}
        className="ml-auto inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border text-primary disabled:opacity-50"
      >
        <Heart size={17} fill={isFavourite ? "currentColor" : "none"} aria-hidden />
      </button>
      <button type="button" onClick={() => { onView(product.id); }} className="block w-full text-left" aria-label={`View ${productTitle(product)}`}>
        <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-muted"><BuyerProductImage src={product.image_url} alt={productTitle(product)} /></div>
        <p className="font-semibold">{productTitle(product)}</p>
      </button>
      <p className="mt-1 text-xs text-muted-foreground">{product.sku || "SKU pending"} · {price?.uom || "Unit"}</p>
      {hasUsablePrice && price ? (
        <>
          <p className="mt-2 text-lg font-bold text-primary">{money(price.selling_price)} <span className="text-xs font-normal text-muted-foreground">/ {price.uom || "unit"}</span></p>
          <p className="text-[11px] text-muted-foreground">Minimum {minimum} {price.minimum_order_uom || price.uom || "units"} · increments of {increment}</p>
          <div className="mt-auto flex items-center gap-2 pt-4">
            <button type="button" aria-label={`Decrease ${productTitle(product)} quantity`} onClick={() => { setQuantity(Math.max(minimum, quantity - increment)); }} disabled={busy} className="rounded-lg border p-2 disabled:opacity-50"><Minus size={14} aria-hidden /></button>
            <span className="min-w-10 text-center text-sm" aria-live="polite">{quantity}</span>
            <button type="button" aria-label={`Increase ${productTitle(product)} quantity`} onClick={() => { setQuantity(quantity + increment); }} disabled={busy} className="rounded-lg border p-2 disabled:opacity-50"><Plus size={14} aria-hidden /></button>
            <button type="button" onClick={() => { runCartAction(() => onAdd(product.id, quantity)); }} disabled={busy} className="ml-auto rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Add</button>
            <button type="button" onClick={() => { runCartAction(() => onBuy(product.id, quantity)); }} disabled={busy} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Buy</button>
          </div>
        </>
      ) : <p className="mt-3 text-xs text-muted-foreground">Pricing unavailable for this account.</p>}
    </article>
  );
}

/** Provides searchable catalogue data and governed cart entry points. */
function Catalogue({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [subCategory, setSubCategory] = useState("all");
  const priceById = useMemo(() => new Map(data.prices.map((price) => [price.product_id, price])), [data.prices]);
  const categories = useMemo(() => ["all", ...Array.from(new Set(data.products.map((product) => product.category).filter(Boolean) as string[]))], [data.products]);
  const subcategories = useMemo(() => ["all", ...Array.from(new Set(data.products.filter((product) => category === "all" || product.category === category).map((product) => product.sub_category).filter(Boolean) as string[]))], [category, data.products]);
  useEffect(() => { setSubCategory("all"); }, [category]);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = data.products.filter((product) =>
    (!normalizedQuery || `${productTitle(product)} ${product.sku || ""}`.toLowerCase().includes(normalizedQuery)) &&
    (category === "all" || product.category === category) &&
    (subCategory === "all" || product.sub_category === subCategory),
  );
  const add = async (id: string, quantity: number): Promise<boolean> => {
    try {
      await customerAppClient.addLine(id, quantity);
      toast.success("Added to your cart");
      await data.refresh();
      return true;
    } catch {
      toast.error(BUYER_CART_ADD_ERROR);
      return false;
    }
  };
  const buy = async (id: string, quantity: number) => {
    if (await add(id, quantity)) navigate("/buyer/cart");
  };
  return (
    <section className="space-y-5" aria-labelledby="catalogue-heading">
      <div><p className="text-sm text-muted-foreground">Shop approved B2B products</p><h1 id="catalogue-heading" className="font-display text-3xl font-semibold">Catalogue</h1></div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="buyer-catalogue-search" className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3"><Search size={18} className="text-muted-foreground" aria-hidden /><span className="sr-only">Search products or SKU</span><input id="buyer-catalogue-search" value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder="Search products or SKU" className="w-full bg-transparent py-3 text-sm outline-none" /></label>
        <label htmlFor="buyer-catalogue-category" className="sr-only">Filter by category</label>
        <select id="buyer-catalogue-category" value={category} onChange={(event) => { setCategory(event.target.value); }} className="rounded-xl border bg-card px-3 py-3 text-sm"><option value="all">All categories</option>{categories.filter((value) => value !== "all").map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <label htmlFor="buyer-catalogue-subcategory" className="sr-only">Filter by subcategory</label>
        <select id="buyer-catalogue-subcategory" value={subCategory} onChange={(event) => { setSubCategory(event.target.value); }} className="rounded-xl border bg-card px-3 py-3 text-sm"><option value="all">All subcategories</option>{subcategories.filter((value) => value !== "all").map((value) => <option key={value} value={value}>{value}</option>)}</select>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">{visible.length} approved {visible.length === 1 ? "product" : "products"}</p>
      {visible.length === 0 ? <Empty title="No products found" text="Try another search or check back after catalogue updates." action={query || category !== "all" || subCategory !== "all" ? <button type="button" onClick={() => { setQuery(""); setCategory("all"); setSubCategory("all"); }} className="rounded-lg border px-4 py-2 text-sm font-semibold">Clear filters</button> : undefined} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((product) => <ProductCard key={product.id} product={product} price={priceById.get(product.id)} isFavourite={data.favourites.includes(product.id)} onAdd={add} onBuy={buy} onToggleFavourite={data.toggleFavourite} onView={(id) => { navigate(`/buyer/catalogue/${id}`); }} />)}</div>
      )}
    </section>
  );
}

/** Shows one product’s customer-safe price and governed MOQ/carton controls. */
function ProductDetail({ data, productId }: { data: ReturnType<typeof useBuyerData>; productId: string }) {
  const navigate = useNavigate();
  const product = data.products.find((item) => item.id === productId);
  const price = data.prices.find((item) => item.product_id === productId);
  const minimum = positiveNumber(price?.minimum_order_quantity);
  const increment = positiveNumber(price?.order_increment);
  const hasUsablePrice = Boolean(price && typeof price.selling_price === "number" && Number.isFinite(price.selling_price));
  const [quantity, setQuantity] = useState(minimum);
  const [adding, setAdding] = useState(false);
  const [favouriteBusy, setFavouriteBusy] = useState(false);
  useEffect(() => { setQuantity(minimum); }, [minimum]);
  if (!product) return <Empty title="Product unavailable" text="This product is not currently published for your account." />;
  const add = async (goToCart: boolean) => {
    if (adding || !hasUsablePrice) return;
    setAdding(true);
    try {
      await customerAppClient.addLine(productId, quantity);
      await data.refresh();
      toast.success("Added to your cart");
      if (goToCart) navigate("/buyer/cart");
    } catch {
      toast.error(BUYER_CART_ADD_ERROR);
    } finally {
      setAdding(false);
    }
  };
  return (
    <section className="space-y-5" aria-labelledby="product-heading">
      <button type="button" onClick={() => { navigate("/buyer/catalogue"); }} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} aria-hidden /> Back to catalogue</button>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-3xl bg-muted"><BuyerProductImage src={product.image_url} alt={productTitle(product)} /></div>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{[product.category, product.sub_category].filter(Boolean).join(" · ") || "Approved catalogue"}</p>
          <h1 id="product-heading" className="font-display text-3xl font-semibold">{productTitle(product)}</h1>
          <p className="text-xs text-muted-foreground">SKU: {product.sku || "Pending"}</p>
          <p className="text-sm text-muted-foreground">{product.description || "Premium Oasis Baklawa product for approved B2B buyers."}</p>
          <button
            type="button"
            aria-label={data.favourites.includes(productId) ? `Remove ${productTitle(product)} from favourites` : `Add ${productTitle(product)} to favourites`}
            aria-pressed={data.favourites.includes(productId)}
            disabled={favouriteBusy}
            onClick={() => {
              if (favouriteBusy) return;
              setFavouriteBusy(true);
              void data.toggleFavourite(productId, !data.favourites.includes(productId)).catch(() => { toast.error(BUYER_FAVOURITE_ERROR); }).finally(() => { setFavouriteBusy(false); });
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <Heart size={17} fill={data.favourites.includes(productId) ? "currentColor" : "none"} aria-hidden />
            {data.favourites.includes(productId) ? "Saved to favourites" : "Add to favourites"}
          </button>
          {hasUsablePrice && price ? (
            <>
              <p className="text-2xl font-bold text-primary">{money(price.selling_price)} <span className="text-sm font-normal text-muted-foreground">/ {price.uom || "unit"}</span></p>
              <p className="text-sm">Minimum {minimum} {price.minimum_order_uom || price.uom || "units"} · increments of {increment}</p>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Decrease quantity" onClick={() => { setQuantity(Math.max(minimum, quantity - increment)); }} disabled={adding} className="rounded-lg border p-3 disabled:opacity-50"><Minus size={16} aria-hidden /></button>
                <span className="w-12 text-center" aria-live="polite">{quantity}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => { setQuantity(quantity + increment); }} disabled={adding} className="rounded-lg border p-3 disabled:opacity-50"><Plus size={16} aria-hidden /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => { void add(false); }} disabled={adding} className="min-h-12 rounded-xl border px-4 py-3 font-bold disabled:opacity-50">Add to cart</button><button type="button" onClick={() => { void add(true); }} disabled={adding} className="min-h-12 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">Buy now</button></div>
            </>
          ) : <p className="text-sm text-muted-foreground">Pricing is not available for this account.</p>}
        </div>
      </div>
    </section>
  );
}

/** Maintains the editable draft and submits it through the idempotent Core RPC. */
function Cart({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [requestedDispatchDate, setRequestedDispatchDate] = useState("");
  const productById = useMemo(() => new Map(data.products.map((product) => [product.id, product])), [data.products]);
  const priceById = useMemo(() => new Map(data.prices.map((price) => [price.product_id, price])), [data.prices]);
  const lines = data.draft.filter((line): line is BuyerDraftLine & { line_id: string; product_id: string } => Boolean(line.line_id && line.product_id));
  const previewValues = lines.map((line) => line.unit_price_snapshot ?? priceById.get(line.product_id)?.selling_price);
  const hasCompletePreview = previewValues.every((value) => typeof value === "number" && Number.isFinite(value));
  const total = hasCompletePreview ? lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price_snapshot ?? priceById.get(line.product_id)?.selling_price), 0) : null;
  const readinessMessages = Array.from(new Set(data.draft
    .filter((line) => line.readiness_status !== "ready")
    .flatMap((line) => {
      const price = line.product_id ? priceById.get(line.product_id) : undefined;
      return customerReadinessMessages(
        line.readiness_issues as Json,
        price?.minimum_order_quantity ?? null,
        price?.minimum_order_uom || price?.uom || null,
      );
    })));
  const canSubmit = lines.length > 0 && data.draft.every((line) => line.readiness_status === "ready");
  const mutate = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await data.refresh();
    } catch {
      toast.error(BUYER_CART_UPDATE_ERROR);
    }
  };
  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const result = await customerAppClient.submit(getCheckoutIdempotencyKey(), requestedDispatchDate || undefined);
      const row = result?.[0];
      if (!row) throw new Error("Checkout returned no order");
      clearCheckoutIdempotencyKey();
      toast.success(row.order_number ? `Order ${row.order_number} submitted` : "Order submitted");
      await data.refresh();
      navigate(`/buyer/orders/${row.order_id}`);
    } catch {
      toast.error(BUYER_ORDER_SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="space-y-5" aria-labelledby="cart-heading">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground">Review before submission</p><h1 id="cart-heading" className="font-display text-3xl font-semibold">Your cart</h1></div><button type="button" onClick={() => { void mutate(() => customerAppClient.clearDraft()); }} disabled={lines.length === 0} className="min-h-11 text-xs text-muted-foreground disabled:opacity-50">Clear cart</button></div>
      {lines.length === 0 ? <Empty title="Your cart is empty" text="Browse the catalogue to add approved products." action={<button type="button" onClick={() => { navigate("/buyer/catalogue"); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Browse catalogue</button>} /> : (
        <>
          <div className="space-y-3">{lines.map((line) => {
            const product = productById.get(line.product_id);
            const price = priceById.get(line.product_id);
            const minimum = positiveNumber(price?.minimum_order_quantity);
            const increment = positiveNumber(price?.order_increment);
            const unitPrice = line.unit_price_snapshot ?? price?.selling_price;
            const lineTotal = typeof unitPrice === "number" ? Number(line.quantity || 0) * unitPrice : null;
            return <div key={line.line_id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-[var(--card-shadow)]"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"><BuyerProductImage src={product?.image_url || null} alt={line.product_name_snapshot || productTitle(product)} compact /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{line.product_name_snapshot || productTitle(product)}</p><p className="text-xs text-muted-foreground">SKU {line.sku_snapshot || product?.sku || "pending"} · {line.uom_snapshot || price?.uom || "unit"}</p><p className="text-xs text-muted-foreground">{money(unitPrice)} each · line preview {lineTotal === null ? "Not available" : money(lineTotal)}</p><p className="text-[11px] text-muted-foreground">Minimum {minimum}; increments of {increment}</p></div><div className="flex items-center gap-1"><button type="button" aria-label={`Decrease ${line.product_name_snapshot || "item"} quantity`} onClick={() => { void mutate(() => customerAppClient.updateLine(line.line_id, Math.max(minimum, Number(line.quantity || 1) - increment))); }} className="rounded-lg border p-2"><Minus size={14} aria-hidden /></button><span className="w-8 text-center text-sm" aria-live="polite">{line.quantity}</span><button type="button" aria-label={`Increase ${line.product_name_snapshot || "item"} quantity`} onClick={() => { void mutate(() => customerAppClient.updateLine(line.line_id, Number(line.quantity || 1) + increment)); }} className="rounded-lg border p-2"><Plus size={14} aria-hidden /></button><button type="button" aria-label={`Remove ${line.product_name_snapshot || "item"}`} onClick={() => { void mutate(() => customerAppClient.removeLine(line.line_id)); }} className="rounded-lg p-2 text-destructive"><Trash2 size={16} aria-hidden /></button></div></div>;
          })}</div>
          <div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><div className="flex justify-between text-sm"><span>Subtotal preview</span><strong>{total === null ? "Available after review" : money(total)}</strong></div><p className="mt-2 text-xs text-muted-foreground">This is a Core-provided line-price preview. Final tax, charges and the approved advance are resolved by Core at submission.</p>{!canSubmit && <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"><p className="font-semibold">Review your quantities before submitting</p><ul className="mt-1 list-disc pl-5">{readinessMessages.length > 0 ? readinessMessages.map((message) => <li key={message}>{message}</li>) : <li>Review the quantity and carton requirements before submitting.</li>}</ul></div>}<label className="mt-4 block text-sm font-medium" htmlFor="buyer-requested-dispatch-date">Requested dispatch date <span className="font-normal text-muted-foreground">(optional)</span><input id="buyer-requested-dispatch-date" type="date" value={requestedDispatchDate} min={getLocalDateInputValue()} onChange={(event) => { setRequestedDispatchDate(event.target.value); }} className="mt-1 w-full rounded-xl border bg-background px-3 py-3 text-sm" /></label><p className="mt-2 text-xs text-muted-foreground">Core validates and preserves this request on the governed order.</p><button type="button" disabled={submitting || !canSubmit} onClick={() => { void submit(); }} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{submitting && <Loader2 size={16} className="animate-spin" aria-hidden />}{submitting ? "Submitting…" : "Submit order"}</button></div>
        </>
      )}
    </section>
  );
}

function BuyerSoReference({ orderNumber }: { orderNumber: string | null | undefined }) {
  return <span>{orderNumber || "Sales order reference pending"}</span>;
}

function BuyerFinalPaymentPiSummary({ facts }: { facts: BuyerFinalPaymentPiFacts | null | undefined }) {
  if (!facts?.available) return null;
  return (
    <div className="mt-4 rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]" aria-label="Final payment request">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">Final payment</h2>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-right text-xs font-semibold text-primary">
          {facts.settled ? "Settled" : "Payment due"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Governed final-payment demand under {facts.customer_visible_pi_number || "your proforma invoice"}.
        The final tax invoice is issued only after this balance is settled.
      </p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <span>Final payable</span><strong className="text-right">{money(facts.final_payable_total)}</strong>
        <span>Balance due</span><strong className="text-right">{money(facts.balance_due)}</strong>
      </div>
      {facts.payment_instructions && <p className="mt-3 text-xs text-muted-foreground">{facts.payment_instructions}</p>}
      {facts.payment_action === "PAY_NOW" && facts.payment_link && (
        <a href={facts.payment_link} className="mt-3 inline-flex text-sm font-semibold text-primary" target="_blank" rel="noreferrer">
          Open payment link
        </a>
      )}
      {facts.facts_as_of && <p className="mt-2 text-[11px] text-muted-foreground">Facts updated {formatDate(facts.facts_as_of)}</p>}
    </div>
  );
}

function BuyerFinanceSummary({ facts }: { facts: BuyerFinanceFacts | null | undefined }) {
  if (!facts?.customer_safe_projection) return null;
  return (
    <div className="mt-4 rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]" aria-label="Authoritative Finance facts">
      <div className="flex items-start justify-between gap-3"><h2 className="font-semibold">Payment and Finance</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-right text-xs font-semibold text-primary">{customerFinanceStatusLabel(facts.finance_status)}</span></div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <span>Order value</span><strong className="text-right">{money(facts.commercial_value)}</strong>
        <span>Required advance</span><strong className="text-right">{money(facts.required_advance)}</strong>
        <span>Verified payment</span><strong className="text-right">{money(facts.verified_payment_amount)}</strong>
        <span>Wallet applied</span><strong className="text-right">{money(facts.wallet_applied_amount)}</strong>
        <span>Approved credit</span><strong className="text-right">{money(facts.approved_credit_amount)}</strong>
        <span>Covered amount</span><strong className="text-right">{money(facts.covered_amount)}</strong>
      </div>
      {facts.advance_covered !== null && <p className="mt-3 text-xs text-muted-foreground">Advance coverage: {facts.advance_covered ? "covered" : "not yet covered"}</p>}
      {facts.pi_status && <p className="mt-2 text-xs text-muted-foreground">Proforma invoice: {facts.pi_status.toUpperCase() === "ISSUED" && facts.pi_number ? facts.pi_number : facts.pi_status.toUpperCase() === "READY_FOR_ISSUE" ? "Preparing" : "Not yet available"}</p>}
      {facts.facts_as_of && <p className="mt-2 text-[11px] text-muted-foreground">Facts updated {formatDate(facts.facts_as_of)}</p>}
    </div>
  );
}

/** Presents customer-safe order status and links to the governed detail view. */
function Orders({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const navigate = useNavigate();
  return (
    <section className="space-y-5" aria-labelledby="orders-heading"><div><p className="text-sm text-muted-foreground">Customer-safe progress</p><h1 id="orders-heading" className="font-display text-3xl font-semibold">Your orders</h1></div>{data.orders.length === 0 ? <Empty title="No orders yet" text="Your submitted orders will appear here." action={<button type="button" onClick={() => { navigate("/buyer/catalogue"); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Start shopping</button>} /> : <div className="space-y-3">{data.orders.map((order) => { const finance = data.financeFacts[order.order_id]; const financeStatus = finance?.customer_safe_projection && finance.finance_status ? finance.finance_status : order.finance_status; const action = customerFinanceAction(financeStatus) || customerOrderAction(order.payment_stage); return <button type="button" key={order.order_id} onClick={() => { navigate(`/buyer/orders/${order.order_id}`); }} className="w-full rounded-2xl border bg-card p-4 text-left shadow-[var(--card-shadow)] transition-colors hover:border-primary/60"><div className="flex items-start justify-between gap-3"><strong><BuyerSoReference orderNumber={order.order_number} /></strong><span className="rounded-full bg-primary/10 px-2 py-1 text-right text-xs font-semibold text-primary">{customerOrderStageLabel(order.customer_stage)}</span></div>{action && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertCircle size={13} aria-hidden /> {action}</p>}<div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground"><span>Placed {formatDate(order.created_at)}</span><span className="text-right">{money(order.order_value)}</span><span>Requested dispatch</span><span className="text-right">{order.requested_dispatch_date || "Not requested"}</span><span>Promised dispatch</span><span className="text-right">{order.promised_dispatch_date || "To be confirmed"}</span>{financeStatus && <><span>Finance</span><span className="text-right">{customerFinanceStatusLabel(financeStatus)}</span></>}</div><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">View order <ChevronRight size={14} aria-hidden /></span></button>; })}</div>}</section>
  );
}

/** Shows one company-scoped order and re-adds its lines through Core draft RPCs. */
function OrderDetail({ data, orderId }: { data: ReturnType<typeof useBuyerData>; orderId: string }) {
  const navigate = useNavigate();
  const order = data.orders.find((item) => item.order_id === orderId);
  const lines = data.items.filter((item) => item.order_id === orderId);
  const finance = data.financeFacts[orderId];
  const finalPaymentPi = data.finalPaymentPiFacts[orderId];
  const commercial = data.commercialFacts.find((facts) => facts.order_id === orderId);
  const [reordering, setReordering] = useState(false);
  if (!order) return <Empty title="Order not found" text="This order is not available for your company." />;
  const reorder = async () => {
    setReordering(true);
    try {
      for (const line of lines) await customerAppClient.addLine(line.product_id, line.quantity);
      await data.refresh();
      toast.success("Order items added to your cart");
      navigate("/buyer/cart");
    } catch {
      toast.error(BUYER_REORDER_ERROR);
    } finally {
      setReordering(false);
    }
  };
  const financeStatus = finance?.customer_safe_projection && finance.finance_status ? finance.finance_status : order.finance_status || commercial?.finance_status;
  const displayedOrderValue = finance?.customer_safe_projection
    ? finance.commercial_value ?? commercial?.frozen_sales_order_value ?? order.order_value
    : commercial?.frozen_sales_order_value ?? order.order_value;
  const displayedRequestedDate = commercial?.requested_dispatch_date ?? order.requested_dispatch_date;
  const displayedPromisedDate = commercial?.promised_dispatch_date ?? order.promised_dispatch_date;
  return (
    <section className="space-y-5" aria-labelledby="order-detail-heading"><Link to="/buyer/orders" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} aria-hidden /> Back to orders</Link><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted-foreground"><BuyerSoReference orderNumber={order.order_number} /></p><h1 id="order-detail-heading" className="font-display text-3xl font-semibold">Order details</h1></div><button type="button" disabled={reordering || lines.length === 0} onClick={() => { void reorder(); }} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{reordering ? "Adding…" : "Reorder"}</button></div><div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><div className="flex justify-between"><span>Status</span><strong className="text-primary">{customerOrderStageLabel(order.customer_stage)}</strong></div><div className="mt-2 flex justify-between text-sm"><span>Payment</span><span>{customerPaymentStageLabel(order.payment_stage)}</span></div><div className="mt-2 flex justify-between text-sm"><span>SO value</span><span>{money(displayedOrderValue)}</span></div>{commercial?.commercial_version_number != null && <div className="mt-2 flex justify-between text-sm"><span>Commercial version</span><span>v{commercial.commercial_version_number}</span></div>}<div className="mt-2 flex justify-between text-sm"><span>Requested dispatch</span><span>{displayedRequestedDate || "Not requested"}</span></div><div className="mt-2 flex justify-between text-sm"><span>Promised dispatch</span><span>{displayedPromisedDate || "To be confirmed"}</span></div>{financeStatus && <div className="mt-2 flex justify-between text-sm"><span>Finance</span><span>{customerFinanceStatusLabel(financeStatus)}</span></div>}{(order.tracking_number || order.courier_name) && <div className="mt-2 flex justify-between text-sm"><span>Tracking</span><span>{[order.courier_name, order.tracking_number].filter(Boolean).join(" · ")}</span></div>}</div><BuyerFinanceSummary facts={finance} /><BuyerFinalPaymentPiSummary facts={finalPaymentPi} /><div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><h2 className="mb-4 font-semibold">Order progress</h2><CustomerOrderTimeline steps={buildCustomerOrderTimeline({ customerStage: order.customer_stage, paymentStage: order.payment_stage, orderNumber: order.order_number })} /></div><div className="space-y-2"><h2 className="font-semibold">Items</h2>{lines.length === 0 ? <Empty title="Items not available" text="Core has not returned line details yet." /> : lines.map((line) => <div key={line.item_id} className="flex justify-between rounded-xl border bg-card p-3 text-sm"><span>{line.product_name || line.sku || "Product"} × {line.quantity}<span className="block text-xs text-muted-foreground">SKU {line.sku || "pending"} · {line.pack_size || "unit"}</span></span><span>{line.weight_kg ? `${line.weight_kg} kg` : ""}</span></div>)}</div><Link to="/buyer/support" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Need help with this order? <ChevronRight size={15} aria-hidden /></Link></section>
  );
}

/** Displays company context and approved team membership returned by Core. */
function Account({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const { logout } = useAuth();
  return (
    <section className="space-y-5" aria-labelledby="account-heading"><div><p className="text-sm text-muted-foreground">Customer context</p><h1 id="account-heading" className="font-display text-3xl font-semibold">Account</h1></div><div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><h2 className="font-semibold">{data.company?.business_name || "Your company"}</h2><p className="mt-1 text-sm text-muted-foreground">{companyStatusLabel(data.company?.status)}</p><p className="mt-3 text-sm">{data.company?.registered_address || "Company address not available"}</p>{data.company?.phone && <p className="mt-2 text-sm text-muted-foreground">Phone: {data.company.phone}</p>}{data.company?.payment_terms && <p className="mt-2 text-sm text-muted-foreground">Payment terms: {data.company.payment_terms}</p>}{data.company?.gst_number && <p className="mt-2 text-xs text-muted-foreground">GST details on file</p>}</div><div className="grid gap-3 sm:grid-cols-3"><Link to="/buyer/orders" className="rounded-xl border bg-card p-4 text-sm font-semibold">Orders <ChevronRight size={15} className="inline" aria-hidden /></Link><Link to="/buyer/documents" className="rounded-xl border bg-card p-4 text-sm font-semibold">Documents <ChevronRight size={15} className="inline" aria-hidden /></Link><Link to="/buyer/support" className="rounded-xl border bg-card p-4 text-sm font-semibold">Support <ChevronRight size={15} className="inline" aria-hidden /></Link></div><div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><h2 className="font-semibold">Team</h2>{data.team.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No additional approved buyers.</p> : data.team.map((member) => <div key={member.profile_id} className="mt-2 flex justify-between gap-3 text-sm"><span>{member.full_name || member.email || "Approved team member"}</span><span className="text-right text-muted-foreground">{teamRoleLabel(member.role)}</span></div>)}</div><button type="button" onClick={() => { void logout(); }} className="flex min-h-11 items-center gap-2 rounded-xl border px-4 py-3 text-sm"><LogOut size={16} aria-hidden /> Sign out</button></section>
  );
}

type DocumentAvailability = "available" | "preparing" | "not-issued" | "upstream-unavailable";

function documentStatusLabel(status: DocumentAvailability): string {
  if (status === "available") return "Available";
  if (status === "preparing") return "Preparing";
  if (status === "not-issued") return "Not yet issued";
  return "Not available yet";
}

function CustomerDocumentCard({ label, status, detail, href }: { label: string; status: DocumentAvailability; detail: string; href?: string }) {
  const body = <><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">{label}</h2><span className="rounded-full bg-muted px-2 py-1 text-right text-xs font-semibold text-muted-foreground">{documentStatusLabel(status)}</span></div><p className="mt-2 text-sm text-muted-foreground">{detail}</p>{href ? <span className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-primary">View orders <ChevronRight size={15} aria-hidden /></span> : null}</>;
  return href ? <Link to={href} className="block rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)] transition-colors hover:border-primary/60">{body}</Link> : <div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]">{body}</div>;
}

function documentAvailability(value: string | null | undefined): DocumentAvailability {
  if (value === "issued") return "available";
  if (value === "preparing") return "preparing";
  return "upstream-unavailable";
}

function documentDetail(document: BuyerDocument | undefined, fallback: string): string {
  if (!document) return fallback;
  if (document.availability_state === "issued" && document.document_number) return `Reference ${document.document_number} is available.`;
  if (document.availability_state === "preparing") return "This document is being prepared and will appear here when issued.";
  return "This document is not available yet.";
}

function proformaAvailability(invoice: BuyerProformaInvoiceFacts | undefined, document: BuyerDocument | undefined): DocumentAvailability {
  if (invoice) return invoice.status?.toUpperCase() === "ISSUED" && invoice.customer_visible_pi_number ? "available" : "preparing";
  return document ? documentAvailability(document.availability_state) : "upstream-unavailable";
}

function proformaDetail(invoice: BuyerProformaInvoiceFacts | undefined, document: BuyerDocument | undefined): string {
  if (!invoice) return document ? documentDetail(document, "This document will appear here when it is issued.") : "This document will appear here when it is issued.";
  if (invoice.status?.toUpperCase() === "ISSUED" && invoice.customer_visible_pi_number) return `Reference ${invoice.customer_visible_pi_number} is available.`;
  return "This document is being prepared and will appear here when issued.";
}

function StatementFacts({ statement }: { statement: BuyerStatement | null }) {
  if (!statement?.statement_facts_only) return null;
  return <div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]" aria-label="Statement facts"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold">Statement facts</h2><span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">Available</span></div><p className="mt-2 text-sm text-muted-foreground">Customer-safe ledger facts supplied by Finance.</p>{statement.wallet_balance !== null && <div className="mt-3 flex justify-between text-sm"><span>Wallet balance</span><strong>{money(statement.wallet_balance)}</strong></div>}<div className="mt-3 space-y-2">{statement.entries.length === 0 ? <p className="text-sm text-muted-foreground">No issued statement entries yet.</p> : statement.entries.map((entry, index) => <div key={`${entry.order_id || "entry"}-${index}`} className="rounded-xl border p-3 text-sm"><div className="flex justify-between gap-3"><span>{entry.invoice_number || "Issued invoice"}</span><span>{money(entry.invoice_gross_total)}</span></div>{entry.pre_dispatch_net_due !== null && <p className="mt-1 text-xs text-muted-foreground">Amount due before dispatch: {money(entry.pre_dispatch_net_due)}</p>}</div>)}</div></div>;
}

function BuyerOrderDocuments({ order, data }: { order: BuyerOrder; data: ReturnType<typeof useBuyerData> }) {
  const orderDocuments = data.documents.filter((document) => document.order_id === order.order_id);
  const salesOrder = orderDocuments.find((document) => document.document_type === "SALES_ORDER");
  const proforma = data.proformaInvoices.find((invoice) => invoice.order_id === order.order_id);
  const proformaDocument = orderDocuments.find((document) => document.document_type === "PROFORMA_INVOICE");
  const finalInvoice = orderDocuments.find((document) => document.document_type === "FINAL_INVOICE");
  const salesOrderDetail = salesOrder
    ? documentDetail(salesOrder, "Your submitted order reference is available in Orders.")
    : "Your submitted order reference is available in Orders.";
  const finalInvoiceStatus = finalInvoice ? documentAvailability(finalInvoice.availability_state) : "upstream-unavailable";
  const finalInvoiceDetail = finalInvoice ? documentDetail(finalInvoice, "This document will appear here when it is issued.") : "This document will appear here when it is issued.";
  return <div className="space-y-3" aria-labelledby={`documents-order-${order.order_id}`}><div><h2 id={`documents-order-${order.order_id}`} className="font-semibold">{order.order_number || "Sales order reference pending"}</h2><p className="text-xs text-muted-foreground">Documents for this order</p></div><div className="grid gap-3 sm:grid-cols-2"><CustomerDocumentCard label="Sales Order" status={salesOrder ? documentAvailability(salesOrder.availability_state) : "available"} detail={salesOrderDetail} href="/buyer/orders" /><CustomerDocumentCard label="Proforma Invoice" status={proformaAvailability(proforma, proformaDocument)} detail={proformaDetail(proforma, proformaDocument)} /><CustomerDocumentCard label="Final Invoice" status={finalInvoiceStatus} detail={finalInvoiceDetail} /></div></div>;
}

/** Presents authoritative document, PI and statement facts without fabricating files or numbers. */
function Documents({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const hasOrders = data.orders.length > 0;
  const statementStatus: DocumentAvailability = data.statement?.statement_facts_only ? "available" : "upstream-unavailable";
  return <section className="space-y-5" aria-labelledby="documents-heading"><div><p className="text-sm text-muted-foreground">Customer documents</p><h1 id="documents-heading" className="font-display text-3xl font-semibold">Documents</h1><p className="mt-2 text-sm text-muted-foreground">Documents appear when issued</p><p className="text-sm text-muted-foreground">We never create local numbers or files.</p></div>{hasOrders ? <div className="space-y-6">{data.orders.map((order) => <BuyerOrderDocuments key={order.order_id} order={order} data={data} />)}</div> : <div className="grid gap-3 sm:grid-cols-2"><CustomerDocumentCard label="Sales Order" status="not-issued" detail="Your Sales Order reference will appear after a successful submission." /><CustomerDocumentCard label="Proforma Invoice" status="upstream-unavailable" detail="This document will appear when your order is ready." /><CustomerDocumentCard label="Final Invoice" status="upstream-unavailable" detail="This document will appear here when it is issued." /></div>}<div className="grid gap-3 sm:grid-cols-2"><CustomerDocumentCard label="Statement" status={statementStatus} detail={data.statement?.statement_facts_only ? "Statement facts are available below." : "Statements will appear here when they are available."} /></div><StatementFacts statement={data.statement} />{!hasOrders && <Link to="/buyer/catalogue" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Browse catalogue</Link>}</section>;
}

/** Submits support tickets through the customer-safe Core contract. */
function Support({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const [orderId, setOrderId] = useState("");
  const [issue, setIssue] = useState("Damaged goods");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [querySubject, setQuerySubject] = useState("");
  const [queryMessage, setQueryMessage] = useState("");
  const [queryCategory, setQueryCategory] = useState<(typeof GENERAL_QUERY_CATEGORIES)[number]>("GENERAL");
  const [querySending, setQuerySending] = useState(false);
  const submit = async () => {
    if (!orderId || !description.trim() || sending) return;
    setSending(true);
    try {
      await customerAppClient.submitTicket(orderId, issue, description.trim());
      toast.success("Support ticket submitted");
      setDescription("");
      await data.refresh();
    } catch {
      toast.error(BUYER_SUPPORT_ERROR);
    } finally {
      setSending(false);
    }
  };
  const submitGeneralQuery = async () => {
    if (querySending || querySubject.trim().length < 3 || queryMessage.trim().length < 10) return;
    setQuerySending(true);
    try {
      const result = await customerAppClient.submitGeneralQuery({
        idempotencyKey: getGeneralQueryIdempotencyKey(),
        subject: querySubject.trim(),
        message: queryMessage.trim(),
        category: queryCategory,
      });
      if (!result?.[0]) throw new Error("Enquiry was not acknowledged");
      clearGeneralQueryIdempotencyKey();
      setQuerySubject("");
      setQueryMessage("");
      toast.success("Enquiry submitted");
      await data.refresh();
    } catch {
      toast.error(BUYER_QUERY_ERROR);
    } finally {
      setQuerySending(false);
    }
  };
  return <section className="space-y-5" aria-labelledby="support-heading"><div><p className="text-sm text-muted-foreground">We are here to help</p><h1 id="support-heading" className="font-display text-3xl font-semibold">Support</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Order support and general enquiries are separate from checkout and use separate governed paths. A general enquiry never creates an order.</p></div><div className="space-y-3 rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><h2 className="font-semibold">Order support</h2><p className="text-sm text-muted-foreground">Choose an order so Core can route the request safely. This form does not create or change an order.</p><label htmlFor="buyer-support-order" className="block text-sm font-medium">Order</label><select id="buyer-support-order" value={orderId} onChange={(event) => { setOrderId(event.target.value); }} className="w-full rounded-xl border bg-background px-3 py-3 text-sm"><option value="">Select an order</option>{data.orders.map((order) => <option key={order.order_id} value={order.order_id}>{order.order_number || "Order reference pending"}</option>)}</select><label htmlFor="buyer-support-issue" className="block text-sm font-medium">Issue type</label><select id="buyer-support-issue" value={issue} onChange={(event) => { setIssue(event.target.value); }} className="w-full rounded-xl border bg-background px-3 py-3 text-sm"><option>Damaged goods</option><option>Missing items</option><option>Wrong shipment</option><option>Delivery question</option><option>Other order question</option></select><label htmlFor="buyer-support-description" className="block text-sm font-medium">What happened?</label><textarea id="buyer-support-description" value={description} onChange={(event) => { setDescription(event.target.value); }} placeholder="Describe the issue" rows={4} className="w-full rounded-xl border bg-background px-3 py-3 text-sm" /><button type="button" disabled={sending || !orderId || !description.trim()} onClick={() => { void submit(); }} className="min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{sending ? "Submitting…" : "Submit ticket"}</button></div><div className="space-y-3 rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><h2 className="font-semibold">General enquiry</h2><p className="text-sm text-muted-foreground">Ask a question without attaching it to an order.</p><label htmlFor="buyer-general-query-category" className="block text-sm font-medium">Category</label><select id="buyer-general-query-category" value={queryCategory} onChange={(event) => { setQueryCategory(event.target.value as (typeof GENERAL_QUERY_CATEGORIES)[number]); }} className="w-full rounded-xl border bg-background px-3 py-3 text-sm">{GENERAL_QUERY_CATEGORIES.map((category) => <option key={category} value={category}>{category[0] + category.slice(1).toLowerCase()}</option>)}</select><label htmlFor="buyer-general-query-subject" className="block text-sm font-medium">Subject</label><input id="buyer-general-query-subject" value={querySubject} onChange={(event) => { setQuerySubject(event.target.value); }} placeholder="What can we help with?" className="w-full rounded-xl border bg-background px-3 py-3 text-sm" /><label htmlFor="buyer-general-query-message" className="block text-sm font-medium">Message</label><textarea id="buyer-general-query-message" value={queryMessage} onChange={(event) => { setQueryMessage(event.target.value); }} placeholder="Tell us more" rows={4} className="w-full rounded-xl border bg-background px-3 py-3 text-sm" /><button type="button" disabled={querySending || querySubject.trim().length < 3 || queryMessage.trim().length < 10} onClick={() => { void submitGeneralQuery(); }} className="min-h-12 rounded-xl border px-4 py-3 text-sm font-bold text-primary disabled:opacity-50">{querySending ? "Submitting…" : "Submit general enquiry"}</button></div><div className="space-y-4 rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]" aria-labelledby="buyer-communication-log-heading"><h2 id="buyer-communication-log-heading" className="font-semibold">Communication log</h2><p className="text-sm text-muted-foreground">Order-linked tickets and general enquiries submitted through governed paths, shown newest first.</p><BuyerCommunicationLog tickets={data.tickets} generalQueries={data.generalQueries} /></div></section>;
}

/** Presents the safe Buyer home summary, prioritising action and operations. */
function Home({ data }: { data: ReturnType<typeof useBuyerData> }) {
  const navigate = useNavigate();
  const actionOrder = data.orders.find((order) => {
    const finance = data.financeFacts[order.order_id];
    const financeStatus = finance?.customer_safe_projection && finance.finance_status ? finance.finance_status : order.finance_status;
    return customerFinanceAction(financeStatus) || customerOrderAction(order.payment_stage);
  });
  const recentOrders = [...data.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const latestOrder = recentOrders[0];
  const latestFinance = latestOrder ? data.financeFacts[latestOrder.order_id] : undefined;
  const actionLabel = actionOrder ? (() => {
    const finance = data.financeFacts[actionOrder.order_id];
    const financeStatus = finance?.customer_safe_projection && finance.finance_status ? finance.finance_status : actionOrder.finance_status;
    return customerFinanceAction(financeStatus) || customerOrderAction(actionOrder.payment_stage);
  })() : null;
  return <section className="space-y-5" aria-labelledby="dashboard-heading"><SystemAlertMarquee /><div className="rounded-3xl bg-[#5f6848] p-6 text-white shadow-[var(--card-shadow)]"><p className="text-sm opacity-80">Welcome back</p><h1 id="dashboard-heading" className="mt-1 font-display text-3xl font-semibold">{data.company?.business_name || "Oasis buyer"}</h1><p className="mt-3 max-w-md text-sm opacity-90">Browse approved products, keep carton rules intact, and submit a governed order in a few taps.</p><p className="mt-4 text-xs font-semibold uppercase tracking-wide opacity-80">{companyStatusLabel(data.company?.status)}</p></div>{actionOrder && actionLabel && <Link to={`/buyer/orders/${actionOrder.order_id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><span><strong>Action needed:</strong> {actionLabel} for <BuyerSoReference orderNumber={actionOrder.order_number} /></span><ChevronRight size={18} aria-hidden /></Link>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><button type="button" onClick={() => { navigate("/buyer/catalogue"); }} className="rounded-2xl border bg-card p-4 text-left shadow-[var(--card-shadow)]"><ShoppingBag className="text-primary" aria-hidden /><p className="mt-3 font-semibold">New order</p><p className="text-xs text-muted-foreground">Browse catalogue and approved order rules</p></button>{latestOrder ? <Link to={`/buyer/orders/${latestOrder.order_id}`} className="rounded-2xl border bg-card p-4 text-left shadow-[var(--card-shadow)]"><Package className="text-primary" aria-hidden /><p className="mt-3 font-semibold">Reorder</p><p className="text-xs text-muted-foreground">Use your latest order as a starting point</p></Link> : <div className="rounded-2xl border bg-card p-4 text-left opacity-70"><Package className="text-primary" aria-hidden /><p className="mt-3 font-semibold">Reorder</p><p className="text-xs text-muted-foreground">Available after your first order</p></div>}<Link to="/buyer/orders" className="rounded-2xl border bg-card p-4 text-left shadow-[var(--card-shadow)]"><Package className="text-primary" aria-hidden /><p className="mt-3 font-semibold">Track Order</p><p className="text-xs text-muted-foreground">See status and dispatch updates</p></Link><button type="button" onClick={() => { navigate("/buyer/cart"); }} className="rounded-2xl border bg-card p-4 text-left shadow-[var(--card-shadow)]"><ShoppingBag className="text-primary" aria-hidden /><p className="mt-3 font-semibold">Open cart</p><p className="text-xs text-muted-foreground">{data.draft.filter((line) => line.line_id).length} lines in progress</p></button><button type="button" onClick={() => { navigate("/buyer/support"); }} className="rounded-2xl border bg-card p-4 text-left shadow-[var(--card-shadow)]"><LifeBuoy className="text-primary" aria-hidden /><p className="mt-3 font-semibold">Get support</p><p className="text-xs text-muted-foreground">{buyerCommunicationLogCount(data.tickets, data.generalQueries)} communications</p></button></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Submitted orders</p><p className="mt-1 text-2xl font-semibold">{data.orders.length}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Cart lines</p><p className="mt-1 text-2xl font-semibold">{data.draft.filter((line) => line.line_id).length}</p></div><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">Communications</p><p className="mt-1 text-2xl font-semibold">{buyerCommunicationLogCount(data.tickets, data.generalQueries)}</p></div></div>{latestFinance?.customer_safe_projection && <BuyerFinanceSummary facts={latestFinance} />}{recentOrders.length > 0 && <div className="rounded-2xl border bg-card p-5 shadow-[var(--card-shadow)]"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent orders</h2><Link to="/buyer/orders" className="text-xs font-semibold text-primary">View all</Link></div><div className="mt-3 space-y-2">{recentOrders.map((order) => <Link key={order.order_id} to={`/buyer/orders/${order.order_id}`} className="flex items-center justify-between rounded-xl border p-3 text-sm"><span><BuyerSoReference orderNumber={order.order_number} /><span className="block text-xs text-muted-foreground">{customerOrderStageLabel(order.customer_stage)}</span></span><ChevronRight size={16} className="text-muted-foreground" aria-hidden /></Link>)}</div></div>}</section>;
}

/** Provides a consistent customer-safe empty state with an optional action. */
function Empty({ title: heading, text, action, icon }: { title: string; text: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-10 text-center">{icon || <CheckCircle2 size={28} className="mx-auto text-muted-foreground" aria-hidden />}<h2 className="mt-3 font-semibold">{heading}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function BuyerLoading() {
  return <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3" role="status" aria-live="polite"><Loader2 className="animate-spin text-primary" aria-hidden /><span className="text-sm text-muted-foreground">Loading your Buyer workspace…</span></div>;
}

function BuyerDataError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm"><AlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" aria-hidden /><div className="flex-1"><p className="font-semibold">Some Buyer data could not be refreshed</p><p className="mt-1 text-muted-foreground">{message}</p></div><button type="button" onClick={onRetry} className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-semibold"><RefreshCw size={13} aria-hidden /> Retry</button></div>;
}

function BuyerNotFound() {
  return <section className="space-y-4 rounded-2xl border border-dashed bg-card p-8 text-center" aria-labelledby="buyer-not-found-heading"><h1 id="buyer-not-found-heading" className="font-display text-2xl font-semibold">Buyer page not found</h1><p className="text-sm text-muted-foreground">That customer page is no longer available. Choose a current Buyer destination below.</p><div className="flex flex-wrap justify-center gap-3"><Link to="/buyer" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Go to dashboard</Link><Link to="/buyer/catalogue" className="inline-flex min-h-11 items-center rounded-xl border px-4 py-3 text-sm font-semibold">Browse catalogue</Link></div></section>;
}

/** Submits a governed Buyer access request; approval remains an internal decision. */
export function BuyerAccessRequest() {
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    gstNumber: "",
    address: "",
    preferredDispatch: "",
    preferredDispatchOtherName: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submit = async () => {
    if (!form.businessName.trim() || !form.contactName.trim() || !form.contactEmail.trim() || !form.contactPhone.trim() || submitting) return;
    setSubmitting(true);
    try {
      await customerAppClient.submitApplication({
        ...form,
        preferredDispatch: form.preferredDispatch || null,
        preferredDispatchOtherName: form.preferredDispatch === "OTHER" ? form.preferredDispatchOtherName || null : null,
      });
      setSubmitted(true);
      toast.success("Access request submitted");
    } catch {
      toast.error(BUYER_ACCESS_REQUEST_ERROR);
    } finally {
      setSubmitting(false);
    }
  };
  if (submitted) return <main className="appverse-shell flex min-h-screen items-center px-6"><div className="mx-auto w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-[var(--card-shadow)]"><CheckCircle2 size={32} className="mx-auto text-primary" aria-hidden /><h1 className="mt-3 font-display text-2xl font-semibold">Request received</h1><p className="mt-2 text-sm text-muted-foreground">Our team will review your company details and activate Buyer access when approved.</p></div></main>;
  const fields = [
    { key: "businessName", label: "Business name", type: "text", required: true, autoComplete: "organization" },
    { key: "contactName", label: "Contact name", type: "text", required: true, autoComplete: "name" },
    { key: "contactEmail", label: "Work email", type: "email", required: true, autoComplete: "email" },
    { key: "contactPhone", label: "Phone number", type: "tel", required: true, autoComplete: "tel" },
    { key: "gstNumber", label: "GST number (optional)", type: "text", required: false, autoComplete: "off" },
    { key: "address", label: "Registered address (optional)", type: "text", required: false, autoComplete: "street-address" },
  ] as const;
  const dispatchOptions = [
    { value: "", label: "No preference yet" },
    { value: "OWN_PICKUP", label: "Own pickup / self collection" },
    { value: "OASIS_ARRANGED", label: "Oasis arranged delivery" },
    { value: "OTHER", label: "Preferred transporter (specify below)" },
  ] as const;
  return <main className="appverse-shell min-h-screen px-6 py-10"><div className="mx-auto max-w-lg"><p className="text-sm text-muted-foreground">Oasis Baklawa B2B</p><h1 className="mt-1 font-display text-3xl font-semibold">Request Buyer access</h1><p className="mt-2 text-sm text-muted-foreground">Tell us about your company. Approval is required before catalogue pricing and checkout are available.</p><form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>{fields.map((field) => <label key={field.key} htmlFor={`buyer-access-${field.key}`} className="block text-sm font-medium">{field.label}<input id={`buyer-access-${field.key}`} name={field.key} type={field.type} autoComplete={field.autoComplete} required={field.required} value={form[field.key]} onChange={(event) => { setForm((current) => ({ ...current, [field.key]: event.target.value })); }} className="mt-1 w-full rounded-xl border bg-card px-3 py-3" /></label>)}<label htmlFor="buyer-access-preferred-dispatch" className="block text-sm font-medium">Dispatch preference (optional)<select id="buyer-access-preferred-dispatch" name="preferredDispatch" value={form.preferredDispatch} onChange={(event) => { setForm((current) => ({ ...current, preferredDispatch: event.target.value })); }} className="mt-1 w-full rounded-xl border bg-card px-3 py-3">{dispatchOptions.map((option) => <option key={option.value || "none"} value={option.value}>{option.label}</option>)}</select></label>{form.preferredDispatch === "OTHER" && <label htmlFor="buyer-access-preferred-dispatch-other" className="block text-sm font-medium">Preferred transporter name<input id="buyer-access-preferred-dispatch-other" name="preferredDispatchOtherName" value={form.preferredDispatchOtherName} onChange={(event) => { setForm((current) => ({ ...current, preferredDispatchOtherName: event.target.value })); }} className="mt-1 w-full rounded-xl border bg-card px-3 py-3" /></label>}<button type="submit" disabled={submitting} className="min-h-12 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{submitting ? "Submitting…" : "Submit access request"}</button></form></div></main>;
}

/** Routes the authenticated Buyer through the complete customer-facing journey. */
export default function BuyerApp() {
  const location = useLocation();
  const data = useBuyerData();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  let content: ReactNode;
  if (path === "/buyer") content = <Home data={data} />;
  else if (/^\/buyer\/product\/[^/]+$/.test(path)) content = <Navigate to={`/buyer/catalogue/${path.split("/").pop() || ""}`} replace />;
  else if (/^\/buyer\/catalogue\/[^/]+$/.test(path)) content = <ProductDetail data={data} productId={path.split("/").pop() || ""} />;
  else if (path === "/buyer/catalogue" || path === "/buyer/catalogue/") content = <Catalogue data={data} />;
  else if (path === "/buyer/cart") content = <Cart data={data} />;
  else if (path === "/buyer/orders") content = <Orders data={data} />;
  else if (/^\/buyer\/orders\/[^/]+$/.test(path)) content = <OrderDetail data={data} orderId={path.split("/").pop() || ""} />;
  else if (path === "/buyer/account") content = <Account data={data} />;
  else if (path === "/buyer/documents") content = <Documents data={data} />;
  else if (path === "/buyer/support") content = <Support data={data} />;
  else content = <BuyerNotFound />;
  return <div className="appverse-shell min-h-screen bg-background pb-28 font-body text-foreground sm:pb-0"><BuyerNav /><BuyerSupportFab /><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{data.error && !data.loading && <BuyerDataError message={data.error} onRetry={() => { void data.refresh(); }} />}{data.loading ? <BuyerLoading /> : <>{content}<button type="button" onClick={() => { void data.refresh(); }} className="mt-8 inline-flex min-h-10 items-center gap-2 text-xs text-muted-foreground"><RefreshCw size={13} aria-hidden /> Refresh</button></>}</main></div>;
}
