import { logger } from "../logger";
import prisma from "../db.server";


export const action = async ({ request }) => {
    try {


        const { shop, gid ,carrier, tracking_number, tracking_url } = await request.json()

        if (!shop && !gid && !carrier && !tracking_number && !tracking_url) {
            return { status: 400, message: "Shop, GraphQL ID, Tracking carrier, number and url are required." }
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

            if (data?.errors) {
                logger.error(`Fulfillment order - ${JSON.stringify(data)}`)
                return { error: data.errors }
            }

            const edges = data?.data?.order?.fulfillmentOrders?.edges;

            logger.info(`edges: ${JSON.stringify(edges)}`)

            if (edges) {
                allFulfillmentOrders.push(...edges.map(e => {
                     return e.node
                }));
            }
            hasNextPage = data?.data?.order?.fulfillmentOrders?.pageInfo?.hasNextPage;
            cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
        }


        


        const lineItemsByFulfillmentOrder = []

        lineItemsByFulfillmentOrder.push(...allFulfillmentOrders.map((order) => {
            return {
                fulfillmentOrderId: order.id,
                fulfillmentOrderLineItems: order.lineItems.edges.map((e) => {
                    return {id: e.node.id, quantity: e.node.totalQuantity}
                })
            }
        }))

        //  Create Fulfillment for the Fulfillment Order

        const createFulfillmentMutation = `mutation (
                $lineItemsByFulfillmentOrder: [FulfillmentOrderLineItemsInput!]!,
                $carrier: String!,
                $tracking_number: String!,
                $tracking_url: URL
            ) {
        fulfillmentCreateV2(fulfillment: {
            notifyCustomer: true,
            trackingInfo: {
            company: $carrier,
            number: $tracking_number,
            url: $tracking_url
            },
            lineItemsByFulfillmentOrder: $lineItemsByFulfillmentOrder
        }) {
            fulfillment {
            id
            status
            }
            userErrors {
            field
            message
            }
        }
        }`


          const createFulfillmentResponse = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
                method: 'POST',
                headers: {
                    'X-Shopify-Access-Token': session.accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: createFulfillmentMutation,
                    variables: {
                        lineItemsByFulfillmentOrder,
                        carrier: carrier,
                        tracking_number: tracking_number,
                        tracking_url: tracking_url 
                    }
                }),
            });

            const createFulfillmentData = await createFulfillmentResponse.json()



        logger.info(`Create Fulfillment order - ${JSON.stringify(createFulfillmentData)}`)
        return { createFulfillmentData: createFulfillmentData };

    } catch (error) {
        console.log('error', error)
        logger.error(`Create Fulfillment Orders API - Error - ${JSON.stringify(error)}`)
        return { error: error?.message || error }
    }

}
