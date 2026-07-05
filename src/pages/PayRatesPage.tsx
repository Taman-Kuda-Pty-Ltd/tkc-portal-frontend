import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PayGradesSection } from "../components/PayGradesSection";

export function PayRatesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  return (
    <Stack maw={900} w="100%" mx="auto">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/payroll")}>
          Payroll
        </Button>
      </Group>
      <Title order={2}>Pay grades & rates</Title>
      {can("manage_settings") ? (
        <PayGradesSection />
      ) : (
        <Text c="dimmed">You don't have access to pay rates.</Text>
      )}
    </Stack>
  );
}
