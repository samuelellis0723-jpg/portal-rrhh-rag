import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../components/SessionProvider';

export default function PrivateRoutes({ roles }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(session.colaborador.rol)) return <Navigate to="/mi-espacio" replace />;
  return <Outlet />;
}
