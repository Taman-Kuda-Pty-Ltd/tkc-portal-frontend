import { Input } from "@mantine/core";
import PhoneInput, { getCountries, getCountryCallingCode } from "react-phone-number-input";
import en from "react-phone-number-input/locale/en.json";
import "react-phone-number-input/style.css";
import "./phone-field.css";

export { isValidPhoneNumber } from "react-phone-number-input";

// Country labels showing the calling code, e.g. "Australia (+61)".
const enLabels = en as Record<string, string>;
const LABELS: Record<string, string> = { ...enLabels };
for (const c of getCountries()) {
  LABELS[c] = `${enLabels[c]} (+${getCountryCallingCode(c)})`;
}

/** E.164 phone input with a country flag selector (default Australia). */
export function PhoneField({
  label,
  value,
  onChange,
  required,
  error,
  disabled,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <Input.Wrapper label={label} required={required} error={error}>
      <PhoneInput
        className="tkc-phone"
        international
        defaultCountry="AU"
        labels={LABELS}
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        disabled={disabled}
      />
    </Input.Wrapper>
  );
}
