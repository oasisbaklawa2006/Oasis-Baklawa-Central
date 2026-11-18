import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchPacketById } from "@/components/whatsapp/operatorInboxPacketsLoader";

type PacketMatch = {
  id: string;
  customer: string;
  phone: string;
  lastMessageAt: string | null;
  status: string;
};

const MAX_MATCHES = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function phoneVariants(value: string): string[] {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("Enter a full sender phone number (8–15 digits).");
  const options = new Set([trimmed, digits, `+${digits}`]);
  if (digits.length === 10) {
    options.add(`91${digits}`);
    options.add(`+91${digits}`);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    options.add(digits.slice(2));
    options.add(`+${digits.slice(2)}`);
  }
  return [...options];
}

/**
 * Read-only lookup for source records not represented by a department task.
 * All queries run with the signed-in operator's Supabase RLS context.
 * The operator must explicitly select a governed packet before drafting.
 */
export async function findOperatorInboxSourcePackets(
  kind: "provider" | "phone",
  source: string,
): Promise<PacketMatch[]> {
  if (kind === "provider") {
    const providerId = source.trim();
    if (!providerId || providerId.length > 160) throw new Error("Enter a valid provider message ID.");
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("packet_id")
      .eq("provider_message_id", providerId)
      .limit(MAX_MATCHES);
    if (error) throw error;

    const ids = [...new Set((data ?? [])
      .map((row) => row.packet_id)
      .filter((id): id is string => typeof id === "string" && UUID.test(id)))];
    const packets = await Promise.all(ids.map((id) => fetchPacketById(id)));
    return packets.filter((p): p is NonNullable<typeof p> => p !== null).map((packet) => ({
      id: packet.id,
      customer: packet.customer_name ?? "Unknown customer",
      phone: packet.phone_number ?? "",
      lastMessageAt: packet.last_message_at,
      status: packet.status,
    }));
  }

  // Validate before constructing any query; malformed input must not touch customer data.
  const candidates = phoneVariants(source);
  const { data: contacts, error: contactError } = await supabase
    .from("whatsapp_contacts")
    .select("id,phone_number,customer_name")
    .in("phone_number", candidates)
    .limit(MAX_MATCHES);
  if (contactError) throw contactError;
  if (!contacts?.length) return [];
  const byId = new Map(contacts.map((c) => [c.id, c]));
  const { data, error } = await supabase
    .from("whatsapp_message_packets")
    .select("id,contact_id,status,last_message_at,whatsapp_messages!fk_whatsapp_messages_packet_id!inner()")
    .in("contact_id", [...byId.keys()])
    .order("last_message_at", { ascending: false })
    .limit(MAX_MATCHES);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const contact = byId.get(row.contact_id);
    return {
      id: row.id,
      customer: contact?.customer_name ?? "Unknown customer",
      phone: contact?.phone_number ?? "",
      lastMessageAt: row.last_message_at,
      status: row.status,
    };
  }).filter((m) => UUID.test(m.id));
}

export function OperatorInboxSourceHandoff() {
  const [kind, setKind] = useState<"provider" | "phone">("provider");
  const [source, setSource] = useState("");
  const [results, setResults] = useState<PacketMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sequence = ++request.current;
    setBusy(true);
    setError(null);
    setResults([]);
    setSearched(false);
    try {
      const matches = await findOperatorInboxSourcePackets(kind, source);
      if (request.current === sequence) {
        setResults(matches);
        setSearched(true);
      }
    } catch (caught: unknown) {
      if (request.current === sequence) {
        setError(caught instanceof Error ? caught.message : "Could not retrieve governed packets.");
      }
    } finally {
      if (request.current === sequence) setBusy(false);
    }
  };

  return (
    <details className="shrink-0 border-b border-gray-200 bg-white px-4 py-2" data-operator-packet-handoff>
      <summary className="cursor-pointer text-sm font-semibold text-gray-900">
        Find a conversation without a department task
      </summary>
      <div className="mt-2 max-w-3xl space-y-2">
        <p className="text-xs text-gray-600">
          Look up an exact provider message ID or a sender number. Choose the matching verified
          conversation before reviewing customer details or drafting an order. No message or order is created here.
        </p>
        <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Source type
            <select
              aria-label="Source type"
              className="h-9 rounded border border-gray-300 bg-white px-2 text-sm"
              value={kind}
              onChange={(event) => {
                request.current++;
                setKind(event.target.value as "provider" | "phone");
                setSource("");
                setResults([]);
                setError(null);
                setSearched(false);
                setBusy(false);
              }}
            >
              <option value="provider">Provider message ID</option>
              <option value="phone">Sender phone</option>
            </select>
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-gray-700">
            {kind === "provider" ? "Exact provider message ID" : "Full sender phone number"}
            <input
              aria-label={kind === "provider" ? "Exact provider message ID" : "Full sender phone number"}
              type="text"
              maxLength={160}
              required
              value={source}
              onChange={(event) => { setSource(event.target.value); }}
              className="h-9 rounded border border-gray-300 bg-white px-2 text-sm"
              placeholder={kind === "provider" ? "wamid…" : "+91…"}
            />
          </label>
          <button type="submit" disabled={busy || !source.trim()}
            className="h-9 rounded bg-green-700 px-3 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Finding…" : "Find packets"}
          </button>
        </form>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {searched && results.length === 0 && (
          <p role="status" className="text-sm text-gray-700">
            No governed packet was found. A debug-only record must not be used to create a draft.
          </p>
        )}
        {results.length > 0 && (
          <ul className="max-h-48 space-y-1 overflow-y-auto" aria-label="Matched governed packets">
            {results.map((packet) => (
              <li key={packet.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-2 text-sm">
                <span className="text-gray-800">
                  {packet.customer} · {packet.phone || "No sender number"} · {packet.status}
                  {packet.lastMessageAt ? ` · ${new Date(packet.lastMessageAt).toLocaleString()}` : ""}
                </span>
                <Link
                  to={`/admin/operator-inbox?packet=${encodeURIComponent(packet.id)}`}
                  className="font-semibold text-green-700 underline underline-offset-2"
                >
                  Review this packet
                </Link>
              </li>
            ))}
          </ul>
        )}
        {results.length === MAX_MATCHES && (
          <p className="text-xs text-amber-700">
            Results are limited. Use the exact provider message ID if the expected packet is not listed.
          </p>
        )}
      </div>
    </details>
  );
}
