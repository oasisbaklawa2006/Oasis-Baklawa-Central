import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldAlert, ScanLine, Box, Clock, Shield } from "lucide-react";

interface ScannedCarton {
  id: string;
  barcode: string;
  company_name: string;
  scanned_at: Date;
  status: "success" | "error" | "duplicate";
  message: string;
}

const AdminSecurityGate = () => {
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [screenState, setScreenState] = useState<"idle" | "success" | "error" | "duplicate">("idle");
  const [lastMessage, setLastMessage] = useState("Ready to scan barcodes.");
  const [scanHistory, setScanHistory] = useState<ScannedCarton[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the hidden input focused at all times so the USB scanner always works
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, []);

  const resetScreen = () => {
    setTimeout(() => {
      setScreenState("idle");
      setLastMessage("Ready to scan next carton.");
    }, 4000); // Return to idle after 4 seconds
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = inputValue.trim();
    if (!barcode || isProcessing) return;

    setInputValue(""); // Clear input immediately for the next scan
    setIsProcessing(true);

    try {
      // 1. Look up the carton (Using 'as any' safely since this table is new)
      const { data: carton, error } = await (supabase as any)
        .from("dispatch_cartons")
        .select(
          `
          id, 
          status, 
          box_number, 
          total_boxes,
          orders ( company:companies(business_name) )
        `,
        )
        .eq("barcode_string", barcode)
        .single();

      const companyName = carton?.orders?.company?.business_name || "Unknown Company";

      if (error || !carton) {
        // ERROR: Barcode not found in database
        setScreenState("error");
        setLastMessage(`INVALID BARCODE: ${barcode}`);
        addToHistory(barcode, "Unknown", "error", "Barcode not recognized by the system.");
        playAudio("error");
      } else if (carton.status === "physically_dispatched") {
        // ERROR: Already scanned out
        setScreenState("duplicate");
        setLastMessage(`ALREADY DISPATCHED: Master Carton ${carton.box_number} of ${carton.total_boxes}`);
        addToHistory(barcode, companyName, "duplicate", "This box has already left the building.");
        playAudio("error");
      } else {
        // SUCCESS: Mark as dispatched out the gate
        await (supabase as any)
          .from("dispatch_cartons")
          .update({
            status: "physically_dispatched",
            scanned_out_at: new Date().toISOString(),
          })
          .eq("id", carton.id);

        setScreenState("success");
        setLastMessage(`AUTHORIZED: ${companyName} (Box ${carton.box_number}/${carton.total_boxes})`);
        addToHistory(barcode, companyName, "success", "Authorized and dispatched.");
        playAudio("success");
      }
    } catch (err) {
      setScreenState("error");
      setLastMessage("System Error. Please try again.");
    } finally {
      setIsProcessing(false);
      resetScreen();
    }
  };

  const addToHistory = (barcode: string, company: string, status: "success" | "error" | "duplicate", msg: string) => {
    setScanHistory((prev) =>
      [
        { id: Math.random().toString(), barcode, company_name: company, status, message: msg, scanned_at: new Date() },
        ...prev,
      ].slice(0, 10),
    ); // Keep only the last 10 scans
  };

  // Optional: Add simple web audio beeps for physical feedback
  const playAudio = (type: "success" | "error") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      // Audio context might be blocked by browser policy, silently fail
    }
  };

  // UI Theme based on state
  let bgClass = "bg-slate-900";
  let textClass = "text-slate-400";
  let Icon = ScanLine;

  if (screenState === "success") {
    bgClass = "bg-emerald-500";
    textClass = "text-white";
    Icon = ShieldCheck;
  } else if (screenState === "error" || screenState === "duplicate") {
    bgClass = "bg-red-600";
    textClass = "text-white";
    Icon = ShieldAlert;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* LEFT PANEL - THE SCANNER UI */}
        <div
          className={`flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-500 ${bgClass}`}
        >
          {/* Icon */}
          <div className={`mb-6 transition-all duration-300 ${textClass}`}>
            <Icon size={120} strokeWidth={1.5} />
          </div>

          {/* Status Text */}
          <h1
            className={`text-5xl md:text-7xl font-black tracking-tight mb-4 text-center transition-colors duration-300 ${textClass}`}
          >
            {screenState === "idle" && "SCAN CARTON"}
            {screenState === "success" && "AUTHORIZED"}
            {screenState === "error" && "INVALID CARTON"}
            {screenState === "duplicate" && "STOP! DUPLICATE"}
          </h1>

          {/* Message */}
          <p
            className={`text-lg md:text-2xl font-medium text-center max-w-xl transition-colors duration-300 ${screenState === "idle" ? "text-slate-500" : "text-white/80"}`}
          >
            {lastMessage}
          </p>

          {/* HIDDEN INPUT FOR USB SCANNER (Fixed structure!) */}
          <form onSubmit={handleScan} className="mt-10 w-full max-w-md">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Keyboard/Scanner Input..."
              className="w-full text-center py-4 bg-black/50 text-white border border-white/20 rounded-2xl font-mono text-xl outline-none focus:border-white"
              autoFocus
              autoComplete="off"
            />
          </form>
        </div>

        {/* RIGHT PANEL - SCAN HISTORY */}
        <div className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Shield size={20} className="text-slate-400" /> Gate Activity Log
            </div>
            <p className="text-xs text-slate-500 mt-1">Live exit history</p>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {scanHistory.length === 0 ? (
              <div className="text-center py-16 text-slate-600">
                <Box size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No recent scans</p>
              </div>
            ) : (
              scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className={`p-3 rounded-xl border ${
                    scan.status === "success"
                      ? "bg-emerald-950/50 border-emerald-800"
                      : scan.status === "duplicate"
                        ? "bg-amber-950/50 border-amber-800"
                        : "bg-red-950/50 border-red-800"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold uppercase ${
                        scan.status === "success"
                          ? "text-emerald-400"
                          : scan.status === "duplicate"
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {scan.status}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={10} />
                      {scan.scanned_at.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200">{scan.company_name}</p>
                  <p className="text-xs text-slate-500 font-mono">{scan.barcode}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSecurityGate;
