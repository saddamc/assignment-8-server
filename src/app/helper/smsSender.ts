import axios from "axios";

const toE164 = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;

    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("00")) return `+${digits.slice(2)}`;
    return `+${digits}`;
};

/**
 * Sends an SMS text message containing the verification OTP.
 * Supports Twilio (API-driven) or any standard generic HTTP SMS Gateway.
 * 
 * @param to - Recipient phone number (e.g., +1234567890)
 * @param otp - The 6-digit verification code
 */
export const smsSender = async (to: string, otp: string): Promise<boolean> => {
    const recipient = toE164(to);
    const message = `[E-Commerce] Your verification code is ${otp}. It will expire in 5 minutes. Do not share this code.`;

    // OPTION A: Using Twilio SMS direct REST API
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    
    const useTwilio = sid && token && from;

    if (useTwilio) {
        try {
            const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
            
            const response = await axios.post(
                `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
                new URLSearchParams({
                    To: recipient,
                    From: from,
                    Body: message
                }).toString(),
                {
                    headers: {
                        Authorization: `Basic ${authHeader}`,
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                }
            );

            return response.status === 201;
        } catch (error: any) {
            console.error("Twilio SMS send error:", error?.response?.data || error.message);
            return false;
        }
    }

    // OPTION B: Generic Regional HTTP API SMS Gateway.
    // Configure param names if your provider uses names like contacts/msg/senderid.
    try {
        const gatewayUrl = process.env.SMS_GATEWAY_URL;
        const apiKey = process.env.SMS_API_KEY;

        if (gatewayUrl && apiKey) {
            const apiKeyParam = process.env.SMS_API_KEY_PARAM || "apiKey";
            const toParam = process.env.SMS_TO_PARAM || "to";
            const messageParam = process.env.SMS_MESSAGE_PARAM || "message";
            const senderParam = process.env.SMS_SENDER_PARAM || "senderId";
            const method = (process.env.SMS_GATEWAY_METHOD || "GET").toUpperCase();

            const payload: Record<string, string> = {
                [apiKeyParam]: apiKey,
                [toParam]: recipient,
                [messageParam]: message
            };

            if (process.env.SMS_SENDER_ID) {
                payload[senderParam] = process.env.SMS_SENDER_ID;
            }

            const response = method === "POST"
                ? await axios.post(gatewayUrl, payload)
                : await axios.get(gatewayUrl, { params: payload });

            return response.status >= 200 && response.status < 300;
        }

        // Local simulator fallback: logs the OTP only. This does not send SMS.
        if (process.env.NODE_ENV !== "production") {
            console.log("\n--- [SMS SIMULATOR DEV MODE] ---");
            console.log("No SMS provider configured. This OTP was NOT sent to a phone.");
            console.log(`To: ${recipient}`);
            console.log(`Message: ${message}`);
            console.log("--------------------------------\n");
            return true;
        }

        console.error("SMS send error: no SMS provider configured in production.");
        return false;
    } catch (error: any) {
        console.error("Generic SMS Gateway send error:", error.message);
        return false;
    }
};
