import {
  Anchor,
  Badge,
  Card,
  Collapse,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";

// --- Types (mirror app/api/routers/me_pay.py) ---
interface MyPayShift {
  shift_id: number | null;
  title: string | null;
  starts_at: string | null;
  capacity_role_name: string;
  hours: number;
  rate: number | null;
  amount: number | null;
  projected: boolean;
  pending: boolean;
}
interface MyPayEngagement {
  engagement_id: number;
  engagement_type: string;
  work_role_name: string | null;
  employment_basis: string | null;
  position_title: string | null;
  grade_name: string | null;
  hourly_rate: number | null;
  saturday_rate: number | null;
  sunday_rate: number | null;
  public_holiday_rate: number | null;
  rate_from: string | null;
}
interface MyPayRun {
  period_start: string;
  period_end: string;
  hours: number;
  gross: number;
  super_amount: number;
  net: number;
  shifts: MyPayShift[];
}
interface MyPayTax {
  tfn_masked: string | null;
  tfn_not_provided: boolean;
}
interface MyPaySuper {
  super_percent: number;
  fund_type: string | null;
  fund_name: string | null;
  fund_usi: string | null;
}
interface MyPay {
  financial_year_label: string;
  fy_start: string;
  ytd_gross: number;
  ytd_super: number;
  ytd_hours: number;
  engagements: MyPayEngagement[];
  pay_history: MyPayRun[];
  tax: MyPayTax | null;
  superannuation: MyPaySuper | null;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const basisLabel = (b: string | null) => (b ? b.replace("_", "-") : "");

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text fw={700} fz={28} mt={4}>{value}</Text>
      {sub && <Text size="xs" c="dimmed">{sub}</Text>}
    </Paper>
  );
}

