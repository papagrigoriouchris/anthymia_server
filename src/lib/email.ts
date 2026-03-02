import nodemailer from "nodemailer";
import QRCode from "qrcode";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || "ethereal.user@ethereal.email",
        pass: process.env.SMTP_PASS || "ethereal.pass",
    },
});

export interface OrderEmailData {
    id: string;
    total: number;
    name: string;
    address: string;
    city: string;
    phone: string;
    paymentMethod: "BANK_TRANSFER" | "IRIS";
    createdAt: Date;
    user: { email: string; name: string };
    items: Array<{
        quantity: number;
        price: number;
        product: { name: string; weight: string };
    }>;
}

const BANK_HOLDER = process.env.BANK_HOLDER || "Anthymia Μελισσοκομία";
const BANK_IBAN   = process.env.BANK_IBAN   || "GR16 0110 1250 0000 0001 2300 695";
const BANK_NAME   = process.env.BANK_NAME   || "Εθνική Τράπεζα";

// ─── Shared helpers ────────────────────────────────────────────────────────────

const shortId = (id: string) => id.slice(-8).toUpperCase();

const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("el-GR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const itemsTable = (items: OrderEmailData["items"]) => `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;">
  <thead>
    <tr>
      <th align="left"  style="padding:10px 12px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:8px 0 0 0;">Προϊόν</th>
      <th align="center" style="padding:10px 8px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Βάρος</th>
      <th align="center" style="padding:10px 8px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Ποσ.</th>
      <th align="right"  style="padding:10px 12px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:0 8px 0 0;">Τιμή</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#fffbeb"};">
      <td style="padding:12px 12px;color:#1c1917;font-size:14px;font-weight:600;border-bottom:1px solid #fef3c7;">${item.product.name}</td>
      <td align="center" style="padding:12px 8px;color:#78350f;font-size:13px;border-bottom:1px solid #fef3c7;">${item.product.weight}</td>
      <td align="center" style="padding:12px 8px;color:#1c1917;font-size:14px;font-weight:700;border-bottom:1px solid #fef3c7;">${item.quantity}</td>
      <td align="right"  style="padding:12px 12px;color:#92400e;font-size:14px;font-weight:700;border-bottom:1px solid #fef3c7;">€${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`).join("")}
  </tbody>
</table>`;

const totalsBlock = (total: number) => {
    const shipping = total >= 30 ? 0 : 3.5;
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px;">
  <tr>
    <td style="padding:8px 12px;color:#78350f;font-size:13px;">Υποσύνολο</td>
    <td align="right" style="padding:8px 12px;color:#1c1917;font-size:13px;font-weight:600;">€${total.toFixed(2)}</td>
  </tr>
  <tr>
    <td style="padding:8px 12px;color:#78350f;font-size:13px;">Μεταφορικά</td>
    <td align="right" style="padding:8px 12px;color:${shipping === 0 ? "#16a34a" : "#1c1917"};font-size:13px;font-weight:600;">${shipping === 0 ? "Δωρεάν" : `€${shipping.toFixed(2)}`}</td>
  </tr>
  <tr style="background:#fef3c7;border-radius:8px;">
    <td style="padding:14px 12px;color:#92400e;font-size:16px;font-weight:700;border-top:2px solid #fde68a;">Σύνολο</td>
    <td align="right" style="padding:14px 12px;color:#92400e;font-size:20px;font-weight:800;border-top:2px solid #fde68a;">€${(total + shipping).toFixed(2)}</td>
  </tr>
</table>`;
};

const emailWrapper = (body: string) => `
<!DOCTYPE html>
<html lang="el">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(120,53,15,.08);">
        ${body}
        <!-- Footer -->
        <tr><td style="background:#1c0a00;padding:28px 32px;text-align:center;">
          <p style="margin:0 0 6px;color:#fde68a;font-size:16px;font-weight:700;letter-spacing:.04em;">🍯 Anthymia Honey</p>
          <p style="margin:0 0 4px;color:#a16207;font-size:12px;">Premium Ελληνικό Μέλι · orders@anthymia.gr</p>
          <p style="margin:0;color:#57534e;font-size:11px;">© ${new Date().getFullYear()} Anthymia. Όλα τα δικαιώματα κατοχυρωμένα.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Customer: Order Confirmation ──────────────────────────────────────────────

export const sendOrderConfirmation = async (order: OrderEmailData) => {
    const html = emailWrapper(`
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:40px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:32px;">🍯</p>
        <h1 style="margin:0 0 6px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-.01em;">Ευχαριστούμε για την παραγγελία σας!</h1>
        <p style="margin:0;color:#fde68a;font-size:14px;">Η παραγγελία σας παραλήφθηκε και βρίσκεται σε επεξεργασία.</p>
      </td></tr>

      <!-- Order badge -->
      <tr><td style="padding:24px 32px 0;text-align:center;">
        <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;padding:8px 20px;border-radius:999px;letter-spacing:.05em;">
          Παραγγελία #${shortId(order.id)} &nbsp;·&nbsp; ${formatDate(order.createdAt)}
        </span>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:24px 32px 8px;">
        <p style="margin:0;color:#1c1917;font-size:15px;">Γεια σας <strong>${order.name}</strong>,</p>
        <p style="margin:8px 0 0;color:#57534e;font-size:14px;line-height:1.6;">
          Επιβεβαιώνουμε ότι η παραγγελία σας ελήφθη. Θα σας ειδοποιήσουμε μόλις αποσταλεί.
        </p>
      </td></tr>

      <!-- Items -->
      <tr><td style="padding:20px 32px 0;">
        <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Περίληψη Παραγγελίας</p>
        ${itemsTable(order.items)}
        ${totalsBlock(order.total)}
      </td></tr>

      <!-- Shipping -->
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Στοιχεία Αποστολής</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;color:#1c1917;font-size:14px;font-weight:700;">${order.name}</p>
              <p style="margin:0 0 2px;color:#57534e;font-size:13px;">${order.address}</p>
              <p style="margin:0 0 2px;color:#57534e;font-size:13px;">${order.city}</p>
              <p style="margin:0;color:#57534e;font-size:13px;">Τηλ: ${order.phone}</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Payment instructions -->
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Οδηγίες Πληρωμής</p>
        ${order.paymentMethod === "IRIS" ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 10px;color:#3730a3;font-size:14px;font-weight:700;">⚡ Πληρωμή μέσω IRIS</p>
            <p style="margin:0 0 6px;color:#4338ca;font-size:13px;">Ανοίξτε την εφαρμογή της τράπεζάς σας και επιλέξτε <strong>Πληρωμές IRIS</strong>.</p>
            <table cellpadding="0" cellspacing="0" style="margin-top:10px;width:100%;">
              <tr><td style="padding:4px 0;color:#6366f1;font-size:12px;font-weight:700;width:110px;">IBAN</td><td style="padding:4px 0;color:#1e1b4b;font-size:13px;font-weight:600;font-family:monospace;">${BANK_IBAN}</td></tr>
              <tr><td style="padding:4px 0;color:#6366f1;font-size:12px;font-weight:700;">Δικαιούχος</td><td style="padding:4px 0;color:#1e1b4b;font-size:13px;">${BANK_HOLDER}</td></tr>
              <tr><td style="padding:4px 0;color:#6366f1;font-size:12px;font-weight:700;">Ποσό</td><td style="padding:4px 0;color:#1e1b4b;font-size:13px;font-weight:700;">€${order.total.toFixed(2)}</td></tr>
              <tr><td style="padding:4px 0;color:#6366f1;font-size:12px;font-weight:700;">Αιτιολογία</td><td style="padding:4px 0;color:#1e1b4b;font-size:13px;">Παραγγελία #${shortId(order.id)}</td></tr>
            </table>
          </td></tr>
        </table>
        ` : `
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 10px;color:#92400e;font-size:14px;font-weight:700;">🏦 Τραπεζική Κατάθεση</p>
            <p style="margin:0 0 10px;color:#78350f;font-size:13px;">Πραγματοποιήστε κατάθεση στον παρακάτω λογαριασμό. Χρησιμοποιήστε τον αριθμό παραγγελίας ως αιτιολογία.</p>
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              <tr><td style="padding:4px 0;color:#a16207;font-size:12px;font-weight:700;width:110px;">Τράπεζα</td><td style="padding:4px 0;color:#1c1917;font-size:13px;">${BANK_NAME}</td></tr>
              <tr><td style="padding:4px 0;color:#a16207;font-size:12px;font-weight:700;">IBAN</td><td style="padding:4px 0;color:#1c1917;font-size:13px;font-weight:600;font-family:monospace;">${BANK_IBAN}</td></tr>
              <tr><td style="padding:4px 0;color:#a16207;font-size:12px;font-weight:700;">Δικαιούχος</td><td style="padding:4px 0;color:#1c1917;font-size:13px;">${BANK_HOLDER}</td></tr>
              <tr><td style="padding:4px 0;color:#a16207;font-size:12px;font-weight:700;">Αιτιολογία</td><td style="padding:4px 0;color:#1c1917;font-size:13px;font-weight:700;">Παραγγελία #${shortId(order.id)}</td></tr>
              <tr><td style="padding:4px 0;color:#a16207;font-size:12px;font-weight:700;">Ποσό</td><td style="padding:4px 0;color:#92400e;font-size:14px;font-weight:800;">€${order.total.toFixed(2)}</td></tr>
            </table>
          </td></tr>
        </table>
        `}
      </td></tr>

      <!-- Status info -->
      <tr><td style="padding:24px 32px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0;color:#15803d;font-size:13px;font-weight:600;">✓ &nbsp;Η παραγγελία σας είναι <strong>επιβεβαιωμένη</strong>. Θα σας ειδοποιήσουμε με νέο email όταν αποσταλεί.</p>
          </td></tr>
        </table>
      </td></tr>
    `);

    try {
        const info = await transporter.sendMail({
            from: '"Anthymia Honey" <orders@anthymia.gr>',
            to: order.user.email,
            subject: `Επιβεβαίωση Παραγγελίας #${shortId(order.id)} — Anthymia Honey`,
            html,
        });
        console.log("Order confirmation sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending order confirmation:", error);
        return null;
    }
};

