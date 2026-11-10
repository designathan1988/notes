import { createRoot } from 'react-dom/client';
import App from './App.js';
import './styles.css';
import './nexo.css';
import './atelier.css';
import './signature.css';
import '@fontsource-variable/inter';
// The italic face: without it (and with font synthesis off) italic text renders upright.
import '@fontsource-variable/inter/wght-italic.css';
import './sinapta.css';
import './sinapta-system.css';
createRoot(document.getElementById('root')!).render(<App />);
