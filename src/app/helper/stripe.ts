import Stripe from "stripe";
import config from "../../config";

let stripe: Stripe;

if (config.stripe.secret_key) {
    stripe = new Stripe(config.stripe.secret_key);
} else {
    console.warn("⚠️ Stripe secret key not configured. Payment features will not work.");
    // Create a placeholder that will throw meaningful errors when used
    stripe = new Proxy({} as Stripe, {
        get(_, prop) {
            if (prop === 'paymentIntents' || prop === 'webhooks') {
                return new Proxy({}, {
                    get() {
                        throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY in .env");
                    }
                });
            }
            return undefined;
        }
    });
}

export { stripe };
