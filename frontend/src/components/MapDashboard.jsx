import { useEffect, useState, useCallback } from 'react';

import '../App.css';
import Sidebar from './Sidebar';
import MapView from './MapView';
import RightPanel from './RightPanel';
import { useLayerData } from '../hooks/useLayerData';
import { useMapStats } from '../hooks/useMapStats';
import { useAiInsights } from '../hooks/useAiInsights';

const NorthArrow = () => (
    <div className="north-arrow">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <polygon
                points="50,10 20,80 50,65 80,80"
                fill="#e74c3c"
                stroke="#c0392b"
                strokeWidth="2"
            />
            <text x="50" y="95" fontSize="24" textAnchor="middle" fill="#2c3e50" fontWeight="bold">
                N
            </text>
        </svg>
    </div>
);

const MapDashboard = () => {
    const [sidebarTab, setSidebarTab] = useState('monitor');

    const [activeBaseLayer, setActiveBaseLayer] = useState('ndvi');
    const [activeOverlays, setActiveOverlays] = useState({
        waterSources: false,
        customRegions: true,
        customDistricts: false,
        customSettlements: false,
        flashFloodRisk: false,
    });

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [forecastDays, setForecastDays] = useState(7);

    const [toast, setToast] = useState(null);
    const showToast = useCallback(
        (message, tone = 'error') => setToast({ message, tone }),
        []
    );

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    const [waterSourceInsights, setWaterSourceInsights] = useState(null);

    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { layerUrl } = useLayerData(
        activeBaseLayer,
        selectedYear,
        selectedMonth,
        forecastDays,
        showToast
    );

    const {
        stats,
        setStats,
        loadingStats,
        setLoadingStats,
        downloadCSV,
        downloadJSON,
        copyToClipboard,
    } = useMapStats(showToast);

    const {
        aiInsights,
        loadingAi,
        aiError,
        insightScopeLevel,
        setInsightScopeLevel,
        insightScopeName,
        setInsightScopeName,
        fetchAiInsights,
    } = useAiInsights(activeBaseLayer, selectedMonth, selectedYear);

    return (
        <div className={`dashboard-container ${isRightPanelOpen ? 'has-right-panel' : ''}`}>
            <button
                className="sidebar-toggle-btn"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open menu"
                type="button"
            >
                ☰
            </button>

            {isSidebarOpen && (
                <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
            )}

            <Sidebar
                sidebarTab={sidebarTab}
                setSidebarTab={setSidebarTab}
                activeBaseLayer={activeBaseLayer}
                setActiveBaseLayer={setActiveBaseLayer}
                activeOverlays={activeOverlays}
                setActiveOverlays={setActiveOverlays}
                forecastDays={forecastDays}
                setForecastDays={setForecastDays}
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <MapView
                activeBaseLayer={activeBaseLayer}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
                forecastDays={forecastDays}
                activeOverlays={activeOverlays}
                layerUrl={layerUrl}
                setStats={setStats}
                setLoadingStats={setLoadingStats}
                onStatsError={showToast}
                stats={stats}
                loadingStats={loadingStats}
                waterSourceInsights={waterSourceInsights}
                setWaterSourceInsights={setWaterSourceInsights}
                downloadCSV={downloadCSV}
                downloadJSON={downloadJSON}
                copyToClipboard={copyToClipboard}
            />

            <NorthArrow />

            {toast && (
                <div
                    onClick={() => setToast(null)}
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 3000,
                        padding: '10px 18px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: toast.tone === 'success' ? '#155724' : '#991b1b',
                        background: toast.tone === 'success' ? '#d4edda' : '#fef2f2',
                        border: `1px solid ${toast.tone === 'success' ? '#c3e6cb' : '#fecaca'}`,
                    }}
                >
                    {toast.message}
                </div>
            )}

            <RightPanel
                isRightPanelOpen={isRightPanelOpen}
                setIsRightPanelOpen={setIsRightPanelOpen}
                sidebarTab={sidebarTab}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                insightScopeLevel={insightScopeLevel}
                setInsightScopeLevel={setInsightScopeLevel}
                insightScopeName={insightScopeName}
                setInsightScopeName={setInsightScopeName}
                fetchAiInsights={fetchAiInsights}
                loadingAi={loadingAi}
                aiError={aiError}
                aiInsights={aiInsights}
            />
        </div>
    );
};

export default MapDashboard;
