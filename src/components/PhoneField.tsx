import { Input } from "@mantine/core";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import "./phone-field.css";

export { isValidPhoneNumber } from "react-phone-number-input";

/** E.164 phone input with a country flag selector (default Australia). */
export function PhoneField({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
}) {
  return (
    <Input.Wrapper label={label} required={required} error={error}>
      <PhoneInput
        className="tkc-phone"
        international
        defaultCountry="AU"
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
      />
    </Input.Wrapper>
  );
}
