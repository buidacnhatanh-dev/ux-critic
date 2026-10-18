import { NotFoundError, ValidationError } from "./client";
import { LiveClient } from "./live-client";

type Call = { url: string; init: RequestInit };

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, client: new LiveClient(fetcher) };
}

describe("LiveClient", () => {
  it("reads a review from the polled route", async () => {
    const { calls, client } = fakeFetch(200, { id: "r1", status: "running" });
    await expect(client.getReview("r1")).resolves.toMatchObject({ id: "r1" });
    expect(calls[0]!.url).toBe("/api/reviews/r1");
    expect(calls[0]!.init.cache).toBe("no-store");
  });

  it("turns 404 into NotFoundError and 400 with a field into ValidationError", async () => {
    await expect(fakeFetch(404, { message: "x" }).client.getProject("p")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const error = await fakeFetch(400, { field: "version", message: '"v1" already exists' })
      .client.getChecklist()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).field).toBe("version");
  });

  it("uses the server message for other errors", async () => {
    await expect(fakeFetch(500, { message: "Disk full" }).client.listProjects()).rejects.toThrow(
      "Disk full",
    );
  });

  it("uploads the screenshot and fields as multipart", async () => {
    const { calls, client } = fakeFetch(201, { reviewId: "r9" });
    const file = new File([new Uint8Array([1, 2, 3])], "fake-empty.png", { type: "image/png" });
    await client.startReview({
      mode: "live",
      projectId: null,
      newProjectName: "NeighborGoods",
      versionName: "v1",
      context: "Checkout",
      scale: 2,
      file,
      sources: { nielsen: true, wcag: true, laws: false, mine: true },
    });
    const form = calls[0]!.init.body as FormData;
    expect(calls[0]!.url).toBe("/api/reviews");
    expect((form.get("file") as File).name).toBe("fake-empty.png");
    expect(form.get("newProjectName")).toBe("NeighborGoods");
    expect(form.get("projectId")).toBeNull();
    expect(form.get("scale")).toBe("2");
    expect(JSON.parse(form.get("sources") as string)).toMatchObject({ laws: false });
  });

  it("maps checklist updates to the rule routes", async () => {
    const { calls, client } = fakeFetch(200, { ok: true });
    await client.saveChecklist({ type: "moveRule", ruleId: "a", direction: "up" });
    await client.saveChecklist({ type: "deleteRule", ruleId: "b" });
    await client.saveChecklist({
      type: "sources",
      sources: { nielsen: false, wcag: true, laws: true, mine: true },
    });
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "PUT /api/rules/a",
      "DELETE /api/rules/b",
      "PUT /api/settings/sources",
    ]);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ move: "up" });
  });

  it("removes a push back with DELETE and saves one with PUT", async () => {
    const { calls, client } = fakeFetch(200, { ok: true });
    await client.setPushback("i1", "It is a decorative link");
    await client.setPushback("i1", null);
    expect(calls.map((c) => c.init.method)).toEqual(["PUT", "DELETE"]);
  });
});
