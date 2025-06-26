module.exports = {
  apps: [
    {
      name: "shopify_app",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        SHOPIFY_API_KEY: "226c3bf4890262dd060d0c5d98407695",
        SHOPIFY_API_SECRET_KEY: "5518aab0eec15aaff3555df0f6f955c1",
        SHOPIFY_APP_URL: "https://shopify.pearl-developer.com",
        SCOPES: "read_all_orders,read_orders,write_orders,write_products,read_assigned_fulfillment_orders,read_merchant_managed_fulfillment_orders,read_third_party_fulfillment_orders,write_assigned_fulfillment_orders,write_merchant_managed_fulfillment_orders,write_fulfillments",
        PORT: "6969",
        DATABASE_URL: "file:dev.sqlite",
        SESSION_SECRET: "supersecretkeyforproduction1234567890",
        LOG_LEVEL: "info"
      }
    }
  ]
}