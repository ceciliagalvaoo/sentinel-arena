/**
 * Parses an already-fully-downloaded SSE-formatted response body into its
 * `data:` JSON payloads.
 *
 * Surprising discovery (2026-07-12): `GET /api/scores/historical/{fixtureId}`
 * responds with `Content-Type: text/event-stream` and SSE-framed body
 * (`data: {...}\nid: N\n\n` per record) even though it's a single batch GET,
 * not a live stream — every other snapshot/updates endpoint returns plain
 * `application/json`. Not documented in the OpenAPI reference (section
 * 5.19); found by inspecting the raw response.
 */
export function parseSseBodyToJson<T = unknown>(body: string): T[] {
  const results: T[] = [];
  const blocks = body.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    let dataLines = "";
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("data:")) {
        dataLines += line.slice(5).replace(/^ /, "") + "\n";
      }
    }
    const data = dataLines.replace(/\n$/, "");
    if (!data) continue;
    try {
      results.push(JSON.parse(data) as T);
    } catch {
      // ignore malformed/partial trailing block
    }
  }

  return results;
}
