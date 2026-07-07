import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

/** Catches render errors so a screen shows a recoverable message instead of going
 *  blank white — essential on an unattended kiosk terminal. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface for diagnostics; the UI stays recoverable.
    console.error("Render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <Center h="100vh" p="xl">
          <Stack align="center" maw={480}>
            <Title order={3}>Something went wrong</Title>
            <Text ta="center" c="dimmed">
              {this.props.label ?? "This screen hit an error and couldn't finish loading."}{" "}
              Tap below to reload — your check-in isn't lost.
            </Text>
            <Text size="xs" c="dimmed" ta="center">{this.state.error.message}</Text>
            <Button size="lg" onClick={() => window.location.reload()}>Reload</Button>
          </Stack>
        </Center>
      );
    }
    return this.props.children;
  }
}
