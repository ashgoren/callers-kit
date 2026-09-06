import { AuthMiddleware } from '../_shared/auth.ts';

const BASE_URL = 'https://www.ibiblio.org/contradance/thecallersbox/dance.php';

function extractId(url: string): string | null {
  try {
    const id = new URL(url).searchParams.get('id');
    if (Number(id)) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve((req) =>
  AuthMiddleware(req, async (req) => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ msg: 'Invalid JSON body' }, { status: 400 });
    }
    const { url } = body;

    const id = typeof url === 'string' ? extractId(url) : null;
    if (!id) {
      return Response.json({ msg: 'Missing or invalid URL' }, { status: 400 });
    }

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}?id=${id}&format=JSON`, {
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        return Response.json({ msg: "The Caller's Box website timed out. Try again in a moment." }, { status: 504 });
      }
      return Response.json({ msg: `Failed to fetch from source: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 502 });
    }

    if (!response.ok) {
      return Response.json({ msg: `The source website returned an error (${response.status})` }, { status: 502 });
    }

    return response;
  })
);
