import { useState, useCallback, useEffect } from "react";

type Lang = "en" | "hi";

const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Dashboard
  "Governance Command Center": { en: "Governance Command Center", hi: "गवर्नेंस कमांड सेंटर" },
  "Operational Command": { en: "Operational Command", hi: "ऑपरेशनल कमांड" },
  "Governance": { en: "Governance", hi: "गवर्नेंस" },
  "Rules & Controls": { en: "Rules & Controls", hi: "नियम और नियंत्रण" },
  "Oversight": { en: "Oversight", hi: "निगरानी" },
  "Order Pipeline": { en: "Order Pipeline", hi: "ऑर्डर पाइपलाइन" },
  "Production & Assembly": { en: "Production & Assembly", hi: "उत्पादन और असेंबली" },
  "Packing & Dispatch": { en: "Packing & Dispatch", hi: "पैकिंग और डिस्पैच" },
  "Accounts & Release": { en: "Accounts & Release", hi: "खाता और रिलीज़" },
  "Exception Center": { en: "Exception Center", hi: "अपवाद केंद्र" },
  "Client Governance": { en: "Client Governance", hi: "ग्राहक गवर्नेंस" },
  "Product Catalog": { en: "Product Catalog", hi: "उत्पाद कैटलॉग" },
  "Pricing Matrix": { en: "Pricing Matrix", hi: "मूल्य मैट्रिक्स" },
  "Financial Control": { en: "Financial Control", hi: "वित्तीय नियंत्रण" },
  "User & Role Control": { en: "User & Role Control", hi: "उपयोगकर्ता और भूमिका" },
  "MOQ Rule Control": { en: "MOQ Rule Control", hi: "MOQ नियम" },
  "Currency & Exchange Rate": { en: "Currency & Exchange Rate", hi: "मुद्रा और विनिमय दर" },
  "Language & Localization": { en: "Language & Localization", hi: "भाषा और स्थानीयकरण" },
  "System Settings": { en: "System Settings", hi: "सिस्टम सेटिंग्स" },
  "Audit Trail": { en: "Audit Trail", hi: "ऑडिट ट्रेल" },
  "Recent Critical Actions": { en: "Recent Critical Actions", hi: "हालिया महत्वपूर्ण कार्य" },
  "Sign Out": { en: "Sign Out", hi: "लॉग आउट" },
  // Pipeline stages
  "Draft": { en: "Draft", hi: "ड्राफ्ट" },
  "Submitted": { en: "Submitted", hi: "जमा किया" },
  "Under Review": { en: "Under Review", hi: "समीक्षा में" },
  "Awaiting Advance": { en: "Awaiting Advance", hi: "अग्रिम प्रतीक्षा" },
  "Approved": { en: "Approved", hi: "स्वीकृत" },
  "In Production": { en: "In Production", hi: "उत्पादन में" },
  "Assembly": { en: "Assembly", hi: "असेंबली" },
  "Packing": { en: "Packing", hi: "पैकिंग" },
  "Dispatch Ready": { en: "Dispatch Ready", hi: "डिस्पैच तैयार" },
  "Dispatched": { en: "Dispatched", hi: "डिस्पैच हुआ" },
  "In Transit": { en: "In Transit", hi: "रास्ते में" },
  "Delivered": { en: "Delivered", hi: "डिलीवर हुआ" },
  "Complaint Window": { en: "Complaint Window", hi: "शिकायत अवधि" },
  "Closed": { en: "Closed", hi: "बंद" },
  "Cancelled": { en: "Cancelled", hi: "रद्द" },
  // Finance
  "Advance Required": { en: "Advance Required", hi: "अग्रिम आवश्यक" },
  "Advance Paid": { en: "Advance Paid", hi: "अग्रिम भुगतान" },
  "Balance Due": { en: "Balance Due", hi: "शेष बकाया" },
  "Payment Status": { en: "Payment Status", hi: "भुगतान स्थिति" },
  "Sales Order Value": { en: "Sales Order Value", hi: "बिक्री मूल्य" },
  // Support
  "Support Tickets": { en: "Support Tickets", hi: "सहायता टिकट" },
  "Open": { en: "Open", hi: "खुला" },
  "Resolved": { en: "Resolved", hi: "हल किया" },
  // Buttons
  "Approve": { en: "Approve", hi: "स्वीकृत करें" },
  "Reject": { en: "Reject", hi: "अस्वीकार करें" },
  "Save": { en: "Save", hi: "सहेजें" },
  "Submit": { en: "Submit", hi: "जमा करें" },
  "Cancel": { en: "Cancel", hi: "रद्द करें" },
  "Actions": { en: "Actions", hi: "कार्रवाई" },
  "Create Dispatch": { en: "Create Dispatch", hi: "डिस्पैच बनाएं" },
  "Mark Resolved": { en: "Mark Resolved", hi: "हल किया चिन्हित करें" },
  // Dispatch
  "Transporter Name": { en: "Transporter Name", hi: "ट्रांसपोर्टर नाम" },
  "Driver Name": { en: "Driver Name", hi: "ड्राइवर नाम" },
  "Driver Phone": { en: "Driver Phone", hi: "ड्राइवर फ़ोन" },
  "Partial Dispatch": { en: "Partial Dispatch", hi: "आंशिक डिस्पैच" },
  // General
  "Loading": { en: "Loading", hi: "लोड हो रहा है" },
  "No data": { en: "No data", hi: "कोई डेटा नहीं" },
  "Company": { en: "Company", hi: "कंपनी" },
  "Order ID": { en: "Order ID", hi: "ऑर्डर आईडी" },
  "Status": { en: "Status", hi: "स्थिति" },
  "Value": { en: "Value", hi: "मूल्य" },
};

const LANG_KEY = "app_language";

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(LANG_KEY) as Lang) || "en";
    }
    return "en";
  });

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback((key: string): string => {
    return TRANSLATIONS[key]?.[lang] ?? key;
  }, [lang]);

  return { lang, setLang, t };
}
