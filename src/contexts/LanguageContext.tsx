import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

type Lang = "en" | "hi";

const translations: Record<string, Record<Lang, string>> = {
  // Nav
  "nav.dashboard": { en: "Dashboard", hi: "डैशबोर्ड" },
  "nav.orders": { en: "Orders", hi: "ऑर्डर" },
  "nav.catalogue": { en: "Catalogue", hi: "कैटलॉग" },
  "nav.home": { en: "Home", hi: "होम" },
  "nav.cart": { en: "Cart", hi: "कार्ट" },
  "nav.portal": { en: "Portal", hi: "पोर्टल" },
  "nav.myAccount": { en: "My Account", hi: "मेरा खाता" },
  "nav.signOut": { en: "Sign Out", hi: "लॉग आउट" },

  // Home / Index
  "home.hello": { en: "Hello", hi: "नमस्ते" },
  "home.browseCategories": { en: "Browse by Category", hi: "श्रेणी अनुसार ब्राउज़ करें" },
  "home.smartReorder": { en: "Smart Reorder", hi: "स्मार्ट रीऑर्डर" },
  "home.smartReorderSub": { en: "Based on your frequent orders", hi: "आपके बार-बार के ऑर्डर के आधार पर" },
  "home.festiveSpecial": { en: "Festive Special", hi: "त्योहार विशेष" },
  "home.giftingCollection": { en: "Gifting Collection", hi: "उपहार संग्रह" },
  "home.limitedEdition": { en: "Limited Edition", hi: "सीमित संस्करण" },
  "home.exploreCollection": { en: "Explore Collection", hi: "संग्रह देखें" },
  "home.privateLabel": { en: "Private Label & Retail Ready", hi: "प्राइवेट लेबल और रिटेल रेडी" },
  "home.privateLabelSub": { en: "Premium branded products ready for your shelves.", hi: "आपकी अलमारियों के लिए प्रीमियम ब्रांडेड उत्पाद।" },
  "home.recommendedForYou": { en: "Recommended for You", hi: "आपके लिए अनुशंसित" },
  "home.recommendedSub": { en: "Based on your business profile", hi: "आपकी व्यावसायिक प्रोफ़ाइल के आधार पर" },
  "home.packagingSolutions": { en: "Packaging Solutions", hi: "पैकेजिंग समाधान" },
  "home.packagingSub": { en: "Perfect for wrapping your own products. Premium rigid boxes, trays, and jars.", hi: "अपने उत्पादों की पैकिंग के लिए बिल्कुल सही। प्रीमियम रिजिड बॉक्स, ट्रे और जार।" },
  "home.viewAll": { en: "View All", hi: "सभी देखें" },
  "home.quickAdd": { en: "Quick Add", hi: "जल्दी जोड़ें" },

  // Dashboard
  "dash.welcomeBack": { en: "Welcome back,", hi: "वापसी पर स्वागत," },
  "dash.businessOverview": { en: "Here is your business overview.", hi: "यहाँ आपका व्यापार अवलोकन है।" },
  "dash.totalBusiness": { en: "Total Business", hi: "कुल व्यापार" },
  "dash.totalOrders": { en: "Total Orders", hi: "कुल ऑर्डर" },
  "dash.walletBalance": { en: "Wallet Balance", hi: "वॉलेट बैलेंस" },
  "dash.mostOrdered": { en: "Most Ordered", hi: "सबसे ज़्यादा ऑर्डर" },
  "dash.quickOrderAI": { en: "Quick Order via AI", hi: "AI से क्विक ऑर्डर" },
  "dash.quickOrderSub": { en: "Type or paste a Purchase Order. Our engine instantly builds your wholesale cart.", hi: "एक पर्चेज़ ऑर्डर टाइप या पेस्ट करें। हमारा इंजन तुरंत आपका होलसेल कार्ट बनाता है।" },
  "dash.downloadDocs": { en: "Download Docs", hi: "दस्तावेज़ डाउनलोड" },
  "dash.invoicesEway": { en: "Invoices & E-Way Bills", hi: "इनवॉइस और ई-वे बिल" },
  "dash.raiseTicket": { en: "Raise Ticket", hi: "टिकट बनाएं" },
  "dash.supportComplaints": { en: "Support & Complaints", hi: "सहायता और शिकायतें" },
  "dash.liveOrderTracker": { en: "Live Order Tracker", hi: "लाइव ऑर्डर ट्रैकर" },
  "dash.viewAll": { en: "View All", hi: "सभी देखें" },
  "dash.orderLogged": { en: "Order Logged", hi: "ऑर्डर दर्ज" },
  "dash.productionAssembly": { en: "Production & Assembly", hi: "उत्पादन और असेंबली" },
  "dash.finalInvoicing": { en: "Final Invoicing", hi: "अंतिम चालान" },
  "dash.dispatched": { en: "Dispatched", hi: "डिस्पैच हुआ" },
  "dash.actionRequired": { en: "Action Required", hi: "कार्रवाई आवश्यक" },
  "dash.uploadAdvanceReceipt": { en: "Upload Advance Receipt", hi: "अग्रिम रसीद अपलोड करें" },
  "dash.uploadFinalReceipt": { en: "Upload Final Receipt", hi: "अंतिम रसीद अपलोड करें" },
  "dash.uploadReceipt": { en: "Upload Receipt", hi: "रसीद अपलोड करें" },
  "dash.submitVerification": { en: "Submit for Verification", hi: "सत्यापन के लिए भेजें" },
  "dash.noActiveShipments": { en: "No active shipments in transit.", hi: "कोई सक्रिय शिपमेंट नहीं।" },
  "dash.startNewOrder": { en: "Start New Order", hi: "नया ऑर्डर शुरू करें" },
  "dash.productCatalogue": { en: "Product Catalogue", hi: "उत्पाद कैटलॉग" },
  "dash.myOrders": { en: "My Orders", hi: "मेरे ऑर्डर" },
  "dash.buyerPortal": { en: "Buyer Portal", hi: "बायर पोर्टल" },
  "dash.documents": { en: "Documents", hi: "दस्तावेज़" },
  "dash.favorites": { en: "Favorites", hi: "पसंदीदा" },
  "dash.myAccount": { en: "My Account", hi: "मेरा खाता" },
  "dash.placedOn": { en: "Placed On", hi: "आर्डर की तारीख" },
  "dash.batches": { en: "Batches", hi: "बैच" },
  "dash.noPendingRefunds": { en: "No pending refunds", hi: "कोई लंबित रिफ़ंड नहीं" },
  "dash.financialsVerified": { en: "Financials verified. Released to Production.", hi: "वित्तीय सत्यापित। उत्पादन के लिए रिलीज़।" },
  "dash.packagingAssembling": { en: "Packaging division is assembling your master cartons", hi: "पैकेजिंग डिवीज़न आपके मास्टर कार्टन तैयार कर रही है" },
  "dash.finalPaymentRequired": { en: "Final Payment Required", hi: "अंतिम भुगतान आवश्यक" },
  "dash.viewInvoice": { en: "View Invoice", hi: "इनवॉइस देखें" },
  "dash.logisticsSupport": { en: "Logistics Support", hi: "लॉजिस्टिक्स सहायता" },
  "dash.lrCopyWaybill": { en: "LR Copy / WayBill", hi: "एलआर कॉपी / वेबिल" },
  "dash.bankRefNo": { en: "Bank Reference No. / Transaction ID", hi: "बैंक संदर्भ सं. / ट्रांज़ैक्शन ID" },
  "dash.advanceTransferMsg": { en: "Please transfer the 50% advance and upload the payment receipt to release this to Production.", hi: "कृपया 50% अग्रिम भुगतान करें और उत्पादन में रिलीज़ के लिए भुगतान रसीद अपलोड करें।" },
  "dash.finalInvoiceMsg": { en: "Finance has generated the final tax invoice based on actual packed weights. Please clear the balance.", hi: "फाइनेंस ने वास्तविक पैक वज़न के आधार पर अंतिम टैक्स इनवॉइस बनाया है। कृपया बैलेंस क्लियर करें।" },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

const LANG_KEY = "app_language";

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
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

  const t = useCallback(
    (key: string): string => translations[key]?.[lang] ?? key,
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
