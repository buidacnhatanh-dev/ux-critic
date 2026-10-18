import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { DataClient } from "./client";
import { DataClientProvider, createDataClient, useDataClient } from "./DataClientProvider";
import { DemoClient } from "./demo-client";
import { LiveClient } from "./live-client";

describe("mode switch", () => {
  it("creates the client for the mode", () => {
    expect(createDataClient("demo")).toBeInstanceOf(DemoClient);
    expect(createDataClient("live")).toBeInstanceOf(LiveClient);
  });

  it("useDataClient returns the client from the provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DataClientProvider mode="demo">{children}</DataClientProvider>
    );
    const { result } = renderHook(() => useDataClient(), { wrapper });
    expect(result.current.mode).toBe("demo");
    expect(result.current.resetDemo).toBeTypeOf("function");
  });

  it("useDataClient throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useDataClient())).toThrow(/DataClientProvider/);
  });
});

describe("LiveClient", () => {
  it("has no resetDemo or sample picker", () => {
    const client: DataClient = new LiveClient();
    expect(client.resetDemo).toBeUndefined();
    expect(client.listSamples).toBeUndefined();
  });
});
