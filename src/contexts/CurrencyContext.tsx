import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Currency = "INR" | "USD";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (amountInInr: number) => string;
  rate: number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "INR",
  setCurrency: () => {},
  formatPrice: (n) => "₹" + n.toLocaleString("en-IN"),
  rate: 1,
});

const CURRENCY_KEY = "app_currency";

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(CURRENCY_KEY) as Currency) || "INR";
    }
    return "INR";
  });
  const [rate, setRate] = useState<number>(0.012); // fallback INR→USD

  // Fetch exchange rate from Supabase
  useEffect(() => {
    const fetchRate = async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("exchange_rate")
        .eq("base_currency", "INR")
        .eq("target_currency", "USD")
        .limit(1)
        .maybeSingle();
      if (data?.exchange_rate) {
        setRate(Number(data.exchange_rate));
      }
    };
    fetchRate();
  }, []);

  useEffect(() => {
    localStorage.setItem(CURRENCY_KEY, currency);
  }, [currency]);

  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), []);

  const formatPrice = useCallback(
    (amountInInr: number): string => {
      if (currency === "USD") {
        const usd = amountInInr * rate;
        return "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return "₹" + amountInInr.toLocaleString("en-IN");
    },
    [currency, rate]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, rate }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
