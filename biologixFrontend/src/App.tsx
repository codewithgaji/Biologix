import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AuthGuard from "./components/AuthGuard";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Employees from "./pages/dashboard/Employees";
import Departments from "./pages/dashboard/Departments";
import Attendance from "./pages/dashboard/Attendance";
import ImportData from "./pages/dashboard/ImportData";
import Export from "./pages/dashboard/Export";
import Holidays from "./pages/dashboard/Holidays";
import Leaves from "./pages/dashboard/Leaves";
import Analytics from "./pages/dashboard/Analytics";
import ArchivePage from "./pages/dashboard/Archive";
import ArchiveDetailPage from "./pages/dashboard/ArchiveDetail";
import PendingApproval from "./pages/PendingApproval";
import UsersPage from "./pages/dashboard/Users";
import AuditPage from "./pages/dashboard/Audit";
import DbAdmin from "./pages/dashboard/DbAdmin";
import About from "./pages/dashboard/About";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/dashboard" element={<AuthGuard><DashboardLayout /></AuthGuard>}>
            <Route index element={<Overview />} />
            <Route path="about" element={<About />} />
            <Route path="employees" element={<Employees />} />
            <Route path="departments" element={<Departments />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="archive" element={<ArchivePage />} />
            <Route path="archive/:id" element={<ArchiveDetailPage />} />
            <Route path="users" element={<UsersPage />} /> 
            <Route path="audit" element={<AuditPage />} />
            <Route path="db-admin" element={<DbAdmin />} />
            <Route path="import" element={<ImportData />} />
            <Route path="export" element={<Export />} />
            <Route path="holidays" element={<Holidays />} />
            <Route path="leaves" element={<Leaves />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;