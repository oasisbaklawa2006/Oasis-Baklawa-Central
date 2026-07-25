import { describe, expect, it } from "vitest";
import {
  scanForbiddenPostgrestWrites,
  scanOrderTableMutations,
  scanProtectedWhatsappCommercialMutations,
} from "@/lib/wa-governance/stage1PostgrestWriteScan";

describe("stage1PostgrestWriteScan", () => {
  it("detects forbidden PostgREST writes from AST call expressions", () => {
    const source = `
      await supabase.from("whatsapp_messages").select("*");
      await supabase.from("whatsapp_messages").insert({ id: "1" });
      await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", "1");
      await supabase.rpc("enqueue_packet");
    `;

    expect(scanForbiddenPostgrestWrites(source, "fixture.ts").map((hit) => hit.method)).toEqual([
      "insert",
      "update",
      "rpc",
    ]);
  });

  it("ignores forbidden method names inside comments and string literals", () => {
    const source = `
      // client.from("x").insert({})
      const help = ".insert( is documented in a string";
      await supabase.from("packets").select("id");
    `;

    expect(scanForbiddenPostgrestWrites(source, "fixture.ts")).toEqual([]);
  });

  it("detects orders table mutation chains", () => {
    const source = `
      await supabase.from("orders").insert({ id: "o1" });
      await supabase.from("companies").update({ name: "Acme" }).eq("id", "c1");
    `;

    expect(scanOrderTableMutations(source, "fixture.ts")).toEqual([
      expect.objectContaining({ table: "orders", method: "insert" }),
    ]);
  });

  it("does not treat select-only chains as mutations", () => {
    const source = `
      await supabase.from("orders").select("id").eq("id", "o1");
    `;

    expect(scanForbiddenPostgrestWrites(source, "fixture.ts")).toEqual([]);
    expect(scanOrderTableMutations(source, "fixture.ts")).toEqual([]);
  });

  it("detects all protected WhatsApp commercial table mutations", () => {
    const source = `
      await supabase.from("orders").insert({ id: "o1" });
      await supabase.from("order_items").upsert({ id: "i1" });
      await supabase.from("companies").update({ name: "Acme" });
      await supabase.from("customers").delete().eq("id", "c1");
      await supabase.from("whatsapp_messages").insert({ id: "m1" });
    `;

    expect(
      scanProtectedWhatsappCommercialMutations(source, "fixture.ts").map(
        ({ table, method }) => `${table}:${method}`,
      ),
    ).toEqual([
      "orders:insert",
      "order_items:upsert",
      "companies:update",
      "customers:delete",
    ]);
  });
});
