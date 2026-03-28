import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calculatePackPrice,
  calculateLineTotal,
  calculateLineTax,
  getGstRate,
  getHsnCode,
  getProductCategory,
  getDisplayPrice,
  getPrimaryPackWeightKg,
} from "@/utils/pricing";

interface CartItem {
  id: string;
  quantity: number;
  product?: any;
}

interface PackedItem {
  product_id: string;
  packed_quantity: number;
}

interface CompanyDetails {
  business_name: string;
  gst_number?: string | null;
  address?: string;
}

interface SelectedAddress {
  label: string;
  street_address: string;
  city: string;
  state: string;
  pincode: string;
}

export function generateProFormaInvoice(
  cartItems: CartItem[],
  companyDetails: CompanyDetails | null,
  selectedAddress: SelectedAddress | null,
  packedItems?: PackedItem[]
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Colours ──
  const teal = [0, 95, 95] as const;
  const gold = [197, 160, 89] as const;
  const darkText = [30, 30, 30] as const;
  const mutedText = [100, 100, 100] as const;

  // ── Helper ──
  const drawLine = (yPos: number) => {
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.4);
    doc.line(margin, yPos, pageW - margin, yPos);
  };

  // ══════════════════════════════════════════════════════════════
  //  HEADER
  // ══════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...teal);
  doc.text("OASIS BAKLAWA", margin, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text("TCF Chocolates & Gifts Private Limited", margin, y + 12);
  doc.text("Survey No. 123, Industrial Area, Hyderabad – 500032, Telangana", margin, y + 16);
  doc.text("GSTIN: 36AABCT1234F1Z5  |  PAN: AABCT1234F", margin, y + 20);

  // Right side – document title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...teal);
  doc.text("PROFORMA INVOICE", pageW - margin, y + 6, { align: "right" });

  const today = new Date();
  const docDate = today.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const docNo = `PI-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text(`Date: ${docDate}`, pageW - margin, y + 12, { align: "right" });
  doc.text(`Ref: ${docNo}`, pageW - margin, y + 16, { align: "right" });

  y += 26;
  drawLine(y);
  y += 6;

  // ══════════════════════════════════════════════════════════════
  //  BILLED TO
  // ══════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...teal);
  doc.text("BILLED TO:", margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...darkText);
  doc.text(companyDetails?.business_name || "—", margin, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  if (selectedAddress) {
    doc.text(
      `${selectedAddress.street_address}, ${selectedAddress.city}, ${selectedAddress.state} – ${selectedAddress.pincode}`,
      margin,
      y + 10
    );
  }
  if (companyDetails?.gst_number) {
    doc.text(`GSTIN: ${companyDetails.gst_number}`, margin, y + 14);
  }

  y += 20;

  // ══════════════════════════════════════════════════════════════
  //  TABLE
  // ══════════════════════════════════════════════════════════════
  const tableRows: (string | number)[][] = [];
  let runningSubtotal = 0;
  let runningTax = 0;

  cartItems.forEach((item, idx) => {
    const p = item.product;
    if (!p) return;
    const cat = getProductCategory(p);
    // Use packed quantity if available (partial dispatch), else original order qty
    const packedMatch = packedItems?.find(pi => pi.product_id === item.id || pi.product_id === p.id);
    const qty = packedMatch ? packedMatch.packed_quantity : item.quantity;
    const uom = cat === "bulk_kg" ? "Box" : "Pc";
    const packPrice = calculatePackPrice(p);
    const lineTotal = calculateLineTotal(p, qty);
    const gstRate = getGstRate(p);
    const lineTax = calculateLineTax(p, qty);
    const hsn = getHsnCode(p);

    runningSubtotal += lineTotal;
    runningTax += lineTax;

    let desc = p.name || "—";
    const netWt = p.net_weight_grams ? `${p.net_weight_grams}g` : (p.primary_pack_weight_kg ? `${p.primary_pack_weight_kg}kg` : "");
    if (cat === "bulk_kg") {
      const wt = getPrimaryPackWeightKg(p);
      if (wt > 0) desc += ` (${wt}kg/box)`;
    }
    if (netWt) desc += ` | Net Wt: ${netWt}`;

    tableRows.push([
      idx + 1,
      desc,
      hsn || "—",
      qty,
      uom,
      formatINR(packPrice),
      formatINR(lineTotal),
      `${gstRate}%`,
      formatINR(lineTax),
      formatINR(lineTotal + lineTax),
    ]);
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Description", "HSN", "Qty", "UOM", "Rate/Unit", "Taxable", "GST %", "GST Amt", "Total"]],
    body: tableRows,
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      textColor: [30, 30, 30] as [number, number, number],
      lineColor: [220, 220, 220] as [number, number, number],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [0, 95, 95] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 10, halign: "center" },
      4: { cellWidth: 10, halign: "center" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { cellWidth: 12, halign: "center" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    didDrawPage: () => {
      // Footer on each page
      doc.setFontSize(6.5);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "This is a computer-generated Proforma Invoice and does not require a physical signature.",
        pageW / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    },
  });

  // @ts-ignore – autotable sets this
  y = (doc as any).lastAutoTable.finalY + 8;

  // ══════════════════════════════════════════════════════════════
  //  TOTALS (Right)
  // ══════════════════════════════════════════════════════════════
  const totalsX = pageW - margin - 70;
  const valX = pageW - margin;

  const drawTotalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.setTextColor(bold ? teal[0] : darkText[0], bold ? teal[1] : darkText[1], bold ? teal[2] : darkText[2]);
    doc.text(label, totalsX, y);
    doc.text(value, valX, y, { align: "right" });
    y += 5;
  };

  drawTotalRow("Sub Total (Before Tax)", formatINR(runningSubtotal));
  drawTotalRow("Total GST", formatINR(runningTax));
  drawLine(y - 1);
  y += 3;
  drawTotalRow("GRAND TOTAL", formatINR(Math.round(runningSubtotal + runningTax)), true);

  // ══════════════════════════════════════════════════════════════
  //  BANK DETAILS (Left)
  // ══════════════════════════════════════════════════════════════
  const bankY = y - 13; // align roughly with totals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...teal);
  doc.text("BANK DETAILS FOR ADVANCE PAYMENT", margin, bankY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...mutedText);
  const bankLines = [
    "Account Name: TCF Chocolates & Gifts Pvt Ltd",
    "A/C No: 50200012345678",
    "Bank: HDFC Bank, Jubilee Hills Branch",
    "IFSC: HDFC0001234",
    "UPI: oasis@hdfcbank",
  ];
  bankLines.forEach((line, i) => {
    doc.text(line, margin, bankY + 5 + i * 4);
  });

  // ══════════════════════════════════════════════════════════════
  //  TERMS
  // ══════════════════════════════════════════════════════════════
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...teal);
  doc.text("TERMS & CONDITIONS", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedText);
  const terms = [
    "1. This is a Proforma Invoice for reference only. Final invoice will be issued upon dispatch.",
    "2. 50% advance payment is required to confirm the order and initiate production.",
    "3. Prices are ex-factory. Freight and insurance charges are additional.",
    "4. Goods once sold will not be taken back. Claims within 48 hours of delivery only.",
  ];
  terms.forEach((t, i) => {
    doc.text(t, margin, y + 4 + i * 3.5, { maxWidth: contentW });
  });

  // ══════════════════════════════════════════════════════════════
  //  FSSAI & W&M COMPLIANCE
  // ══════════════════════════════════════════════════════════════
  y += 4 + terms.length * 3.5 + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...teal);
  doc.text("FSSAI & LEGAL METROLOGY COMPLIANCE", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  const fssaiLines = [
    `FSSAI Lic. No: 10721042000284 | Packed Date: ${docDate}`,
    "Mfg. by: TCF Chocolates & Gifts Pvt Ltd, Hyderabad, Telangana",
    "Net weight, Unit Sale Price, and MRP as printed on individual packs. Best before: See pack label.",
  ];
  fssaiLines.forEach((line, i) => {
    doc.text(line, margin, y + 4 + i * 3, { maxWidth: contentW });
  });

  // ── Save ──
  doc.save(`ProForma_${docNo}.pdf`);
}

function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
