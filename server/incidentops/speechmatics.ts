export async function createSpeechmaticsRealtimeToken() {
  const apiKey = process.env.SPEECHMATICS_API_KEY;
  if (!apiKey) throw new Error("SPEECHMATICS_API_KEY is not configured");
  const response = await fetch("https://mp.speechmatics.com/v1/api_keys?type=rt", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: 60 }),
  });
  const body = (await response.json()) as { key_value?: string; error?: string };
  if (!response.ok || !body.key_value) throw new Error(body.error ?? `Speechmatics token request failed with ${response.status}`);
  return { token: body.key_value, websocketUrl: "wss://global.rt.speechmatics.com/v2" };
}
