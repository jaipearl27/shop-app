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


  logger.info('webhook hit - compliance')

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (!isValidShopifyWebhook(request, rawBody)) {
    logger.error('webhook compliance - unauthorized')
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = JSON.parse(rawBody.toString("utf8"));
  const topic = request.headers.get("x-shopify-topic");


  logger.info(`webhook - compliance payload : ${JSON.stringify(payload)} | Topic: ${topic}`)


  let orders;

  switch (topic) {
    case "customers/data_request": {
      // Fetch all orders for this customer/shop
      const { shop_domain, customer, orders_requested } = payload;

      const whereClause = {
        shop: shop_domain,
        order: {
          path: ["customer", "id"],
          equals: customer.id,
        },
      };

      // If orders_requested is present, filter by order.id inside the JSON
      if (Array.isArray(orders_requested) && orders_requested.length > 0) {
        whereClause.AND = {
          order: {
            path: ["id"],
            in: orders_requested,
          },
        };
      }

      orders = await prisma.orders.findMany({ where: whereClause });

      logger.info("Orders data request", orders);
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
      logger.error("Unknown compliance webhook topic", topic);
      break;
  }

  if (orders) {
    return { success: true, orders: orders };
  } else {
    return { success: true };
  }

};