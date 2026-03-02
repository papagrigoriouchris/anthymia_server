import axios from "axios";
import { createHmac } from "crypto";

const vivaConfig = {
    clientId:      process.env.VIVA_CLIENT_ID      || "",
    clientSecret:  process.env.VIVA_CLIENT_SECRET  || "",
    merchantId:    process.env.VIVA_MERCHANT_ID    || "",
    apiKey:        process.env.VIVA_API_KEY         || "",
    sourceCode:    process.env.VIVA_SOURCE_CODE    || "",
    webhookSecret: process.env.VIVA_WEBHOOK_SECRET || "",
    authUrl: process.env.VIVA_ENV === "production"
        ? "https://accounts.vivapayments.com/connect/token"
        : "https://demo-accounts.vivapayments.com/connect/token",
    apiUrl: process.env.VIVA_ENV === "production"
        ? "https://api.vivapayments.com"
        : "https://demo-api.vivapayments.com",
};

export interface IrisQRData {
    qrCodeUrl:    string;
    qrCodeString: string;
    irisId:       string;
    amount:       number;
    expiresAt:    string;
}

class VivaService {
    isConfigured(): boolean {
        return !!(vivaConfig.clientId && vivaConfig.clientSecret && vivaConfig.merchantId && vivaConfig.sourceCode);
    }

    private async getAccessToken(): Promise<string> {
        const credentials = Buffer.from(
            `${vivaConfig.clientId}:${vivaConfig.clientSecret}`
        ).toString("base64");

        const response = await axios.post(
            vivaConfig.authUrl,
            "grant_type=client_credentials",
            {
                headers: {
                    Authorization:  `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );
        return response.data.access_token as string;
    }

    async createPaymentOrder(orderData: {
        orderId:       string;
        amount:        number;
        customerEmail: string;
        customerName:  string;
        customerPhone: string;
        description:   string;
    }): Promise<string> {
        const token = await this.getAccessToken();

        const payload = {
            amount:              Math.round(orderData.amount * 100),
            customerTrns:        orderData.description,
            customer: {
                email:       orderData.customerEmail,
                fullName:    orderData.customerName,
                phone:       orderData.customerPhone,
                countryCode: "GR",
                requestLang: "el-GR",
            },
            paymentTimeout:      300,
            preauth:             false,
            allowRecurring:      false,
            maxInstallments:     0,
            paymentNotification: true,
            tipAmount:           0,
            disableExactAmount:  false,
            disableCash:         true,
            disableWallet:       false,
            sourceCode:          vivaConfig.sourceCode,
            merchantTrns:        orderData.orderId,
            tags:                [orderData.orderId],
        };

        const response = await axios.post(
            `${vivaConfig.apiUrl}/checkout/v2/orders`,
            payload,
            {
                headers: {
                    Authorization:  `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return String(response.data.orderCode);
    }

    async createIrisQR(orderCode: string): Promise<IrisQRData> {
        const token = await this.getAccessToken();

        const irisUrl = `${vivaConfig.apiUrl}/nativecheckout/v2/irisqr?merchantid=${vivaConfig.merchantId}&orderCode=${orderCode}`;

        const response = await axios.get(irisUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });

        return {
            qrCodeUrl:    response.data.qrCodeUrl  || "",
            qrCodeString: response.data.qrCode     || "",
            irisId:       response.data.irisId     || "",
            amount:       response.data.amount      || 0,
            expiresAt:    response.data.expiresAt  || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        };
    }

    verifyWebhookSignature(rawBody: string, signature: string): boolean {
        if (!vivaConfig.webhookSecret) return true;
        const expected = createHmac("sha256", vivaConfig.webhookSecret)
            .update(rawBody)
            .digest("hex");
        return expected === signature;
    }

    async getTransactionDetails(transactionId: string): Promise<any> {
        const token = await this.getAccessToken();
        const response = await axios.get(
            `${vivaConfig.apiUrl}/checkout/v2/transactions/${transactionId}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    }
}

export default new VivaService();