export function MyPayPage() {
  const q = useQuery({
    queryKey: ["my-pay"],
    queryFn: () => api.get<MyPay>("/me/pay"),
    retry: (count, err) => !(err instanceof ApiError && err.status === 403) && count < 2,
  });

  // Contractors / non-employees are gated server-side (403) — show a friendly note.
  if (q.error instanceof ApiError && q.error.status === 403) {
    return (
      <Stack maw={720} w="100%" mx="auto">
        <Title order={2}>My pay</Title>
        <Card withBorder>
          <Stack gap="xs">
            <Text fw={600}>Not available for your engagement</Text>
            <Text size="sm" c="dimmed">
              My Pay is for employees. If you work as a contractor, your rates and
              details live on your profile.
            </Text>
            <Anchor component={Link} to="/me" size="sm">Go to my profile →</Anchor>
          </Stack>
        </Card>
      </Stack>
    );
  }

  if (q.isLoading || !q.data) return <Loader />;
  const d = q.data;

  return (
    <Stack maw={860} w="100%" mx="auto">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>My pay</Title>
        <Anchor component={Link} to="/me" size="sm">My profile →</Anchor>
      </Group>

      {/* YTD tiles */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Tile label="Gross this FY" value={money(d.ytd_gross)} sub={`FY ${d.financial_year_label}`} />
        <Tile label="Super this FY" value={money(d.ytd_super)} sub={`FY ${d.financial_year_label}`} />
        <Tile label="Hours this FY" value={`${d.ytd_hours.toFixed(2)}h`} sub={`FY ${d.financial_year_label}`} />
      </SimpleGrid>

      {/* Current engagements & rates */}
      <Card withBorder>
        <Title order={4} mb="sm">Current engagements & rates</Title>
        {d.engagements.length === 0 ? (
          <Text size="sm" c="dimmed">No active employee engagements.</Text>
        ) : (
          <Stack gap="sm">
            {d.engagements.map((e) => (
              <Paper key={e.engagement_id} withBorder p="sm" radius="sm">
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>{e.work_role_name ?? "—"}</Text>
                      <Badge variant="light" color="teal">Employee</Badge>
                      {e.employment_basis && (
                        <Badge variant="light" color="gray">{basisLabel(e.employment_basis)}</Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {e.grade_name ?? "No grade assigned"}
                      {e.position_title ? ` · ${e.position_title}` : ""}
                    </Text>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Text fw={700} fz="lg">
                      {e.hourly_rate != null ? `${money(e.hourly_rate)}/h` : "No rate set"}
                    </Text>
                    {e.hourly_rate != null && (
                      <Text size="xs" c="dimmed">
                        Sat {e.saturday_rate != null ? money(e.saturday_rate) : "—"} ·
                        {" "}Sun {e.sunday_rate != null ? money(e.sunday_rate) : "—"} ·
                        {" "}PH {e.public_holiday_rate != null ? money(e.public_holiday_rate) : "—"}
                      </Text>
                    )}
                    {e.rate_from && (
                      <Text size="xs" c="dimmed">effective {dayjs(e.rate_from).format("D MMM YYYY")}</Text>
                    )}
                  </div>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Card>

      {/* Pay history */}
      <Card withBorder>
        <Title order={4} mb="sm">Pay history</Title>
        {d.pay_history.length === 0 ? (
          <Text size="sm" c="dimmed">No finalised pay runs yet.</Text>
        ) : (
          <Stack gap="xs">
            {d.pay_history.map((r) => (
              <PayRunRow key={r.period_start} run={r} />
            ))}
          </Stack>
        )}
      </Card>

      {/* Tax & super — read only */}
      <Card withBorder>
        <Title order={4} mb={4}>Tax & super</Title>
        <Text size="xs" c="dimmed" mb="sm">
          Read-only. Speak to a manager to change any of these details.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <div>
            <Text size="xs" c="dimmed">Tax file number</Text>
            <Text>
              {d.tax?.tfn_masked
                ? d.tax.tfn_masked
                : d.tax?.tfn_not_provided
                  ? "Not provided"
                  : "—"}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Super guarantee rate</Text>
            <Text>{d.superannuation ? `${d.superannuation.super_percent}%` : "—"}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Super fund</Text>
            <Text>{d.superannuation?.fund_name || "—"}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Fund USI</Text>
            <Text>{d.superannuation?.fund_usi || "—"}</Text>
          </div>
        </SimpleGrid>
      </Card>
    </Stack>
  );
}

function PayRunRow({ run }: { run: MyPayRun }) {
  const [open, setOpen] = useState(false);
  return (
    <Paper withBorder p="sm" radius="sm">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={600}>
            {dayjs(run.period_start).format("D MMM")} – {dayjs(run.period_end).subtract(1, "day").format("D MMM YYYY")}
          </Text>
          <Text size="sm" c="dimmed">{run.hours.toFixed(2)}h</Text>
        </div>
        <div style={{ textAlign: "right" }}>
          <Text fw={700} fz="lg">{money(run.gross)}</Text>
          <Text size="xs" c="dimmed">
            Total (before tax) · +{money(run.super_amount)} super
          </Text>
        </div>
      </Group>
      {run.shifts.length > 0 && (
        <>
          <Anchor component="button" type="button" size="xs" mt={4}
            onClick={() => setOpen((s) => !s)}>
            {open ? "Hide" : "Show"} {run.shifts.length} shift{run.shifts.length === 1 ? "" : "s"}
          </Anchor>
          <Collapse in={open}>
            <Table withRowBorders={false} verticalSpacing={2} fz="xs" mt={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>Work type</Table.Th>
                  <Table.Th ta="right">Hours</Table.Th>
                  <Table.Th ta="right">Rate</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {run.shifts.map((s, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{s.starts_at ? dayjs(s.starts_at).format("D MMM HH:mm") : "—"}</Table.Td>
                    <Table.Td>{s.title || s.capacity_role_name}</Table.Td>
                    <Table.Td>{s.capacity_role_name}</Table.Td>
                    <Table.Td ta="right">{s.hours}h</Table.Td>
                    <Table.Td ta="right">{s.rate != null ? money(s.rate) : "—"}</Table.Td>
                    <Table.Td ta="right">{s.amount != null ? money(s.amount) : "no rate"}</Table.Td>
                    <Table.Td>
                      {s.projected
                        ? <Badge size="xs" color="grape" variant="light">Projected</Badge>
                        : <Badge size="xs" color="teal" variant="light">Confirmed</Badge>}
                      {s.pending && <Badge size="xs" color="yellow" variant="light" ml={4}>pending</Badge>}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
