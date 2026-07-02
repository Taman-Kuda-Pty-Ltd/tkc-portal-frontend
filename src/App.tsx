import { Center, Loader } from "@mantine/core";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ActivitiesPage } from "./pages/ActivitiesPage";
import { LensesPage } from "./pages/LensesPage";
import { LoginPage } from "./pages/LoginPage";
import { PeoplePage } from "./pages/PeoplePage";
import { RolesPage } from "./pages/RolesPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ShiftTemplatesPage } from "./pages/ShiftTemplatesPage";

export default function App() {
  const { me, loading } = useAuth();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!me) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/templates" element={<ShiftTemplatesPage />} />
        <Route path="/activities" element={<ActivitiesPage />} />
        <Route path="/lenses" element={<LensesPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="*" element={<Navigate to="/schedule" replace />} />
      </Routes>
    </AppLayout>
  );
}
