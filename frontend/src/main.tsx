import React, {Suspense, lazy} from 'react'
import {createRoot} from 'react-dom/client'
import './styles/index.css'
import App from './App'

// Hidden visual-QA route — no router dependency, just a hash check. Lazy-loaded
// so the QA page (and its icons) are code-split out of the shipped app bundle.
const KitchenSink = lazy(() => import('./KitchenSink'))
const isKitchenSink = window.location.hash === '#/kitchen-sink'

const container = document.getElementById('root')
const root = createRoot(container!)

root.render(
    <React.StrictMode>
        {isKitchenSink ? <Suspense fallback={null}><KitchenSink/></Suspense> : <App/>}
    </React.StrictMode>
)
