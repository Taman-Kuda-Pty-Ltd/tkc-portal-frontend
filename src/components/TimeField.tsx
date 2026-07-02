import { Group, Input, Select, Text } from "@mantine/core";
import { useSettings } from "../settings/SettingsContext";
import { parseHM, toHM } from "../lib/time";

// Touch-friendly time picker: big tappable dropdowns for hour / minute
// (+ am/pm in 12h mode) instead of a fiddly native time spinner. The value it
// emits is always canonical 24h "HH:MM".

const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function opts(values: (string | number)[]) {
  return values.map((v) => ({ value: String(v), label: String(v) }));
}

export function TimeField({
  label,
  value,
  onChange,
  w,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  w?: number | string;
}) {
  const { timeFormat } = useSettings();
  const { hour, minute } = parseHM(value);
  // Ensure the current minute is selectable even if not a 5-min step.
  const minuteOptions = MINUTES.includes(String(minute).padStart(2, "0"))
    ? MINUTES
    : [...MINUTES, String(minute).padStart(2, "0")].sort();

  const is12 = timeFormat === "12h";
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  function setHour24(h24: number) {
    onChange(toHM(h24, minute));
  }

  const control = (
    <Group gap={4} wrap="nowrap" w={w}>
      <Select
        data={is12 ? opts([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) : opts([...Array(24).keys()].map((n) => String(n).padStart(2, "0")))}
        value={is12 ? String(hour12) : String(hour).padStart(2, "0")}
        onChange={(v) => {
          if (v === null) return;
          if (!is12) return setHour24(Number(v));
          const h12 = Number(v);
          const base = h12 % 12; // 12 -> 0
          setHour24(period === "PM" ? base + 12 : base);
        }}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        w={is12 ? 64 : 72}
        aria-label="Hour"
      />
      <Text span>:</Text>
      <Select
        data={opts(minuteOptions)}
        value={String(minute).padStart(2, "0")}
        onChange={(v) => v !== null && onChange(toHM(hour, Number(v)))}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        w={72}
        aria-label="Minute"
      />
      {is12 && (
        <Select
          data={opts(["AM", "PM"])}
          value={period}
          onChange={(v) => {
            if (v === null) return;
            const base = hour % 12;
            setHour24(v === "PM" ? base + 12 : base);
          }}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          w={72}
          aria-label="AM/PM"
        />
      )}
    </Group>
  );

  return label ? <Input.Wrapper label={label}>{control}</Input.Wrapper> : control;
}
