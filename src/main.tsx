import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testFirestoreConnection } from './lib/firebase';
import { AuthProvider } from './context/AuthContext';

// Verify connection to Enterprise Firestore at application boot
testFirestoreConnection();

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
