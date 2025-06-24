import { logger } from "../logger";
import prisma from "../db.server";


export async function loader({ params, request }) {
  try {
    const { shop } = params

    const url = new URL(request.url);
    const gid = url.searchParams.get("gid");

    if(!gid){
      return {
        message: "GraphQL ID is required"
      }
    }

    const session = await prisma.session.findFirst({
      where: { shop: shop }
    })

    const GET_FULFILLMENT_ORDERS = `
    query getFulfillmentOrders($orderId: ID!, $cursor: String) {
      order(id: $orderId) {
      name
        fulfillmentOrders(first: 50, after: $cursor) {
          pageInfo {
          hasNextPage
          }
          edges {
            cursor
            node {
              id
              status
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    totalQuantity
                  }
                }
              }
            }
          }
        }
      }
    }`


    let cursor = null;
    let hasNextPage = true;
    let allFulfillmentOrders = [];

    while (hasNextPage) {

      const response = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: GET_FULFILLMENT_ORDERS,
          variables: {
            orderId: gid,
            cursor: cursor
          }
        }),
      });


      const data = await response.json();


      // console.log(data?.data?.order?.fulfillmentOrders)

      if (data?.errors) {
        logger.error(`Fulfillment order - ${JSON.stringify(data)}`)
        return { error: data.errors }
      }

      const edges = data?.data?.order?.fulfillmentOrders?.edges;
      if (edges) {
        allFulfillmentOrders.push(...edges.map(e => e.node));

      }
      hasNextPage = data?.data?.order?.fulfillmentOrders?.pageInfo?.hasNextPage;
      cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
    }





    logger.info(`Fulfillment order - ${JSON.stringify(allFulfillmentOrders)}`)
    return { fulfillmentOrders: allFulfillmentOrders };


  } catch (error) {
    console.log('error', error)
    logger.error(`Fulfillment Orders API - Error - ${JSON.stringify(error)}`)
    return { error: error?.message || error }
  }

}



//  Create Fulfillment for the Fulfillment Order

// mutation {
//   fulfillmentCreateV2(fulfillment: {
//     notifyCustomer: true,
//     trackingInfo: {
//       company: "Carrier",
//       number: "TRACKING_NUMBER",
//       url: "TRACKING_URL"
//     },
//     lineItemsByFulfillmentOrder: [
//       {
//         fulfillmentOrderId: "gid://shopify/FulfillmentOrder/123",
//         fulfillmentOrderLineItems: [
//           { id: "gid://shopify/FulfillmentOrderLineItem/1", quantity: 1 },
//           { id: "gid://shopify/FulfillmentOrderLineItem/2", quantity: 1 },
//           { id: "gid://shopify/FulfillmentOrderLineItem/3", quantity: 1 }
//         ]
//       }
//     ]
//   }) {
//     fulfillment {
//       id
//       status
//     }
//     userErrors {
//       field
//       message
//     }
//   }
// }