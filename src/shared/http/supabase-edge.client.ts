import { env } from "../../plugins/env.js";

export async function callEdgeFunction(
  functionName: string,
  body: unknown,
  userToken: string,
) {
  const url = `${env.SUPABASE_URL}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao chamar edge function: ${text}`);
  }

  return response.json();
}