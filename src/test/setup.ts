import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// jsdom scrollTo uygulamıyor
window.scrollTo = () => {}
