import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Link,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useLoaderData, useNavigate } from "@remix-run/react";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session
  const user = await prisma.user.findFirst({
    where: { shop }
  })

  return { user };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {

  let { user } = useLoaderData()
  const navigate = useNavigate();


  return (
    <Page>
      <TitleBar title="Fulfillzy-Delivery-Sync">
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome to Fulfillzy's Delivery Sync App 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This app is for enabling synchronization of orders when they are purchased with our fulfillzy dashboard as well as updating the fulfillment status from the same. {" "}
                    Go to{" "}
                    <Link
                      url="/app/settings"
                      removeUnderline
                    >
                      Settings
                    </Link>{" "}
                    to add your Fulfillzy credentails & get started.
                  </Text>
                </BlockStack>

              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Fulfillzy Connection Status:
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {user?.authorized ? "Connected" : "Disconnected"}
                  </Text>
                  <Button variant="primary" onClick={() =>  navigate('/app/settings')}>{user?.username ? "Reauthorize" : "Authorize"}</Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

        </Layout>
      </BlockStack>
    </Page>
  );
}
