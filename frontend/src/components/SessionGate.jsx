import Brand from './Brand';
import { ErrorMessage, Loading } from './Feedback';
import { useSession } from './SessionProvider';

export default function SessionGate({ children }) {
  const { status, error, retry } = useSession();
  if (status === 'ready') return children;
  return <main className="session-gate"><Brand />
    {status === 'loading' ? <Loading>Recuperando tu sesión…</Loading> : <ErrorMessage onRetry={retry}>{error}</ErrorMessage>}
  </main>;
}
