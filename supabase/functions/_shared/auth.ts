import * as jose from "jsr:@panva/jose@6";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const isDev = !supabaseUrl?.includes("https://");

const SUPABASE_JWT_ISSUER = isDev
  ? "http://127.0.0.1:54321/auth/v1"
  : Deno.env.get("SB_JWT_ISSUER") ?? supabaseUrl + "/auth/v1";

const SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
  new URL(supabaseUrl! + "/auth/v1/.well-known/jwks.json"),
);

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") {
    throw new Error(`Auth header is not 'Bearer {token}'`);
  }

  return token;
}

function verifySupabaseJWT(jwt: string) {
  return jose.jwtVerify(jwt, SUPABASE_JWT_KEYS, {
    issuer: SUPABASE_JWT_ISSUER,
  });
}

// Validates authorization header
export async function AuthMiddleware(
  req: Request,
  next: (req: Request) => Promise<Response>,
) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    const token = getAuthToken(req);
    const isValidJWT = await verifySupabaseJWT(token);

    if (isValidJWT) {
      const response = await next(req);
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...CORS_HEADERS },
      });
    }

    return Response.json({ msg: "Invalid JWT" }, {
      status: 401,
      headers: CORS_HEADERS,
    });
  } catch (e) {
    console.error("Auth error:", e);
    return Response.json({ msg: e?.toString() }, {
      status: 401,
      headers: CORS_HEADERS,
    });
  }
}
