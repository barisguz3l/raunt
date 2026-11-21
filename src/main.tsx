import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { registerServiceWorker } from './app/registerSW'
import { requestPersistentStorage } from './core/persistence/db'
import { settingsStore } from './core/settings/settings'
import { loadUserCombos } from './features/combos/userCombos'
import { comboMemory } from './core/records/comboMemoryStore'
import './design/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerServiceWorker()
void requestPersistentStorage()
void settingsStore.load()
void loadUserCombos()
void comboMemory.load()
