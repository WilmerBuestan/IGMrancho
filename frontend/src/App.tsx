import { Navigate, Route, Routes } from 'react-router-dom';
import Welcome from './pages/Welcome';
import { Privacy, Terms } from './pages/Legal';
import UserLayout from './pages/user/UserLayout';
import ReservePage from './pages/user/ReservePage';
import LookupPage from './pages/user/LookupPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import ReservationsAdmin from './pages/admin/ReservationsAdmin';
import Reports from './pages/admin/Reports';
import PricesAdmin from './pages/admin/PricesAdmin';
import ScheduleAdmin from './pages/admin/ScheduleAdmin';
import AccountAdmin from './pages/admin/AccountAdmin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/privacidad" element={<Privacy />} />
      <Route path="/terminos" element={<Terms />} />
      <Route element={<UserLayout />}>
        <Route path="/reservar" element={<ReservePage />} />
        <Route path="/mis-reservas" element={<LookupPage />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="reservas" element={<ReservationsAdmin />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="precios" element={<PricesAdmin />} />
        <Route path="horarios" element={<ScheduleAdmin />} />
        <Route path="cuenta" element={<AccountAdmin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
