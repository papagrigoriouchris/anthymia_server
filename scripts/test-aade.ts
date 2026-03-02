/**
 * myAADE Sandbox Test Script
 *
 * Χρήση:
 *   npx tsx scripts/test-aade.ts   (από server/)
 *   npx tsx test-aade.ts           (από server/scripts/)
 *
 * Ελέγχει:
 *   1. Δημιουργία έγκυρου XML (τύπος 11.1 ΑΛΠ)
 *   2. Validation μέσω XSD (InvoicesDoc-v2.0.1.xsd)
 *   3. Αποστολή στο myAADE sandbox
 *   4. Επιστροφή ΜΑΡΚ
 */

/// <reference types="node" />
import { config } from "dotenv";
config({ path: new URL("../.env", import.meta.url).pathname });
import axios from "axios";
import { create } from "xmlbuilder2";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────

const XSD_DIR = resolve(__dirname, "../../NEW_VERSION_2_0_1");
const XSD_MAIN = join(XSD_DIR, "InvoicesDoc-v2.0.1.xsd");

const AADE_URL = "https://mydataapidev.aade.gr/SendInvoices";

const userId = process.env.AADE_USER_ID?.trim() ?? "";
const subKey = process.env.AADE_SUBSCRIPTION_KEY?.trim() ?? "";
const vatNum = process.env.COMPANY_VAT?.trim() ?? "";

// ── Build hardcoded test invoice XML ─────────────────────────────────────────

function buildTestXML(invoiceAa: string): string {
    const today = new Date().toISOString().split("T")[0];

    // Test order: 2 items (hardcoded)
    const items = [
        { name: "Θυμαρίσιο μέλι 250g", netValue: 5.65, vatAmt: 1.35, gross: 7.00 },
        { name: "Ανθόμελο 500g", netValue: 8.87, vatAmt: 2.13, gross: 11.00 },
    ];
    const totalNet = items.reduce((s, i) => s + i.netValue, 0).toFixed(2);
    const totalVat = items.reduce((s, i) => s + i.vatAmt, 0).toFixed(2);
    const totalGross = items.reduce((s, i) => s + i.gross, 0).toFixed(2);

    const doc = create({ version: "1.0", encoding: "UTF-8" });

    // ⚠️  Main namespace: http:// (not https://) — per XSD targetNamespace
    const root = doc.ele("InvoicesDoc", {
        xmlns: "http://www.aade.gr/myDATA/invoice/v1.0",
        "xmlns:icls": "https://www.aade.gr/myDATA/incomeClassificaton/v1.0",
    });

    const inv = root.ele("invoice");

    // Issuer
    inv.ele("issuer")
        .ele("vatNumber").txt(vatNum).up()
        .ele("country").txt("GR").up()
        .ele("branch").txt("0");

    // Header (type 11.1 = ΑΛΠ, retail B2C)
    inv.ele("invoiceHeader")
        .ele("series").txt("A").up()
        .ele("aa").txt(invoiceAa).up()
        .ele("issueDate").txt(today).up()
        .ele("invoiceType").txt("11.1").up()
        .ele("currency").txt("EUR");

    // Payment method (7 = IRIS)
    inv.ele("paymentMethods").ele("paymentMethodDetails")
        .ele("type").txt("7").up()
        .ele("amount").txt(totalGross);

    // Invoice lines
    items.forEach((item, idx) => {
        const det = inv.ele("invoiceDetails");
        det.ele("lineNumber").txt(String(idx + 1));
        det.ele("netValue").txt(item.netValue.toFixed(2));
        det.ele("vatCategory").txt("1"); // 24%
        det.ele("vatAmount").txt(item.vatAmt.toFixed(2));
        det.ele("incomeClassification")
            .ele("icls:classificationType").txt("E3_561_003").up()
            .ele("icls:classificationCategory").txt("category1_1").up()
            .ele("icls:amount").txt(item.netValue.toFixed(2));
    });

    // Summary
    const sum = inv.ele("invoiceSummary");
    sum.ele("totalNetValue").txt(totalNet);
    sum.ele("totalVatAmount").txt(totalVat);
    sum.ele("totalWithheldAmount").txt("0.00");
    sum.ele("totalFeesAmount").txt("0.00");
    sum.ele("totalStampDutyAmount").txt("0.00");
    sum.ele("totalOtherTaxesAmount").txt("0.00");
    sum.ele("totalDeductionsAmount").txt("0.00");
    sum.ele("totalGrossValue").txt(totalGross);
    sum.ele("incomeClassification")
        .ele("icls:classificationType").txt("E3_561_003").up()
        .ele("icls:classificationCategory").txt("category1_1").up()
        .ele("icls:amount").txt(totalNet);

    return doc.end({ prettyPrint: true });
}

