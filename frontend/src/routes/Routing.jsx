import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/Login';
import MiEspacio from '../pages/MiEspacio';
import Chat from '../pages/Chat';
import Reportes from '../pages/Reportes';
import ColaboradorFicha from '../pages/ColaboradorFicha';
import PrivateRoutes from './PrivateRoutes';

export default function Routing() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<PrivateRoutes />}><Route path="/mi-espacio" element={<MiEspacio />} /><Route path="/chat" element={<Chat />} /></Route>
    <Route element={<PrivateRoutes roles={['rrhh']} />}>
      <Route path="/rrhh/reportes" element={<Reportes />} />
      <Route path="/rrhh/colaboradores/:id" element={<ColaboradorFicha />} />
    </Route>
    <Route path="*" element={<Navigate to="/mi-espacio" replace />} />
  </Routes>;
}
