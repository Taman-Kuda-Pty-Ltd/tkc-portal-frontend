import { DateInput } from "@mantine/dates";
import type { DateInputProps } from "@mantine/dates";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useSettings } from "../settings/SettingsContext";

dayjs.extend(customParseFormat);

/**
 * A typed date input that both displays AND parses using the user's chosen date
 * format (Settings → Preferences), so "02/07/2026" is unambiguous.
 */
export function DateField(props: DateInputProps) {
  const { dateFormat } = useSettings();
  return (
    <DateInput
      valueFormat={dateFormat}
      placeholder={dateFormat.toLowerCase()}
      dateParser={(input) => {
        const d = dayjs(input, dateFormat, false);
        return d.isValid() ? d.toDate() : null;
      }}
      {...props}
    />
  );
}
