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
import { InstrumentProvider } from './lib/instrument'
import { ToastProvider } from './components/Toast'
import { TourProvider } from './components/Tour'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <InstrumentProvider>
      <InputProvider>
        <ToastProvider>
          <TourProvider>
            <App />
          </TourProvider>
        </ToastProvider>
      </InputProvider>
      </InstrumentProvider>
    </BrowserRouter>
  </StrictMode>,
)
