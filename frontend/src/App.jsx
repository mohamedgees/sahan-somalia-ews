import React from 'react';
import MapDashboard from './components/MapDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
    return (
        <ErrorBoundary>
            <div
                className="app-container"
                style={{ padding: 0, height: '100vh', width: '100vw', position: 'relative' }}
            >
                <MapDashboard />
            </div>
        </ErrorBoundary>
    );
}

export default App;
