import { describe, expect, it, vi } from "vitest";
import { EventBus } from "./EventBus";

describe("EventBus", () => {
  it("delivers versioned payloads to subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("test.event", handler);
    bus.emit("test.event", { value: 42 }, 2);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({ eventName: "test.event", version: 2, payload: { value: 42 } });
  });

  it("supports unsubscribe and safe listener removal during dispatch", () => {
    const bus = new EventBus();
    const second = vi.fn();
    const first = vi.fn(() => { off(); });
    const off = bus.on("change", first);
    bus.on("change", second);
    bus.emit("change", null);
    bus.emit("change", null);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
  });
});