// ─── Admin: New Order Notification ─────────────────────────────────────────────

export const sendAdminNewOrderNotification = async (order: OrderEmailData) => {
    const adminUrl = process.env.ADMIN_URL || "http://localhost:5173/admin/orders";

    const html = emailWrapper(`
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#1c0a00 0%,#451a03 100%);padding:32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:28px;">🔔</p>
        <h1 style="margin:0 0 4px;color:#fde68a;font-size:22px;font-weight:800;">Νέα Παραγγελία!</h1>
        <p style="margin:0;color:#a16207;font-size:13px;">Anthymia Admin Notification</p>
      </td></tr>

      <!-- Order ID + total highlight -->
      <tr><td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#fef3c7;border-radius:10px 0 0 10px;padding:20px 24px;width:50%;">
              <p style="margin:0 0 4px;color:#a16207;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Αριθμός Παραγγελίας</p>
              <p style="margin:0;color:#92400e;font-size:20px;font-weight:800;">#${shortId(order.id)}</p>
              <p style="margin:4px 0 0;color:#a16207;font-size:12px;">${formatDate(order.createdAt)}</p>
            </td>
            <td style="background:#92400e;border-radius:0 10px 10px 0;padding:20px 24px;width:50%;text-align:right;">
              <p style="margin:0 0 4px;color:#fde68a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Σύνολο</p>
              <p style="margin:0;color:#fff;font-size:28px;font-weight:800;">€${order.total.toFixed(2)}</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Customer info -->
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Στοιχεία Πελάτη</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;">
          <tr>
            <td style="padding:6px 20px 0;" width="50%">
              <p style="margin:10px 0 3px;color:#78350f;font-size:11px;font-weight:700;text-transform:uppercase;">Όνομα</p>
              <p style="margin:0 0 10px;color:#1c1917;font-size:14px;font-weight:600;">${order.name}</p>
            </td>
            <td style="padding:6px 20px 0;" width="50%">
              <p style="margin:10px 0 3px;color:#78350f;font-size:11px;font-weight:700;text-transform:uppercase;">Email</p>
              <p style="margin:0 0 10px;color:#1c1917;font-size:14px;">${order.user.email}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 6px;" width="50%">
              <p style="margin:0 0 3px;color:#78350f;font-size:11px;font-weight:700;text-transform:uppercase;">Τηλέφωνο</p>
              <p style="margin:0 0 10px;color:#1c1917;font-size:14px;">${order.phone}</p>
            </td>
            <td style="padding:0 20px 6px;" width="50%">
              <p style="margin:0 0 3px;color:#78350f;font-size:11px;font-weight:700;text-transform:uppercase;">Διεύθυνση</p>
              <p style="margin:0 0 10px;color:#1c1917;font-size:14px;">${order.address}, ${order.city}</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding:0 20px 6px;">
              <p style="margin:0 0 3px;color:#78350f;font-size:11px;font-weight:700;text-transform:uppercase;">Τρόπος Πληρωμής</p>
              ${order.paymentMethod === "IRIS"
                ? `<span style="display:inline-block;background:#eef2ff;color:#3730a3;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;border:1px solid #c7d2fe;">⚡ IRIS Instant Payment</span>`
                : `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;border:1px solid #fde68a;">🏦 Τραπεζική Κατάθεση</span>`
              }
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Items -->
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Προϊόντα</p>
        ${itemsTable(order.items)}
        ${totalsBlock(order.total)}
      </td></tr>

      <!-- CTA -->
      <tr><td style="padding:28px 32px 32px;text-align:center;">
        <a href="${adminUrl}" style="display:inline-block;background:#92400e;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:999px;letter-spacing:.02em;">
          Διαχείριση Παραγγελίας →
        </a>
      </td></tr>
    `);

    try {
        const info = await transporter.sendMail({
            from: '"Anthymia System" <system@anthymia.gr>',
            to: process.env.ADMIN_EMAIL || "papagrigoriouc@gmail.com",
            subject: `🔔 Νέα Παραγγελία #${shortId(order.id)} — €${order.total.toFixed(2)}`,
            html,
        });
        console.log("Admin notification sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending admin notification:", error);
        return null;
    }
};

