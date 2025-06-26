import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { createOrder, signin } from "../services/API";
import { logger } from "../logger";

export const action = async ({ request }) => {
  try {
    const rawBody = await request.text();
    const rawRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: rawBody,
    });

    const { shop } = await authenticate.webhook(rawRequest);
    const orderData = JSON.parse(rawBody);

    // Save order in DB
    await prisma.orders.create({
      data: {
        id: orderData.id.toString(),
        shop,
        admin_graphql_api_id: orderData.admin_graphql_api_id,
        order: orderData,
      },
    });

    // Try to send order to external service
    let result = await createOrder([orderData], shop);
    logger.info("Webhook - Create Order - 1st try", result);

    // console.log(`🕹🕹🎮♟♟🀄♟♟`, result)

    // If unauthorized, re-authenticate and retry
    if (result?.results?.status_code === 403 || (Array.isArray(result?.results) && result?.results?.[0]?.status_code === 403)) {
      logger.warn("Webhook - Create Order - Unauthorized, retrying after signin.");
      await signin(shop);
      result = await createOrder([orderData], shop);
      logger.info("Webhook - Create Order - 2nd try", result);

      if (result?.results?.status_code === 403 || (Array.isArray(result?.results) && result?.results?.[0]?.status_code === 403)) {
        logger.error("Webhook - Create Order - Retry failed due to invalid credentials.");
      }
    }

    return new Response("Webhook processed", { status: 200 });

  } catch (error) {
    logger.error("Webhook - Create Order - Exception", { error });
    return new Response("Webhook failed", { status: 500 });
  }
};
