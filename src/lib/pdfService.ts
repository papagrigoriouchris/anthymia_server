import puppeteer from "puppeteer";
import QRCode from "qrcode";

export interface InvoicePDFData {
    orderId:         string;
    orderDate:       Date;
    invoiceNumber:   number;
    mark:            string;
    uid:             string;
    customerName:    string;
    customerEmail:   string;
    customerAddress: string;
    customerCity:    string;
    customerPhone:   string;
    paymentMethod:   string;
    items: Array<{
        name:      string;
        quantity:  number;
        unitPrice: number; // gross (ΦΠΑ συμπεριλαμβάνεται)
    }>;
    total:       number;
    companyName: string;
    companyVat:  string;
    qrUrl?:      string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
    const html = await buildInvoiceHTML(data);
    const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });
        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}

async function buildInvoiceHTML(data: InvoicePDFData): Promise<string> {
    const qrDataUrl = data.qrUrl
        ? await QRCode.toDataURL(data.qrUrl, { margin: 1, width: 100 })
        : null;

    const issueDate = new Date(data.orderDate).toLocaleDateString("el-GR", {
        day: "2-digit", month: "2-digit", year: "numeric",
    });
    const shortId = data.orderId.slice(-8).toUpperCase();
    const invoiceNum = `Α-${String(data.invoiceNumber).padStart(6, "0")}`;
    const paymentLabel = data.paymentMethod === "IRIS" ? "IRIS Instant Payment" : "Τραπεζική Κατάθεση";

    // VAT breakdown
    let totalNet = 0;
    let totalVat = 0;
    const itemRows = data.items.map((item, i) => {
        const gross = r2(item.unitPrice * item.quantity);
        const net   = r2(gross / 1.24);
        const vat   = r2(gross - net);
        totalNet   += net;
        totalVat   += vat;
        return `
        <tr style="${i % 2 === 1 ? "background:#fffbeb;" : ""}">
            <td style="padding:9px 12px;border-bottom:1px solid #fde68a;font-size:12px;">${item.name}</td>
            <td align="center" style="padding:9px 12px;border-bottom:1px solid #fde68a;font-size:12px;">${item.quantity}</td>
            <td align="right"  style="padding:9px 12px;border-bottom:1px solid #fde68a;font-size:12px;">€${item.unitPrice.toFixed(2)}</td>
            <td align="right"  style="padding:9px 12px;border-bottom:1px solid #fde68a;font-size:12px;font-weight:bold;">€${gross.toFixed(2)}</td>
        </tr>`;
    }).join("");
    totalNet = r2(totalNet);
    totalVat = r2(totalVat);

    return `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: white; }
</style>
</head>
<body>

<!-- ─── HEADER ─────────────────────────────────────── -->
<div style="background:linear-gradient(135deg,#7c3800 0%,#b45309 100%);color:white;padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start;">
  <div>
    <div style="font-size:28px;margin-bottom:6px;">🍯</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:0.02em;">${data.companyName}</div>
    <div style="font-size:10px;opacity:0.8;margin-top:4px;">Α.Φ.Μ.: ${data.companyVat} &nbsp;·&nbsp; Ελληνικό Φυσικό Μέλι</div>
  </div>
  <div style="text-align:right;">
    <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:14px 22px;">
      <div style="font-size:9px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Απόδειξη Λιανικής Πώλησης</div>
      <div style="font-size:22px;font-weight:bold;font-family:'Courier New',monospace;">${invoiceNum}</div>
      <div style="font-size:11px;margin-top:4px;opacity:0.9;">${issueDate}</div>
    </div>
  </div>
</div>

<!-- ─── CUSTOMER + ORDER INFO ─────────────────────── -->
<div style="display:flex;border-bottom:1px solid #fde68a;">
  <div style="flex:1;padding:18px 36px;background:#fffbeb;border-right:1px solid #fde68a;">
    <div style="font-size:9px;color:#92400e;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Στοιχεία Αγοραστή</div>
    <div style="font-size:14px;font-weight:bold;margin-bottom:5px;">${data.customerName}</div>
    <div style="font-size:11px;color:#57534e;line-height:1.8;">
      ${data.customerAddress}<br/>
      ${data.customerCity}<br/>
      Τηλ: ${data.customerPhone}<br/>
      ${data.customerEmail}
    </div>
  </div>
  <div style="flex:1;padding:18px 36px;background:#fffbeb;">
    <div style="font-size:9px;color:#92400e;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Στοιχεία Παραστατικού</div>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="font-size:10px;color:#a16207;font-weight:bold;padding:3px 12px 3px 0;white-space:nowrap;">Αρ. Παραγγελίας</td><td style="font-size:11px;font-family:monospace;">#${shortId}</td></tr>
      <tr><td style="font-size:10px;color:#a16207;font-weight:bold;padding:3px 12px 3px 0;">Αρ. Απόδειξης</td><td style="font-size:11px;font-family:monospace;font-weight:bold;">${invoiceNum}</td></tr>
      <tr><td style="font-size:10px;color:#a16207;font-weight:bold;padding:3px 12px 3px 0;">Ημ/νία Έκδοσης</td><td style="font-size:11px;">${issueDate}</td></tr>
      <tr><td style="font-size:10px;color:#a16207;font-weight:bold;padding:3px 12px 3px 0;">Τρόπος Πληρωμής</td><td style="font-size:11px;">${paymentLabel}</td></tr>
    </table>
  </div>
</div>

<!-- ─── ITEMS TABLE ────────────────────────────────── -->
<div style="padding:20px 36px 0;">
  <div style="font-size:9px;color:#92400e;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Αναλυτική Κατάσταση</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <thead>
      <tr style="background:#92400e;">
        <th align="left"   style="padding:9px 12px;color:white;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;">Περιγραφή</th>
        <th align="center" style="padding:9px 12px;color:white;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;">Ποσ.</th>
        <th align="right"  style="padding:9px 12px;color:white;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;">Τιμή/Τμχ (μκ ΦΠΑ)</th>
        <th align="right"  style="padding:9px 12px;color:white;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.06em;">Αξία</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- ─── TOTALS ──────────────────────────────────────── -->
<div style="padding:12px 36px 24px;display:flex;justify-content:flex-end;">
  <table cellpadding="0" cellspacing="0" style="min-width:260px;">
    <tr>
      <td style="padding:5px 0;font-size:11px;color:#78350f;">Καθαρή Αξία</td>
      <td align="right" style="padding:5px 0 5px 40px;font-size:11px;">€${totalNet.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="padding:5px 0;font-size:11px;color:#78350f;">Φ.Π.Α. 24%</td>
      <td align="right" style="padding:5px 0 5px 40px;font-size:11px;">€${totalVat.toFixed(2)}</td>
    </tr>
    <tr><td colspan="2"><div style="border-top:2px solid #92400e;margin:6px 0;"></div></td></tr>
    <tr>
      <td style="padding:6px 0;font-size:16px;font-weight:bold;color:#92400e;">Σύνολο Πληρωτέο</td>
      <td align="right" style="padding:6px 0 6px 40px;font-size:18px;font-weight:bold;color:#92400e;">€${data.total.toFixed(2)}</td>
    </tr>
  </table>
</div>

<!-- ─── myDATA SECTION ─────────────────────────────── -->
<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:8px;margin:0 36px 24px;padding:18px 22px;display:flex;align-items:flex-start;gap:18px;">
  <div style="flex:1;">
    <div style="font-size:13px;font-weight:bold;color:#15803d;margin-bottom:14px;">✓ &nbsp;Ηλεκτρονική Σήμανση myDATA — Α.Α.Δ.Ε.</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="padding:4px 0;font-size:10px;color:#16a34a;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;width:60px;">ΜΑΡΚ</td>
        <td style="padding:4px 0;font-size:14px;font-family:'Courier New',monospace;font-weight:bold;color:#1a1a1a;">${data.mark}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:10px;color:#16a34a;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;">UID</td>
        <td style="padding:4px 0;font-size:10px;font-family:'Courier New',monospace;color:#374151;word-break:break-all;">${data.uid}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:10px;color:#16a34a;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;">Τύπος</td>
        <td style="padding:4px 0;font-size:11px;color:#374151;">11.1 — Απόδειξη Λιανικής Πώλησης (ΑΛΠ)</td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #bbf7d0;font-size:9px;color:#16a34a;line-height:1.5;">
      Η απόδειξη αυτή έχει υποβληθεί ηλεκτρονικά στην Α.Α.Δ.Ε. μέσω του συστήματος myDATA και φέρει μοναδικό αριθμό καταχώρησης (ΜΑΡΚ).
    </div>
  </div>
  ${qrDataUrl ? `<div style="flex-shrink:0;text-align:center;">
    <img src="${qrDataUrl}" width="100" height="100" style="display:block;border-radius:4px;" />
    <div style="font-size:8px;color:#16a34a;margin-top:4px;font-weight:bold;">Σάρωση myDATA</div>
  </div>` : ""}
</div>

<!-- ─── FOOTER ─────────────────────────────────────── -->
<div style="background:#1c0a00;color:#a16207;padding:18px 36px;text-align:center;">
  <div style="color:#fde68a;font-size:13px;font-weight:bold;margin-bottom:5px;">🍯 Anthymia Μελισσοκομία</div>
  <div style="font-size:10px;line-height:1.65;">
    Premium Ελληνικό Φυσικό Μέλι<br/>
    Το παρόν αποτελεί νόμιμο φορολογικό παραστατικό εκδοθέν μέσω myDATA (Α.Α.Δ.Ε.)
  </div>
</div>

</body>
</html>`;
}
