import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './components/SessionProvider';
import SessionGate from './components/SessionGate';
import Routing from './routes/Routing';

export default function App() {
  return <BrowserRouter><SessionProvider><SessionGate><Routing /></SessionGate></SessionProvider></BrowserRouter>;
}