// ─── Order Status Update (existing, improved) ──────────────────────────────────

export const sendOrderStatusUpdate = async (email: string, orderId: string, status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: string }> = {
        PENDING:    { label: "Σε εκκρεμότητα", color: "#d97706", icon: "⏳" },
        PROCESSING: { label: "Σε επεξεργασία", color: "#2563eb", icon: "⚙️" },
        SHIPPED:    { label: "Απεστάλη",        color: "#7c3aed", icon: "🚚" },
        DELIVERED:  { label: "Παραδόθηκε",      color: "#16a34a", icon: "✅" },
        CANCELLED:  { label: "Ακυρώθηκε",       color: "#dc2626", icon: "❌" },
    };

    const s = statusMap[status] ?? { label: status, color: "#92400e", icon: "📦" };

    const html = emailWrapper(`
      <tr><td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:36px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:30px;">🍯</p>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Ενημέρωση Παραγγελίας</h1>
      </td></tr>
      <tr><td style="padding:32px 32px 0;text-align:center;">
        <div style="display:inline-block;background:${s.color}18;border:2px solid ${s.color}40;border-radius:12px;padding:20px 36px;margin-bottom:16px;">
          <p style="margin:0 0 6px;font-size:28px;">${s.icon}</p>
          <p style="margin:0;color:${s.color};font-size:18px;font-weight:800;">${s.label}</p>
        </div>
        <p style="color:#57534e;font-size:14px;line-height:1.6;margin:16px 0 0;">
          Η παραγγελία σας <strong>#${shortId(orderId)}</strong> ενημερώθηκε στην παραπάνω κατάσταση.<br/>
          Θα λάβετε νέο email με κάθε αλλαγή.
        </p>
      </td></tr>
      <tr><td style="padding:32px;"></td></tr>
    `);

    try {
        const info = await transporter.sendMail({
            from: '"Anthymia Honey" <orders@anthymia.gr>',
            to: email,
            subject: `${s.icon} Παραγγελία #${shortId(orderId)} — ${s.label}`,
            html,
        });
        console.log("Status update email sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending status update email:", error);
        return null;
    }
};

