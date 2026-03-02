import axios from "axios";
import { create } from "xmlbuilder2";
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { prisma } from "./prisma.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// XSD schemas directory (project root / NEW_VERSION_2_0_1)
const XSD_DIR = resolve(__dirname, "../../../NEW_VERSION_2_0_1");
const XSD_MAIN = join(XSD_DIR, "InvoicesDoc-v2.0.1.xsd");

const AADE_CONFIG = {
    userId:          process.env.AADE_USER_ID?.trim()          || "",
    subscriptionKey: process.env.AADE_SUBSCRIPTION_KEY?.trim() || "",
    issuerVat:       process.env.COMPANY_VAT?.trim()            || "",
    apiUrl: process.env.AADE_ENV === "production"
        ? "https://mydataapi.aade.gr/SendInvoices"
        : "https://mydataapidev.aade.gr/SendInvoices",
};

export interface InvoiceOrder {
    id:            string;
    total:         number;
    transactionId: string | null;
    paymentMethod: string;
    items: Array<{
        quantity: number;
        price:    number;
        product:  { name: string };
    }>;
    user: { name: string; email: string };
}

class AadeService {
    isConfigured(): boolean {
        return !!(AADE_CONFIG.userId && AADE_CONFIG.subscriptionKey && AADE_CONFIG.issuerVat);
    }

    /** Validate XML against the official AADE XSD v2.0.1 via xmllint */
    validateXML(xml: string): { valid: boolean; output: string } {
        const tmpFile = join(tmpdir(), `aade-${Date.now()}.xml`);
        try {
            writeFileSync(tmpFile, xml, "utf-8");
            const result = spawnSync("xmllint", [
                "--schema", XSD_MAIN,
                "--noout",
                tmpFile,
            ]);
            const output = [result.stdout?.toString(), result.stderr?.toString()]
                .filter(Boolean).join("\n").trim();
            return { valid: result.status === 0, output };
        } finally {
            try { unlinkSync(tmpFile); } catch { /* ignore */ }
        }
    }

    private async getNextInvoiceNumber(): Promise<number> {
        const counter = await prisma.counter.upsert({
            where:  { name: "invoice" },
            create: { name: "invoice", value: 1 },
            update: { value: { increment: 1 } },
        });
        return counter.value;
    }

    async issueInvoice(order: InvoiceOrder): Promise<{ mark: string; uid: string; invoiceNumber: number; qrUrl?: string }> {
        const invoiceNumber = await this.getNextInvoiceNumber();
        const xml = this.buildXML(order, invoiceNumber);

        // Validate before sending (non-blocking log on failure)
        const validation = this.validateXML(xml);
        if (!validation.valid) {
            console.warn("myAADE XSD validation failed for order", order.id, validation.output);
            // Continue anyway — AADE will return its own errors if truly invalid
        }

        try {
            const response = await axios.post(AADE_CONFIG.apiUrl, xml, {
                headers: {
                    "aade-user-id":              AADE_CONFIG.userId,
                    "Ocp-Apim-Subscription-Key": AADE_CONFIG.subscriptionKey,
                    "Content-Type":              "application/xml",
                },
            });

            const result = this.parseResponse(response.data as string);

            if (result.success) {
                await prisma.order.update({
                    where: { id: order.id },
                    data: {
                        aadeMark:      result.mark,
                        aadeUid:       result.uid,
                        invoiceNumber,
                    },
                });
                return { mark: result.mark!, uid: result.uid!, invoiceNumber, qrUrl: result.qrUrl };
            } else {
                throw new Error(`myAADE: ${result.errors?.join(", ")}`);
            }
        } catch (err) {
            console.error("myAADE invoice error for order", order.id, err);
            throw err;
        }
    }

