import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Currency = "INR" | "USD";
const CURRENCY_KEY = "app_currency";

export function useCurrency() {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(CURRENCY_KEY) as Currency) || "INR";
    }
    return "INR";
  });
  const [rate, setRate] = useState<number>(1);
  const [rateLoading, setRateLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem(CURRENCY_KEY, currency);
  }, [currency]);

  useEffect(() => {
    const fetchRate = async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("exchange_rate")
        .eq("base_currency", "INR")
        .eq("target_currency", "USD")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setRate(Number(data.exchange_rate));
      setRateLoading(false);
    };
    fetchRate();
  }, []);

  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), []);

  const convert = useCallback((amountINR: number): number => {
    if (currency === "INR") return amountINR;
    return Math.round(amountINR * rate * 100) / 100;
  }, [currency, rate]);

  const format = useCallback((amountINR: number): string => {
    if (currency === "INR") {
      return `₹${amountINR.toLocaleString("en-IN")}`;
    }
    const usd = Math.round(amountINR * rate * 100) / 100;
    return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }, [currency, rate]);

  const symbol = currency === "INR" ? "₹" : "$";

  return { currency, setCurrency, convert, format, symbol, rate, rateLoading };
}
