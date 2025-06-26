import { logger } from "../logger";
import prisma from "../db.server";


export const action = async ({ request }) => {
    try {
        const { shop, gid, status, message } = await request.json()

        if (!shop && !gid && !status && !message) {
            return { status: 400, message: "Shop name, GraphQL ID, fulfillment status & message is required." }
        }

        const session = await prisma.session.findFirst({
            where: { shop: shop }
        })

        const FULFILLMENT_ORDER_QUERY = `
        query GetOrderFulfillments ($orderId:ID!) {
           order(id: $orderId) {
             id
             fulfillments {
               id
               status
               createdAt
             }
           }
         }`

        const response = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': session.accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: FULFILLMENT_ORDER_QUERY,
                variables: {
                    orderId: gid,
                }
            }),
        });

        const data = await response.json();

        const fulfillments = data.data.order.fulfillments


        const CREATE_FULFILLMENT_EVENT = `
        mutation (
            $fulfillmentOrderId:ID!
            $status: FulfillmentEventStatus!
            $message: String
        ) {
        fulfillmentEventCreate (
            fulfillmentEvent: {
            fulfillmentId: $fulfillmentOrderId
            status: $status
            message: $message
            }
        ) {
            fulfillmentEvent {
            id
            status
            happenedAt
            }
            userErrors {
            field
            message
            }
        }
        }`


        const promises = []

        for (const fulfillment of fulfillments) {
            const promise = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
                method: 'POST',
                headers: {
                    'X-Shopify-Access-Token': session.accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: CREATE_FULFILLMENT_EVENT,
                    variables: {
                        fulfillmentOrderId: fulfillment.id,
                        status,
                        message
                    }
                }),
            }).then(async (res) => {
                return await res.json()
            }).catch((err) => {
                logger.error(`Create Event - ${JSON.stringify(err)}`)
                return {
                    error: err?.message
                }
            });

            promises.push(promise)
        }

        const fulfillmentEventRes = await Promise.all(promises)

        return { result: fulfillmentEventRes }





    } catch (error) {
        // console.log('error', error)
        logger.error(`Create Fulfillment Orders API - Error - ${JSON.stringify(error)}`)
        return { error: error?.message || error }
    }

}



