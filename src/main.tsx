import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Barlow Semi Condensed (numbers and titles), bundled so it works offline; latin only
import '@fontsource/barlow-semi-condensed/latin-600.css'
import '@fontsource/barlow-semi-condensed/latin-700.css'
import '@fontsource/barlow-semi-condensed/latin-800.css'
import './theme.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
