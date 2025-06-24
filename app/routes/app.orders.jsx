import {
    Page,
    IndexTable,
    Text,
    Button,
    Card,
    Bleed,
    Frame,
    SkeletonBodyText,
    useIndexResourceState,
    Banner,
    BlockStack,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { useLoaderData, useNavigate, useLocation, useFetcher, useActionData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { formatDate } from "../utils";
import { logger } from "../logger"
import { createOrder, signin } from "../services/API";
// --- Server Loader ---
export const loader = async ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const take = 25;
    const skip = (page - 1) * take;

    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const orders = await prisma.orders.findMany({
        where: { shop },
        skip,
        take,
        orderBy: { createdAt: "desc" },
    });

    const totalCount = await prisma.orders.count({ where: { shop } });

    return { orders, page, totalCount };
};

// --- Server Action (optional) ---
export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    const formData = await request.formData();
    const selectedIds = JSON.parse(formData.get("selectedIds") || "[]");

    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        return { status: "No orders selected" };
    }

    const ordersResult = await prisma.orders.findMany({
        where: {
            id: {
                in: selectedIds
            }
        },
        select: {
            order: true
        }
    })

    const orders = ordersResult.map(item => item.order);

    if (orders && orders.length > 0) {
        let result = await createOrder(orders, shop)
        logger.info(`Sync Order 1st Try ${JSON.stringify(result)}`)
        
        if(result?.results?.status !== "success" && result?.results.findIndex(e => e.status_code === 403) >= 0){
            await signin(shop)
            result = await createOrder(orders, shop)
            logger.info(`Sync Order 2nd Try ${JSON.stringify(result)}`)
        }

        let alreadyExistCount = 0
        let successCount = 0
        let failedCount = 0

        for (const item of result?.results) {
            switch(item?.status_code){
                case 200:
                    successCount++;
                    break;
                case 400:
                    alreadyExistCount++
                    break;
                default:
                    failedCount++
                    break;
            }
        }

        return { success: true, synced: selectedIds.length, message: `${successCount} Orders synched successfully, ${failedCount} Failed ${alreadyExistCount ? `& ${alreadyExistCount} already exist.` : "" }  ` };
    } else {
        return {
            success: false, message: "Orders not synched, please try again later."
        }
    }


};

// --- Client Component ---
export default function Order() {
    const fetcher = useFetcher();
    const { orders, page, totalCount } = useLoaderData();
    // useActionData is not needed when using a fetcher for the submission
    // const actionData = useActionData(); 
    const navigate = useNavigate();
    const location = useLocation();

    const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(orders);

    // --- State for the Banner ---
    const [bannerMessage, setBannerMessage] = useState(null);
    const [bannerStatus, setBannerStatus] = useState('info');


    const [loading, setLoading] = useState(false);
    const isSynching = fetcher.state === "submitting";
    const totalPages = Math.ceil(totalCount / 25);

    // --- Effect to watch for fetcher data ---
    useEffect(() => {
        // The data from the action is on fetcher.data
        if (fetcher.data && fetcher.data.message) {
            setBannerMessage(fetcher.data.message);
            setBannerStatus(fetcher.data.success ? 'success' : 'critical');
        }
    }, [fetcher.data]);


    const handlePageChange = (direction) => {
        setLoading(true);
        const newPage = direction === "next" ? page + 1 : page - 1;
        navigate(`?page=${newPage}`);
    };

    useEffect(() => {
        setLoading(false);
    }, [location.search]);


    const rowMarkup = loading
        ? /* ... skeleton code is fine ... */
        Array.from({ length: 10 }).map((_, index) => (
            <IndexTable.Row id={`skeleton-${index}`} key={index} position={index}>
                <IndexTable.Cell>
                    <SkeletonBodyText lines={1} />
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <SkeletonBodyText lines={1} />
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <SkeletonBodyText lines={1} />
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <SkeletonBodyText lines={1} />
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <SkeletonBodyText lines={1} />
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <SkeletonBodyText lines={1} />
                </IndexTable.Cell>
            </IndexTable.Row>
        ))
        : orders.map(({ id, order, createdAt, synched }, index) => (
            <IndexTable.Row id={id} key={id} position={index} selected={selectedResources.includes(id)}>
                <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="bold" as="span">
                        {index + 1 + (page - 1) * 25}
                    </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{id}</IndexTable.Cell>
                <IndexTable.Cell>
                    {order?.billing_address?.name ||
                        order?.shipping_address?.name ||
                        order?.customer?.name ||
                        "N/A"}
                </IndexTable.Cell>
                <IndexTable.Cell>{order?.total_price}</IndexTable.Cell>
                <IndexTable.Cell>{formatDate(createdAt)}</IndexTable.Cell>
                <IndexTable.Cell>{synched ? "Yes" : "No"}</IndexTable.Cell>
            </IndexTable.Row>
        ));

    const resourceName = {
        singular: "order",
        plural: "orders",
    };

    return (
        <Frame>
            <Page
                backAction={{ content: "Home", url: "/app" }}
                title="Webhook Orders"
                primaryAction={
                    <fetcher.Form method="post">
                        <input type="hidden" name="selectedIds" value={JSON.stringify(selectedResources)} />
                        <Button
                            variant="primary"
                            submit
                            loading={isSynching}
                            disabled={selectedResources.length === 0} // Good practice to disable if nothing is selected
                        >
                            Sync Orders
                        </Button>
                    </fetcher.Form>
                }
            >
                <BlockStack gap="400">
                    {/* --- Corrected Banner Implementation --- */}
                    {bannerMessage && (
                        <Banner
                            title="Sync Status"
                            status={bannerStatus}
                            onDismiss={() => setBannerMessage(null)} // This now works!
                        >
                            <p>{bannerMessage}</p>
                        </Banner>
                    )}

                    <Card>
                        <Bleed marginBlock="400" marginInline="400">
                            <IndexTable
                                // ... rest of your IndexTable props are fine ...
                                resourceName={resourceName}
                                itemCount={orders.length}
                                selectedItemsCount={
                                    allResourcesSelected ? 'All' : selectedResources.length
                                }
                                onSelectionChange={handleSelectionChange}
                                selectable={true}
                                headings={[
                                    { title: "S.No" },
                                    { title: "Order ID" },
                                    { title: "Customer" },
                                    { title: "Total" },
                                    { title: "Created At" },
                                    { title: "Synched?" },
                                ]}
                                pagination={{
                                    hasPrevious: page > 1,
                                    hasNext: page < totalPages,
                                    onPrevious: () => handlePageChange("prev"),
                                    onNext: () => handlePageChange("next"),
                                }}
                            >
                                {rowMarkup}
                            </IndexTable>
                        </Bleed>
                    </Card>

                </BlockStack>
            </Page>
        </Frame >
    );
}