const CORE_API_URL = Deno.env.get("CORE_API_URL") ?? "https://psyai-core.vercel.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SCHEDULE_SECRET = Deno.env.get("SCHEDULE_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }

  if (SCHEDULE_SECRET) {
    const authorization = req.headers.get("authorization");
    if (authorization !== `Bearer ${SCHEDULE_SECRET}`) {
      return json({ message: "Unauthorized" }, 401);
    }
  }

  if (!CRON_SECRET) {
    return json({ message: "CRON_SECRET not configured" }, 500);
  }

  const response = await fetch(`${CORE_API_URL}/v1/internal/run-transfers`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${CRON_SECRET}`,
    },
  });

  const text = await response.text();

  return json(
    {
      ok: response.ok,
      status: response.status,
      body: parseJson(text),
    },
    response.ok ? 200 : 502,
  );
});

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
