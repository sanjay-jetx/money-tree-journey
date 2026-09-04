/**
 * auth.server.ts — Server-only auth utilities.
 * Uses jose (pure-JS JWT) and Web Crypto API for edge compatibility.
 * Never imported on the client side.
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mt_session";
/** 7 days in seconds */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  return (import.meta.env as any)?.[key];
}

/** Returns the HMAC key derived from APP_SESSION_SECRET env var. */
function getSigningKey(): Uint8Array {
  const secret =
    getEnv("APP_SESSION_SECRET") ??
    "moneytree-fallback-dev-secret-key";
  return new TextEncoder().encode(secret);
}

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
}

/** Creates a signed JWT session token valid for 7 days. */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user, role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSigningKey());
}

/** Returns validity and user data from the JWT token. */
export async function verifySessionToken(
  token: string,
): Promise<{ valid: boolean; user: SessionUser | null }> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey());
    if (payload && typeof payload === "object" && "userId" in payload) {
      return {
        valid: true,
        user: {
          userId: String(payload["userId"]),
          email: String(payload["email"] ?? ""),
          name: String(payload["name"] ?? "User"),
        },
      };
    }
    return { valid: true, user: { userId: "owner", email: "sanjaynathiya81@gmail.com", name: "Sanjay" } };
  } catch {
    return { valid: false, user: null };
  }
}

/** Checks submitted email + password against env-var-stored credentials. */
export function verifyCredentials(email: string, password: string): boolean {
  const allowedEmail =
    getEnv("APP_EMAIL") ??
    "sanjaynathiya81@gmail.com";
  const allowedPassword =
    getEnv("APP_PASSWORD") ??
    "&Anjay2512";

  // Case-insensitive email comparison, exact password match
  return (
    email.trim().toLowerCase() === allowedEmail.toLowerCase() &&
    password === allowedPassword
  );
}
