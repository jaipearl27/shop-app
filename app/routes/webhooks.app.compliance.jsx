import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { logger } from "../logger";

const prisma = new PrismaClient();
const SHOPIFY_API_SECRET_KEY = process.env.SHOPIFY_API_SECRET;

// HMAC validation helper
function isValidShopifyWebhook(request, rawBody) {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET_KEY)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export const action = async ({ request }) => {
  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!isValidShopifyWebhook(request, rawBody)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString("utf8"));
  const topic = request.headers.get("x-shopify-topic");

  switch (topic) {
    case "customers/data_request": {
      // Fetch user data
      const user = await prisma.user.findFirst({
        where: {
          shop: payload.shop_domain,
          id: payload.customer.id,
        },
      });

      // Fetch all orders for this customer/shop
      const orders = await prisma.orders.findMany({
        where: {
          shop: payload.shop_domain,
          order: {
            path: ["customer", "id"],
            equals: payload.customer.id,
          },
        },
      });

      // Optionally, fetch sessions or other related data

      // Compose the data to return or send to Shopify (or log/queue for processing)
      const customerData = {
        user,
        orders,
        // Add more related data as needed
      };

      logger.info("Customer data request", customerData);

      // You may need to email this data to the customer or upload it for Shopify
      break;
    }

    case "customers/redact":
      // Delete customer and their orders for this shop
      await prisma.orders.deleteMany({
        where: {
          shop: payload.shop_domain,
          order: {
            path: ["customer", "id"],
            equals: payload.customer.id,
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          shop: payload.shop_domain,
          id: payload.customer.id,
        },
      });
      break;

    case "shop/redact":
      // Delete all data for the shop
      await prisma.orders.deleteMany({
        where: { shop: payload.shop_domain },
      });
      await prisma.session.deleteMany({
        where: { shop: payload.shop_domain },
      });
      await prisma.user.deleteMany({
        where: { shop: payload.shop_domain },
      });
      break;

    default:
      // Unknown topic, ignore or log
      logger.warn("Unknown compliance webhook topic", topic);
      break;
  }

  return { success: true };
};