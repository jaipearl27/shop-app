import {
  useLoaderData,
  useNavigation,
  useActionData,
  Form,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Card,
  FormLayout,
  Icon,
  Layout,
  Page,
  Text,
  TextField,
  Frame,
  BlockStack,
  InlineError,
  Banner,
  Link,
} from "@shopify/polaris";
import { ViewIcon, HideIcon } from "@shopify/polaris-icons";
import prisma from "../db.server";
import { signin } from "../services/API";


export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;
  const user = await prisma.user.findFirst({
    where: { shop },
  });

  return { user };
};

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const username = formData.get("userName");
  const password = formData.get("password");


  if (!username || !password) {
    return (
      { success: false, message: "Username and password are required." }
    );
  }


  const { result, user } = await signin(shop, username, password)


  if (!result?.data?.token) {
    return { success: false, message: result?.message ? result.message : "Invalid credentails." }
  }

  return { success: true, message: "Credentials Authenticated successfully!", user };
}

export default function AppSettingsPage() {
  const { user } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [userName, setUserName] = useState(user?.username || "");
  const [password, setPassword] = useState(user?.password || "");
  const [passwordVisible, setPasswordVisible] = useState(false);

  // const [stateUpdated, setStateUpdated] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [showToast, setShowToast] = useState(false);

  const isSaving = navigation.state === "submitting";

  useEffect(() => {
    // setStateUpdated(false);
    // console.log(actionData, 'action data')
    if (!actionData?.success) {
      setErrorMessage(actionData?.message);
    } else {
      setErrorMessage("");
    }
    if (actionData?.success && actionData?.message) {
      setShowToast(true);
    } else {
      setShowToast(false);
    }

    if (actionData?.user) {
      setUserName(actionData.user.username)
      setPassword(actionData.user.password)
    }

  }, [actionData]);

  const handleUserNameChange = useCallback((value) => {
    // if (!stateUpdated) setStateUpdated(!stateUpdated)
    setUserName(value)
  }, []);
  const handlePasswordChange = useCallback((value) => {
    // if (!stateUpdated) setStateUpdated(!stateUpdated)
    setPassword(value)
  }, []);
  const togglePasswordVisibility = useCallback(
    () => setPasswordVisible((visible) => !visible),
    []
  );

  const passwordPeekButton = (
    <Button
      onClick={togglePasswordVisibility}
      plain
      accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
    >
      <Icon source={passwordVisible ? HideIcon : ViewIcon} />
    </Button>
  );

  const toastMarkup = showToast ? (
    <Layout.Section>
      <Banner
        title={actionData ? actionData?.message : "Processing request.."}
        tone="success"
        onDismiss={() => { setShowToast(false) }}
      >
        Redirecting you to Fulfillzy Dashboard or Click <Link url="https://uat.fulfillzy.com/" target="_blank">here</Link>{" "} to visit the same.
      </Banner>
    </Layout.Section>


  ) : null;

  return (
    <Frame>
      <Page backAction={{ content: 'Home', url: '/app' }} title="Settings">
        <ui-title-bar title="Settings" />
        <Layout>
          <Layout.Section>
            <Card>
              <Form method="post">
                <FormLayout>
                  <BlockStack gap="500">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h2">
                        Dashboard Authentication:
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Enter you Fulfillzy credentials, they will be saved for your store only when they are sucessfully authenticated.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                  <TextField
                    name="userName"
                    label="User Name"
                    value={userName}
                    onChange={handleUserNameChange}
                    autoComplete="username"
                  />
                  <TextField
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    label="Password"
                    value={password}
                    onChange={handlePasswordChange}
                    autoComplete="new-password"
                    connectedRight={passwordPeekButton}
                  />

                  {errorMessage?.length > 0 && <InlineError message={errorMessage} />}

                  <Button
                    variant="primary"
                    size="large"
                    submit
                    loading={isSaving}
                  // disabled={!stateUpdated}
                  >
                    {user?.password ? "Update Details" : "Save Details"}
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
          {toastMarkup}
        </Layout>
      </Page>
    </Frame>
  );
}