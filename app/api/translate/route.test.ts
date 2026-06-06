import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const translateSegmentsMock = vi.fn();

vi.mock("../../../lib/openai/translate", () => ({
  translateSegments: (...args: unknown[]) => translateSegmentsMock(...args)
}));

describe("POST /api/translate", () => {
  afterEach(() => {
    translateSegmentsMock.mockReset();
  });

  it("returns translated subtitle segments keyed by id", async () => {
    translateSegmentsMock.mockResolvedValue({
      items: [
        {
          id: "seg-1",
          chinese: "今天我们会看看小型语言模型。"
        }
      ]
    });

    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              id: "seg-1",
              text: "Today we will look at small language models."
            }
          ]
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "seg-1",
          chinese: "今天我们会看看小型语言模型。"
        }
      ]
    });
  });

  it("rejects invalid translation payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/translate", {
        method: "POST",
        body: JSON.stringify({
          items: [
            { id: "seg-1", text: "One" },
            { id: "seg-2", text: "Two" },
            { id: "seg-3", text: "Three" }
          ]
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid translation request"
    });
  });
});
