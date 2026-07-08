import { Center, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { HorsesPage } from "./pages/HorsesPage";
import { PayRatesPage } from "./pages/PayRatesPage";
import { PayrollPage } from "./pages/PayrollPage";
import { PeoplePage } from "./pages/PeoplePage";
import { AddPersonPage } from "./pages/AddPersonPage";
import { PersonDetailPage } from "./pages/PersonDetailPage";
import { MyProfilePage } from "./pages/MyProfilePage";
import { SchedulePage } from "./pages/SchedulePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShiftTemplateEditorPage } from "./pages/ShiftTemplateEditorPage";
import { ShiftTemplatesPage } from "./pages/ShiftTemplatesPage";
import { TerminalApp } from "./terminal/TerminalApp";

function AuthedApp() {
  useEffect(() => {
    const welcome = sessionStorage.getItem("tkc_welcome");
    if (welcome) {
      sessionStorage.removeItem("tkc_welcome");
      notifications.show({
        color: "teal",
        title: "Welcome to Taman Kuda Club",
        message: `Welcome, ${welcome}! Your account is all set up.`,
        autoClose: 6000,
      });
    }
  }, []);

  return (
    <AppLayout>
      <Routes>
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/payroll/rates" element={<PayRatesPage />} />
        <Route path="/templates" element={<ShiftTemplatesPage />} />
        <Route path="/templates/new" element={<ShiftTemplateEditorPage />} />
        <Route path="/templates/:id" element={<ShiftTemplateEditorPage />} />
        <Route path="/me" element={<MyProfilePage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/people/new" element={<AddPersonPage />} />
        <Route path="/people/:id" element={<PersonDetailPage />} />
        <Route path="/horses" element={<HorsesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Routes>
      {/* Public: onboarding completion from an invite link */}
      <Route path="/onboard/:token" element={<OnboardingPage />} />
      {/* Public: kiosk terminal (device-token authenticated) */}
      <Route path="/terminal" element={<TerminalApp />} />
      {me ? (
        <Route path="/*" element={<AuthedApp />} />
      ) : (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
}
