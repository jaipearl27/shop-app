import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production", // Send only over HTTPS in production
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

export async function getSession(request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}

export async function commitSession(session) {
  return sessionStorage.commitSession(session);
}

// Helper to get the token from the session
export async function getAuthToken(request) {
  const session = await getSession(request);
  const token = session.get("accessToken");
  return token || null;
}

// Helper to store the token
export async function setAuthToken(
  request,
  token,
  redirectTo
) {
  const session = await getSession(request);
  session.set("accessToken", token);
  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));

  if (redirectTo) {
    // This is useful in an action after login
    const { redirect } = await import("@remix-run/node");
    throw redirect(redirectTo, { headers });
  }
  return headers; // Return headers if not redirecting immediately
}

export async function destroyAuthSession(request, redirectTo = "/") {
  const session = await getSession(request);
  const { redirect } = await import("@remix-run/node");
  throw redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}