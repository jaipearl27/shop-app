import axios from "axios";
import prisma from "../db.server";
import { logger } from "../logger";
import { formatDate } from "../utils";

export const signin = async (shop, username = undefined, password = undefined) => {
    try {


        const existingUser = await prisma.user.findFirst({
            where: {
                shop
            }
        })

        logger.info(`Username: ${username} - Password - ${password} - Existing User: ${JSON.stringify(existingUser)}`)


        if (!username && !password && !existingUser) {
            logger.error(`API - Sign in - No user exists for the shop ${shop}`)
            return {
                data: {
                    status: false,
                    message: "No user exists for this shop."
                }
            }
        }

        const userName = username || existingUser.username
        const userPass = password || existingUser.password

        const result = await axios.post(
            `${process.env.NODE_ENV === "production" ? process.env.API_URL : process.env.API_URL_TEST}/authToken`,
            {
                username: userName ,
                password: userPass
            }
        )


        logger.info(`API - Sign In - ${JSON.stringify(result?.data)} - status: ${result?.status}`)

        if (!result?.data?.token) {
            return {
                data: {
                    status: false,
                    message: "Invalid credentails."
                }
            }
        }

        let user = await prisma.user.upsert({
            where: { shop },
            update: { username: userName, password: userPass, token: result?.data?.token, authorized: true },
            create: { shop, username: userName, password: userPass, token: result?.data?.token, authorized: true },
        });

        return { user, result };
    } catch (error) {
        console.error(error)
        logger.error(`API - Sign In - ${JSON.stringify(error)}`)
        return { success: false, message: "server error, please try again later or contact your admin." }
    }
}

export const createOrder = async (orders, shop) => {
    try {
        const user = await prisma.user.findFirst({
            where: { shop: shop }
        });

        if (!user) {
            logger.error(`User not found for shop ${shop}`)
            return { success: false, message: "User Not Found." };
        }

        const promises = [];

        for (const orderData of orders) {
            const shipmentItems = [];

            for (const i of orderData?.line_items || []) {
                let IGST_PERCENTAGE = 0;
                let CGST_PERCENTAGE = 0;
                let SGST_PERCENTAGE = 0;

                for (const tax of i.tax_lines || []) {
                    switch (tax.title) {
                        case "IGST":
                            IGST_PERCENTAGE = tax.rate;
                            break;
                        case "CGST":
                            CGST_PERCENTAGE = tax.rate;
                            break;
                        case "SGST":
                            SGST_PERCENTAGE = tax.rate;
                            break;
                    }
                }

                shipmentItems.push({
                    DESCRIPTION: i.title || i.name,
                    QUANTITY: Number(i?.quantity) || 0,
                    ITEM_PRICE: Number(i?.price) || Number(orderData?.total_price) || 0,
                    SKU_CODE: i?.sku || "",
                    HSN_CODE: "",
                    IGST_PERCENTAGE,
                    CGST_PERCENTAGE,
                    SGST_PERCENTAGE
                });
            }

            const payload = {
                "*SHIPMENT_ORDER_NUMBER": orderData?.order_number.toString(),
                "*SHIPMENT_INVOICE_CODE": "",
                "*SHIPMENT_ORDER_DATE": formatDate(orderData?.created_at),
                "*SHIPMENT_WEIGHT": `${orderData?.total_weight}`,
                "SHIPMENT_LENGTH": "1",
                "SHIPMENT_HEIGHT": "1",
                "SHIPMENT_BREADTH": "1",
                "*SHIPMENT_ITEMS": shipmentItems,
                "ORDER_DATA": orderData,
                "*CUSTOMER_NAME":
                    orderData?.billing_address?.name ||
                    `${orderData?.billing_address?.first_name} ${orderData?.billing_address?.last_name}` ||
                    `${orderData?.shipping_address?.first_name} ${orderData?.shipping_address?.last_name}`,
                "*CUSTOMER_EMAIL":
                    orderData?.contact_email || orderData?.customer?.email || orderData?.email,
                "*CUSTOMER_PHONE":
                    orderData?.billing_address?.phone || orderData?.shipping_address?.phone || "9999999999",
                "*CUSTOMER_ADDRESS1": orderData?.shipping_address?.address1,
                "*CUSTOMER_ADDRESS2": orderData?.shipping_address?.address2,
                "*CUSTOMER_PINCODE": orderData?.shipping_address?.zip,
                CUSTOMER_CITY: orderData?.shipping_address?.city,
                CUSTOMER_STATE: orderData?.shipping_address?.province,
                CUSTOMER_COUNTRY: orderData?.shipping_address?.country,
                "*PAYMENT_MODE": orderData?.financial_status,
                "*TOTAL_AMOUNT": orderData?.total_price,
                "*COLLECTABLE_AMOUNT": orderData?.total_outstanding
            };

            logger.info(`create order - api - ${JSON.stringify(payload)}`)

            const promise = axios
                .post(
                    `${process.env.NODE_ENV === "production" ? process.env.API_URL : process.env.API_URL_TEST}/order_allocation/shopify/create_order`,
                    payload,
                    {
                        headers: {
                            Authorization: `Bearer ${user.token}`
                        }
                    }
                )
                .then(async (result) => {
                    if (result?.data?.status_code === 200) {
                        await prisma.orders.update({
                            where: {
                                id: orderData?.id.toString()
                            },
                            data: {
                                synched: true
                            }
                        });
                        return { id: payload["*SHIPMENT_ORDER_NUMBER"], status: "success", status_code: result?.data?.status_code };
                    }
                    return { id: payload["*SHIPMENT_ORDER_NUMBER"], status: "failed", message: result?.data, status_code: result?.data?.status_code };
                })
                .catch((error) => {
                    logger.error(`API - Create Order ${JSON.stringify(error?.response?.status)}`)
                    return {
                        id: payload["*SHIPMENT_ORDER_NUMBER"],
                        status: "error",
                        message: error?.response?.data || error.message,
                        status_code: error?.response?.status
                    };
                });

            promises.push(promise);
        }

        const results = await Promise.all(promises);
        return { success: true, results };

    } catch (err) {
        console.error(err)
        logger.error(`API - Create Order - ${JSON.stringify(err)}`)
        return { success: false, message: "Server error, please try again later or contact admin." };
    }
};