// ── XSD Validation via xmllint ────────────────────────────────────────────────

function validateXML(xml: string): { valid: boolean; output: string } {
    const tmpFile = join(tmpdir(), `aade-test-${Date.now()}.xml`);
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

// ── Parse AADE response ───────────────────────────────────────────────────────

function parseResponse(xml: string): {
    success: boolean; mark?: string; uid?: string; statusCode?: string; errors?: string[];
} {
    const markMatch = xml.match(/<invoiceMark>(\d+)<\/invoiceMark>/);
    const uidMatch = xml.match(/<invoiceUid>([^<]+)<\/invoiceUid>/);
    const statusMatch = xml.match(/<statusCode>([^<]+)<\/statusCode>/);
    const statusCode = statusMatch?.[1];

    if (statusCode === "Success" && markMatch?.[1]) {
        return { success: true, mark: markMatch[1], uid: uidMatch?.[1], statusCode };
    }

    const errorMatches = [...xml.matchAll(/<message>([^<]+)<\/message>/g)];
    const codeMatches = [...xml.matchAll(/<code>([^<]+)<\/code>/g)];
    const errors = errorMatches.map((m, i) =>
        `[${codeMatches[i]?.[1] ?? "?"}] ${m[1]}`
    );
    return { success: false, statusCode, errors };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════");
    console.log("  myAADE Sandbox Test — Anthymia");
    console.log("═══════════════════════════════════════\n");

    // Credentials check
    if (!userId || !subKey || !vatNum) {
        console.error("✗ Λείπουν credentials στο .env:");
        console.error("  AADE_USER_ID, AADE_SUBSCRIPTION_KEY, COMPANY_VAT");
        process.exit(1);
    }
    console.log(`AADE_USER_ID : ${userId}`);
    console.log(`COMPANY_VAT  : ${vatNum}`);
    console.log(`API URL      : ${AADE_URL}\n`);

    // Use timestamp as ΑΑ to avoid duplicate rejection in sandbox
    const invoiceAa = String(Math.floor(Date.now() / 1000));
    console.log(`Invoice ΑΑ   : ${invoiceAa} (σειρά Α)\n`);

    // ── Step 1: Build XML
    console.log("--- Βήμα 1: Δημιουργία XML ---");
    const xml = buildTestXML(invoiceAa);
    console.log(xml);

    // ── Step 2: XSD Validation
    console.log("--- Βήμα 2: XSD Validation ---");
    const validation = validateXML(xml);
    if (validation.valid) {
        console.log("✓ XML valid — passes InvoicesDoc-v2.0.1.xsd\n");
    } else {
        console.log("✗ XSD Validation FAILED:");
        console.log(validation.output);
        console.log("\nΑποστολή ακυρώνεται λόγω XSD errors.");
        process.exit(1);
    }

    // ── Step 3: Send to sandbox
    console.log(`--- Βήμα 3: Αποστολή στο ${AADE_URL} ---`);
    try {
        const response = await axios.post(AADE_URL, xml, {
            headers: {
                "aade-user-id": userId,
                "Ocp-Apim-Subscription-Key": subKey,
                "Content-Type": "application/xml",
            },
            timeout: 15000,
        });

        console.log(`HTTP ${response.status}\n`);
        console.log("Response XML:");
        console.log(response.data);

        // ── Step 4: Parse ΜΑΡΚ
        console.log("\n--- Βήμα 4: Αποτέλεσμα ---");
        const result = parseResponse(response.data as string);

        if (result.success) {
            console.log(`\n✓ ΕΠΙΤΥΧΙΑ!`);
            console.log(`  ΜΑΡΚ : ${result.mark}`);
            if (result.uid) console.log(`  UID  : ${result.uid}`);
        } else {
            console.log(`\n✗ ΑΠΟΤΥΧΙΑ (statusCode: ${result.statusCode})`);
            result.errors?.forEach(e => console.log("  →", e));
        }
    } catch (err: any) {
        const status = err.response?.status;
        const data = err.response?.data ?? err.message;
        console.error(`\n✗ HTTP Error ${status ?? ""}:`, data);
        process.exit(1);
    }
}

main();
