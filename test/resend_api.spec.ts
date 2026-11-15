import { afterEach, describe, expect, it, vi } from "vitest";
import { sendResendBatch } from "../src/providers/resend_api";

const rendered = { subject: "News", html: "Hello", text: "Hello" };
const recipients = [
  { email: "one@example.com", unsubscribeUrl: "https://example.com/u/one" },
  { email: "two@example.com", unsubscribeUrl: "https://example.com/u/two" },
];

afterEach(() => vi.restoreAllMocks());

describe("Resend batch submission", () => {
  it("sends isolated messages and maps provider IDs to recipients", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ data: [{ id: "id-one" }, { id: "id-two" }] }));
    const result = await sendResendBatch(
      "re_secret",
      "news@example.com",
      rendered,
      recipients,
      "batch-1",
    );
    expect(result).toEqual({
      kind: "answered",
      results: [
        { email: "one@example.com", accepted: true, providerId: "id-one" },
        { email: "two@example.com", accepted: true, providerId: "id-two" },
      ],
    });
    const request = fetchMock.mock.calls[0]?.[1];
    const messages = JSON.parse(String(request?.body));
    expect(messages[0].to).toEqual(["one@example.com"]);
    expect(messages[1].to).toEqual(["two@example.com"]);
    expect(messages[0].headers["List-Unsubscribe"]).toBe("<https://example.com/u/one>");
    expect(messages[1].headers["List-Unsubscribe"]).toBe("<https://example.com/u/two>");
  });

  it("halts on a definite rate limit without exposing provider response text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ name: "rate_limit_exceeded", message: "re_secret" }, { status: 429 }),
    );
    const result = await sendResendBatch("re_secret", "news@example.com", rendered, recipients);
    expect(result).toMatchObject({ kind: "halted", halt: { cause: "rate_limit" } });
    expect(JSON.stringify(result)).not.toContain("re_secret");
  });

  it("treats lost, failed and incomplete answers as unknown", async () => {
    const mock = vi.spyOn(globalThis, "fetch");
    for (const response of [
      new Response(null, { status: 500 }),
      Response.json({ data: [{ id: "one" }] }),
    ]) {
      mock.mockResolvedValueOnce(response);
      await expect(
        sendResendBatch("re_secret", "news@example.com", rendered, recipients),
      ).rejects.toThrow();
    }
    mock.mockRejectedValueOnce(new Error("network failure"));
    await expect(
      sendResendBatch("re_secret", "news@example.com", rendered, recipients),
    ).rejects.toThrow();
  });
});