    buildXML(order: InvoiceOrder, invoiceNumber: number): string {
        const today = new Date().toISOString().split("T")[0];
        const r2 = (n: number) => Math.round(n * 100) / 100;

        // Prices in DB are gross (VAT 24% included)
        const totalNet = r2(order.items.reduce((s, i) => s + r2((i.price * i.quantity) / 1.24), 0));
        const totalVat = r2(order.total - totalNet);

        const paymentType = order.paymentMethod === "IRIS" ? 7 : 5;

        const doc = create({ version: "1.0", encoding: "UTF-8" });

        // ⚠️  Main namespace is http:// (not https://) — confirmed from XSD targetNamespace
        const invoicesDoc = doc.ele("InvoicesDoc", {
            xmlns:        "http://www.aade.gr/myDATA/invoice/v1.0",
            "xmlns:icls": "https://www.aade.gr/myDATA/incomeClassificaton/v1.0",
        });

        const inv = invoicesDoc.ele("invoice");

        // Issuer
        inv.ele("issuer")
            .ele("vatNumber").txt(AADE_CONFIG.issuerVat).up()
            .ele("country").txt("GR").up()
            .ele("branch").txt("0");

        // Header
        inv.ele("invoiceHeader")
            .ele("series").txt("A").up()
            .ele("aa").txt(String(invoiceNumber)).up()
            .ele("issueDate").txt(today).up()
            .ele("invoiceType").txt("11.1").up()
            .ele("currency").txt("EUR");

        // Payment method
        const pm = inv.ele("paymentMethods").ele("paymentMethodDetails");
        pm.ele("type").txt(String(paymentType));
        pm.ele("amount").txt(order.total.toFixed(2));
        if (order.transactionId) {
            pm.ele("paymentMethodInfo").txt(order.transactionId);
        }

        // Invoice lines
        order.items.forEach((item, index) => {
            const netVal = r2((item.price * item.quantity) / 1.24);
            const vatAmt = r2(item.price * item.quantity - netVal);

            const det = inv.ele("invoiceDetails");
            det.ele("lineNumber").txt(String(index + 1));
            det.ele("netValue").txt(netVal.toFixed(2));
            det.ele("vatCategory").txt("1"); // 1 = ΦΠΑ 24%
            det.ele("vatAmount").txt(vatAmt.toFixed(2));
            det.ele("incomeClassification")
                .ele("icls:classificationType").txt("E3_561_003").up()
                .ele("icls:classificationCategory").txt("category1_1").up()
                .ele("icls:amount").txt(netVal.toFixed(2));
        });

        // Summary
        const summary = inv.ele("invoiceSummary");
        summary.ele("totalNetValue").txt(totalNet.toFixed(2));
        summary.ele("totalVatAmount").txt(totalVat.toFixed(2));
        summary.ele("totalWithheldAmount").txt("0.00");
        summary.ele("totalFeesAmount").txt("0.00");
        summary.ele("totalStampDutyAmount").txt("0.00");
        summary.ele("totalOtherTaxesAmount").txt("0.00");
        summary.ele("totalDeductionsAmount").txt("0.00");
        summary.ele("totalGrossValue").txt(order.total.toFixed(2));
        summary.ele("incomeClassification")
            .ele("icls:classificationType").txt("E3_561_003").up()
            .ele("icls:classificationCategory").txt("category1_1").up()
            .ele("icls:amount").txt(totalNet.toFixed(2));

        return doc.end({ prettyPrint: true });
    }

    parseResponse(xml: string): {
        success: boolean;
        mark?:   string;
        uid?:    string;
        qrUrl?:  string;
        errors?: string[];
    } {
        const markMatch   = xml.match(/<invoiceMark>(\d+)<\/invoiceMark>/);
        const uidMatch    = xml.match(/<invoiceUid>([^<]+)<\/invoiceUid>/);
        const statusMatch = xml.match(/<statusCode>([^<]+)<\/statusCode>/);
        const qrMatch     = xml.match(/<qrUrl>([^<]+)<\/qrUrl>/);

        if (statusMatch?.[1] === "Success" && markMatch?.[1]) {
            return { success: true, mark: markMatch[1], uid: uidMatch?.[1], qrUrl: qrMatch?.[1] };
        }

        const errorMatches = [...xml.matchAll(/<message>([^<]+)<\/message>/g)];
        return {
            success: false,
            errors: errorMatches.length ? errorMatches.map((m) => m[1]) : ["Unknown AADE error"],
        };
    }
}

export default new AadeService();