// ─── Contact Form → Admin ───────────────────────────────────────────────────

export const sendContactMessage = async (name: string, email: string, message: string) => {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "papagrigoriouc@gmail.com";

    const html = emailWrapper(`
      <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:26px;">✉️</p>
        <h1 style="margin:0 0 4px;color:#e2e8f0;font-size:20px;font-weight:800;">Νέο Μήνυμα Επικοινωνίας</h1>
        <p style="margin:0;color:#94a3b8;font-size:13px;">Anthymia — Φόρμα Επικοινωνίας</p>
      </td></tr>

      <tr><td style="padding:28px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td style="padding:6px 20px 0;" width="50%">
              <p style="margin:10px 0 3px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;">Όνομα</p>
              <p style="margin:0 0 10px;color:#0f172a;font-size:14px;font-weight:600;">${name}</p>
            </td>
            <td style="padding:6px 20px 0;" width="50%">
              <p style="margin:10px 0 3px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;">Email</p>
              <p style="margin:0 0 10px;font-size:14px;"><a href="mailto:${email}" style="color:#2563eb;text-decoration:none;">${email}</a></p>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 32px 0;">
        <p style="margin:0 0 10px;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Μήνυμα</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
          <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.75;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        </div>
      </td></tr>

      <tr><td style="padding:24px 32px 32px;text-align:center;">
        <a href="mailto:${email}?subject=Re: Επικοινωνία από ${encodeURIComponent(name)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 32px;border-radius:999px;">
          Απάντηση στον ${name} →
        </a>
      </td></tr>
    `);

    try {
        const info = await transporter.sendMail({
            from: '"Anthymia Contact" <noreply@anthymia.gr>',
            to: ADMIN_EMAIL,
            replyTo: `"${name}" <${email}>`,
            subject: `✉️ Μήνυμα από ${name} — Anthymia`,
            html,
        });
        console.log("Contact message sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending contact message:", error);
        return null;
    }
};

