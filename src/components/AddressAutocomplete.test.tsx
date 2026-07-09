import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { AddressAutocomplete } from "./AddressAutocomplete";

// Isolate the HTTP layer so no real fetch happens.
vi.mock("../api/client", () => ({ api: { get: vi.fn() } }));
const mockGet = vi.mocked(api.get);

const HINT = "Address lookup unavailable — enter manually.";

// A tiny wrapper so the field's typed value round-trips through parent state,
// exactly as the real forms use it.
function Harness() {
  const [value, setValue] = useState("");
  return <AddressAutocomplete value={value} onChange={setValue} onSelect={() => {}} />;
}

function renderHarness() {
  // retryDelay 0 so the component's single retry resolves immediately in tests.
  const qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MantineProvider>
        <Harness />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe("AddressAutocomplete graceful fallback", () => {
  it("degrades to a plain input when a live lookup fails, preserving typed text", async () => {
    // Service is configured, but the /search call rejects (server down/timeout).
    mockGet.mockImplementation((path: string) =>
      path.startsWith("/addresses/status")
        ? Promise.resolve({ configured: true } as never)
        : Promise.reject(new Error("network down")),
    );

    const { container } = renderHarness();
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12 main" } });

    // The failed lookup flips the field to manual entry with an inline hint...
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy(), { timeout: 5000 });
    // ...and whatever the user already typed is kept.
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("12 main");
  });

  it("degrades when the status probe itself fails, and stays usable for manual typing", async () => {
    mockGet.mockRejectedValue(new Error("status down"));

    renderHarness();
    await waitFor(() => expect(screen.getByText(HINT)).toBeTruthy(), { timeout: 5000 });

    const input = screen.getByLabelText("Address line 1");
    fireEvent.change(input, { target: { value: "manual entry" } });
    await waitFor(() =>
      expect((screen.getByLabelText("Address line 1") as HTMLInputElement).value).toBe("manual entry"),
    );
  });
});
