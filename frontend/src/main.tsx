import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/500-italic.css'
import './styles/global.css'
import App from './App'
import { InputProvider } from './lib/input'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <InputProvider>
        <App />
      </InputProvider>
    </BrowserRouter>
  </StrictMode>,
)