// ─── Invoice Email → Customer + Admin (with PDF attachment) ────────────────

export interface InvoiceEmailData {
    customerEmail:  string;
    customerName:   string;
    orderId:        string;
    mark:           string;
    invoiceNumber:  number;
    pdfBuffer:      Buffer;
    qrUrl?:         string;
}

export const sendInvoiceEmail = async (data: InvoiceEmailData) => {
    const ADMIN_EMAIL  = process.env.ADMIN_EMAIL || "papagrigoriouc@gmail.com";
    const short        = shortId(data.orderId);
    const invoiceNum   = `Α-${String(data.invoiceNumber).padStart(6, "0")}`;
    const filename     = `anthymia-apodeixi-${invoiceNum}.pdf`;
    const attachment   = { filename, content: data.pdfBuffer, contentType: "application/pdf" };

    const qrDataUrl = data.qrUrl
        ? await QRCode.toDataURL(data.qrUrl, { margin: 1, width: 100 })
        : null;

    const qrBlock = qrDataUrl
        ? `<td style="padding:18px 14px 18px 0;vertical-align:middle;text-align:center;width:120px;">
             <img src="${qrDataUrl}" width="100" height="100" style="display:block;border-radius:6px;" />
             <p style="margin:4px 0 0;font-size:9px;color:#16a34a;font-weight:bold;">Σάρωση myDATA</p>
           </td>`
        : "";

    const customerHtml = emailWrapper(`
      <tr><td style="background:linear-gradient(135deg,#15803d 0%,#16a34a 100%);padding:36px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:30px;">🧾</p>
        <h1 style="margin:0 0 6px;color:#fff;font-size:24px;font-weight:800;">Η Απόδειξή σας</h1>
        <p style="margin:0;color:#bbf7d0;font-size:14px;">Το παραστατικό σας από την Anthymia είναι έτοιμο</p>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <p style="margin:0 0 12px;color:#1c1917;font-size:15px;">Γεια σας <strong>${data.customerName}</strong>,</p>
        <p style="margin:0 0 20px;color:#57534e;font-size:14px;line-height:1.65;">
          Σας αποστέλλουμε την <strong>Απόδειξη Λιανικής Πώλησης</strong> για την παραγγελία σας.<br/>
          Το παραστατικό έχει εκδοθεί και καταχωρηθεί ηλεκτρονικά στην Α.Α.Δ.Ε. μέσω myDATA.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;margin-bottom:20px;">
          <tr>
            <td style="padding:18px 22px;vertical-align:top;">
              <table cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td style="padding:4px 0;font-size:11px;color:#16a34a;font-weight:bold;width:140px;">Αρ. Παραγγελίας</td>
                  <td style="padding:4px 0;font-size:12px;font-family:monospace;">#${short}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:11px;color:#16a34a;font-weight:bold;">Αρ. Απόδειξης</td>
                  <td style="padding:4px 0;font-size:12px;font-family:monospace;font-weight:bold;">${invoiceNum}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:11px;color:#16a34a;font-weight:bold;">ΜΑΡΚ (myDATA)</td>
                  <td style="padding:4px 0;font-size:13px;font-family:monospace;font-weight:bold;color:#15803d;">${data.mark}</td>
                </tr>
              </table>
            </td>
            ${qrBlock}
          </tr>
        </table>
        <p style="margin:0;color:#78350f;font-size:13px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
          📎 &nbsp;Το PDF της απόδειξης βρίσκεται ως συνημμένο αρχείο σε αυτό το email.
        </p>
      </td></tr>
    `);

    const adminHtml = emailWrapper(`
      <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);padding:32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:26px;">📋</p>
        <h1 style="margin:0 0 4px;color:#bfdbfe;font-size:20px;font-weight:800;">Παραστατικό Εκδόθηκε</h1>
        <p style="margin:0;color:#93c5fd;font-size:13px;">myAADE — Anthymia Admin</p>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:16px;">
          <tr><td style="padding:18px 22px;">
            <table cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="padding:4px 0;font-size:11px;color:#1d4ed8;font-weight:bold;width:140px;">Παραγγελία</td>
                <td style="padding:4px 0;font-size:12px;font-family:monospace;">#${short}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:11px;color:#1d4ed8;font-weight:bold;">Αρ. Απόδειξης</td>
                <td style="padding:4px 0;font-size:12px;font-family:monospace;font-weight:bold;">${invoiceNum}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:11px;color:#1d4ed8;font-weight:bold;">Πελάτης</td>
                <td style="padding:4px 0;font-size:12px;">${data.customerName} &lt;${data.customerEmail}&gt;</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:11px;color:#1d4ed8;font-weight:bold;">ΜΑΡΚ</td>
                <td style="padding:4px 0;font-size:13px;font-family:monospace;font-weight:bold;color:#1d4ed8;">${data.mark}</td>
              </tr>
            </table>
          </td></tr>
        </table>
        <p style="margin:0;color:#57534e;font-size:12px;">📎 &nbsp;Το PDF της απόδειξης βρίσκεται ως συνημμένο.</p>
      </td></tr>
    `);

    await Promise.all([
        transporter.sendMail({
            from:        '"Anthymia Honey" <orders@anthymia.gr>',
            to:          data.customerEmail,
            subject:     `🧾 Η Απόδειξή σας ${invoiceNum} — Anthymia`,
            html:        customerHtml,
            attachments: [attachment],
        }),
        transporter.sendMail({
            from:        '"Anthymia System" <system@anthymia.gr>',
            to:          ADMIN_EMAIL,
            subject:     `📋 Παραστατικό ${invoiceNum} — ${data.customerName} (#${short})`,
            html:        adminHtml,
            attachments: [attachment],
        }),
    ]);
    console.log("Invoice emails sent for order", data.orderId);
};

