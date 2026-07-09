import { Autocomplete, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

// A single upstream suggestion, as normalized by the backend proxy.
export interface AddressSuggestion {
  id: string | null;
  display: string | null;
  locality: string | null;
  state: string | null;
  postcode: string | null;
  lat: number | null;
  lon: number | null;
}

// The structured address fields we fill on select. `line1` is the street
// portion of the display (everything before the first comma); suburb comes from
// the upstream locality.
export interface AddressParts {
  line1: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface Props {
  /** Current "Address line 1" text. */
  value: string;
  /** Fired as the user types (mirrors a plain TextInput). */
  onChange: (line1: string) => void;
  /** Fired when a suggestion is picked — parent applies the structured parts. */
  onSelect: (parts: AddressParts) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

// Split "12 MAIN ST, SYDNEY NSW 2000" into its street portion for line 1.
function streetPart(display: string): string {
  const comma = display.indexOf(",");
  return (comma === -1 ? display : display.slice(0, comma)).trim();
}

// Hard cap on a single /addresses/search call. A dead/slow lookup server must
// never hang the field — abort well before the user notices and fall back.
const SEARCH_TIMEOUT_MS = 4000;

/**
 * Address line 1 with G-NAF autocomplete. Debounces typing (~300ms), calls the
 * app's /addresses/search proxy, and on select fills the structured address
 * parts via `onSelect`. Autocomplete is a pure enhancement — the field is always
 * usable for manual typing and degrades to a plain text input when:
 *   - the service is not configured, or the status probe fails; or
 *   - a live lookup fails at query time (network error, timeout, non-2xx).
 * On a runtime failure it stops hitting the (likely dead) server for the rest of
 * the session, keeps whatever the user has typed, and shows a small inline hint.
 */
export function AddressAutocomplete({ value, onChange, onSelect, label = "Address line 1", placeholder, disabled }: Props) {
  // Once a live lookup fails we stay in manual mode for the session, rather than
  // hammering a dead server on every keystroke.
  const [degraded, setDegraded] = useState(false);

  const status = useQuery({
    queryKey: ["address-status"],
    queryFn: () => api.get<{ configured: boolean }>("/addresses/status"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const configured = !!status.data?.configured;

  const [debounced] = useDebouncedValue(value, 300);
  // display string -> full suggestion, so a picked option maps back to its parts.
  const byDisplay = useRef<Map<string, AddressSuggestion>>(new Map());

  const search = useQuery({
    queryKey: ["address-search", debounced],
    queryFn: async () => {
      // Impose our own timeout on top of whatever react-query does — a hung
      // socket should abort at SEARCH_TIMEOUT_MS and surface as an error.
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), SEARCH_TIMEOUT_MS);
      try {
        return await api.get<AddressSuggestion[]>(
          `/addresses/search?q=${encodeURIComponent(debounced.trim())}`,
          { signal: ac.signal },
        );
      } finally {
        clearTimeout(timer);
      }
    },
    enabled: configured && !degraded && debounced.trim().length >= 2,
    staleTime: 60 * 1000,
    retry: 1, // one retry, then we degrade — don't keep retrying a dead server
  });

  // Any failure (status probe or a live lookup) → switch to manual entry for good.
  useEffect(() => {
    if (status.isError || search.isError) setDegraded(true);
  }, [status.isError, search.isError]);

  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    const map = new Map<string, AddressSuggestion>();
    const labels: string[] = [];
    for (const s of search.data ?? []) {
      const disp = (s.display ?? "").trim();
      if (disp && !map.has(disp)) {
        map.set(disp, s);
        labels.push(disp);
      }
    }
    byDisplay.current = map;
    setOptions(labels);
  }, [search.data]);

  // Disabled, not configured, status probe failed, or a lookup failed at query
  // time -> plain text input. Manual entry always works.
  if (disabled || degraded || (status.isSuccess && !configured)) {
    return (
      <TextInput
        label={label}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        description={degraded ? "Address lookup unavailable — enter manually." : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
      />
    );
  }

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder ?? "Start typing an address…"}
      value={value}
      data={options}
      // Match on our own suggestions; never hide options client-side.
      filter={({ options }) => options}
      onChange={(val) => {
        onChange(val);
        const picked = byDisplay.current.get(val);
        if (picked) {
          onSelect({
            line1: streetPart(picked.display ?? val),
            suburb: picked.locality ?? "",
            state: picked.state ?? "",
            postcode: picked.postcode ?? "",
          });
        }
      }}
    />
  );
}
