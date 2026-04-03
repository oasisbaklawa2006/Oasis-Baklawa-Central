import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calculatePackPrice,
  calculateLineTotal,
  calculateLineTax,
  getGstRate,
  getHsnCode,
  getProductCategory,
  getPrimaryPackWeightKg,
  getMinOrderQty,
  getPacksPerCarton,
} from "@/utils/pricing";

const formatINR = (n: number): string =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function generateSOPdf(order: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const teal = [0, 95, 95] as const;
  const gold = [197, 160, 89] as const;
  const darkText = [30, 30, 30] as const;
  const mutedText = [100, 100, 100] as const;

  const drawLine = (yPos: number) => {
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.4);
    doc.line(margin, yPos, pageW - margin, yPos);
  };

  // ── HEADER ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...teal);
  doc.text("OASIS BAKLAWA", margin, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text("TCF Chocolates & Gifts Private Limited", margin, y + 12);
  doc.text("GSTIN: 29AADCT1234F1Z5", margin, y + 16); // Company GSTIN

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...teal);
  doc.text("SALES ORDER", pageW - margin, y + 6, { align: "right" });

  const docDate = new Date(order.created_at).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text(`Date: ${docDate}`, pageW - margin, y + 12, { align: "right" });
  doc.text(`SO #: ${order.id.split("-")[0].toUpperCase()}`, pageW - margin, y + 16, { align: "right" });

  // Customer GSTIN if available
  const customerGst = order.company?.gst_number;
  if (customerGst) {
    doc.text(`Customer GSTIN: ${customerGst}`, pageW - margin, y + 20, { align: "right" });
  }

  y += 26;
  drawLine(y);
  y += 4;

  // ── BUYER INFO ──
  const companyName = order.company?.business_name;
  if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...darkText);
    doc.text("Bill To:", margin, y + 4);
    doc.setFont("helvetica", "normal");
    doc.text(companyName, margin + 18, y + 4);
    y += 8;
  }

  y += 2;

  // ── TABLE ──
  const items = order.order_items || [];
  const tableRows: (string | number)[][] = [];
  let subtotal = 0;
  let totalTax = 0;
  const moqWarnings: string[] = [];

  items.forEach((item: any, idx: number) => {
    const p = item.product;
    if (!p) return;
    const qty = item.quantity;
    const cat = getProductCategory(p);
    const packPrice = calculatePackPrice(p);
    const lineTotal = calculateLineTotal(p, qty);
    const gstRate = getGstRate(p);
    const lineTax = calculateLineTax(p, qty);
    const hsn = getHsnCode(p);
    const moq = getMinOrderQty(p);

    // MOQ enforcement: flag if quantity < MOQ
    if (qty < moq) {
      moqWarnings.push(`${p.name || "Item"}: Qty ${qty} below MOQ ${moq}`);
    }

    subtotal += lineTotal;
    totalTax += lineTax;

    let desc = p.name || "—";
    if (cat === "bulk_kg") {
      const wt = getPrimaryPackWeightKg(p);
      if (wt > 0) desc += ` (${wt}kg/box)`;
    } else {
      const perCarton = getPacksPerCarton(p);
      if (perCarton > 1) desc += ` (${perCarton}pc/ctn)`;
    }

    tableRows.push([
      idx + 1,
      desc,
      hsn || "—",
      qty,
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
    head: [["#", "Description", "HSN", "Qty", "Rate/Unit", "Taxable", "GST%", "GST", "Total"]],
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
  });

  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── MOQ WARNINGS ──
  if (moqWarnings.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(200, 80, 30);
    moqWarnings.forEach((w) => {
      doc.text(`⚠ ${w}`, margin, y);
      y += 4;
    });
    y += 2;
  }

  // ── TOTALS ──
  const valX = pageW - margin;
  const labX = pageW - margin - 60;

  const drawRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.setTextColor(bold ? teal[0] : darkText[0], bold ? teal[1] : darkText[1], bold ? teal[2] : darkText[2]);
    doc.text(label, labX, y);
    doc.text(value, valX, y, { align: "right" });
    y += 5;
  };

  drawRow("Sub Total", formatINR(subtotal));
  drawRow("GST", formatINR(totalTax));
  drawLine(y - 1);
  y += 3;
  drawRow("GRAND TOTAL", formatINR(Math.round(subtotal + totalTax)), true);

  // ── FOOTER ──
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This is a system-generated Sales Order confirmation.",
    pageW / 2,
    pageH - 8,
    { align: "center" },
  );

  // ── MOBILE-SAFE DOWNLOAD ──
  const fileName = `SalesOrder_${order.id.split("-")[0].toUpperCase()}.pdf`;
  
  try {
    // Use blob + object URL for cross-browser/mobile compatibility
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after a delay to ensure download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 1000);
  } catch {
    // Fallback: open in new tab (works on most mobile browsers)
    const dataUri = doc.output("datauristring");
    window.open(dataUri, "_blank");
  }
}