// ─── Newsletter Subscription → Admin ───────────────────────────────────────

export const sendNewsletterNotification = async (subscriberEmail: string, subscriberName?: string) => {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "papagrigoriouc@gmail.com";

    const html = emailWrapper(`
      <tr><td style="background:linear-gradient(135deg,#92400e 0%,#b45309 100%);padding:32px;text-align:center;">
        <p style="margin:0 0 4px;font-size:26px;">🐝</p>
        <h1 style="margin:0 0 4px;color:#fff;font-size:20px;font-weight:800;">Νέος Συνδρομητής Newsletter!</h1>
        <p style="margin:0;color:#fde68a;font-size:13px;">Anthymia — Newsletter</p>
      </td></tr>

      <tr><td style="padding:28px 32px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
          <tr>
            ${subscriberName ? `
            <td style="padding:16px 20px;" width="50%">
              <p style="margin:0 0 4px;color:#a16207;font-size:11px;font-weight:700;text-transform:uppercase;">Όνομα</p>
              <p style="margin:0;color:#1c1917;font-size:14px;font-weight:600;">${subscriberName}</p>
            </td>` : ""}
            <td style="padding:16px 20px;" ${subscriberName ? 'width="50%"' : ''}>
              <p style="margin:0 0 4px;color:#a16207;font-size:11px;font-weight:700;text-transform:uppercase;">Email</p>
              <p style="margin:0;font-size:14px;"><a href="mailto:${subscriberEmail}" style="color:#92400e;font-weight:600;text-decoration:none;">${subscriberEmail}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#78350f;font-size:13px;text-align:center;">
          ${formatDate(new Date())} · Νέος συνδρομητής στο newsletter της Anthymia
        </p>
      </td></tr>
    `);

    try {
        const info = await transporter.sendMail({
            from: '"Anthymia System" <system@anthymia.gr>',
            to: ADMIN_EMAIL,
            subject: `🐝 Νέος Συνδρομητής Newsletter — ${subscriberEmail}`,
            html,
        });
        console.log("Newsletter notification sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending newsletter notification:", error);
        return null;
    }
};
