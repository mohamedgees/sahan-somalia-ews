import { useEffect, useState } from 'react';
import Legend from './Legend';
import { ALL_MONTHS } from '../utils/constants';

const LiveClock = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    return (
        <div className="current-time">
            📅{' '}
            {currentTime.toLocaleDateString('en-US', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            })}{' '}
            | 🕒 {currentTime.toLocaleTimeString()}
        </div>
    );
};

const Sidebar = ({
    sidebarTab,
    setSidebarTab,
    activeBaseLayer,
    setActiveBaseLayer,
    activeOverlays,
    setActiveOverlays,
    forecastDays,
    setForecastDays,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
}) => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 2000 + 1 }, (_, i) => currentYear - i);
    const availableMonths =
        selectedYear === currentYear
            ? ALL_MONTHS.filter((m) => m.val <= new Date().getMonth() + 1)
            : ALL_MONTHS;

    return (
        <div className="sidebar" style={{ zIndex: 1001 }}>
            <div className="sidebar-header">
                <img
                    src="/logo.png"
                    alt="Sahan - AI Enabled Early Warning System for Somalia"
                    className="sidebar-logo"
                />
                <h2>AI Enabled Early Warning System for Somalia</h2>
                <p className="sidebar-subtitle">
                    Remote Climate and Environmental Monitoring platform
                </p>
            </div>
            <div className="digital-clock">
                <LiveClock />
            </div>

            <div className="sidebar-nav">
                <button
                    className={`nav-btn ${sidebarTab === 'monitor' ? 'active' : ''}`}
                    onClick={() => setSidebarTab('monitor')}
                >
                    📊 Monitor
                </button>
                <button
                    className={`nav-btn ${sidebarTab === 'forecast' ? 'active' : ''}`}
                    onClick={() => setSidebarTab('forecast')}
                >
                    🔮 Forecast
                </button>
            </div>

            <div className="sidebar-content">
                <div className="control-section">
                    <h3
                        style={{
                            fontSize: sidebarTab === 'monitor' ? '1.1rem' : '1.0rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {sidebarTab === 'monitor'
                            ? 'Environmental Indicators'
                            : 'Precipitation & Temperature Forecast'}
                    </h3>
                    {sidebarTab === 'monitor' && (
                        <div
                            className="radio-group"
                            style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                        >
                            <h4 className="subcategory-title" style={{ marginTop: 0 }}>
                                🌧️ Climate & Rainfall
                            </h4>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'rainfall'}
                                    onChange={() => setActiveBaseLayer('rainfall')}
                                />
                                <span>Rainfall (CHIRPS)</span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'spi'}
                                    onChange={() => setActiveBaseLayer('spi')}
                                />
                                <span title="Standardized Precipitation Index">
                                    SPI (Standardized Precipitation Index)
                                </span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'spei'}
                                    onChange={() => setActiveBaseLayer('spei')}
                                />
                                <span title="Drought Index – Climate">
                                    SPEI (Drought Index – Climate)
                                </span>
                            </label>

                            <h4 className="subcategory-title">🌿 Vegetation & Ecosystem Health</h4>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'ndvi'}
                                    onChange={() => setActiveBaseLayer('ndvi')}
                                />
                                <span>NDVI (Vegetation Index)</span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'vhi'}
                                    onChange={() => setActiveBaseLayer('vhi')}
                                />
                                <span title="Vegetation Health Index (VCI+TCI)">
                                    VHI (Vegetation Health Index)
                                </span>
                            </label>

                            <h4 className="subcategory-title">🌡️ Temperature & Heat Stress</h4>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'temp'}
                                    onChange={() => setActiveBaseLayer('temp')}
                                />
                                <span>LST (Land Surface Temperature)</span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'temp_anomaly'}
                                    onChange={() => setActiveBaseLayer('temp_anomaly')}
                                />
                                <span>Temperature Anomaly (°C)</span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'tci'}
                                    onChange={() => setActiveBaseLayer('tci')}
                                />
                                <span title="Temperature Condition Index">
                                    TCI (Temperature Condition Index)
                                </span>
                            </label>

                            <h4 className="subcategory-title">💧 Water & Soil Moisture</h4>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'smi'}
                                    onChange={() => setActiveBaseLayer('smi')}
                                />
                                <span>Soil Moisture Index</span>
                            </label>
                            <label
                                className="radio-label disabled"
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                            >
                                <input type="radio" disabled />
                                <span>NDWI (Future)</span>
                            </label>
                            <label
                                className="radio-label disabled"
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                            >
                                <input type="radio" disabled />
                                <span>Surface Water (Future)</span>
                            </label>

                            <h4 className="subcategory-title">
                                {' '}
                                🏜️ Land Degradation & Surface Condition
                            </h4>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'bsi'}
                                    onChange={() => setActiveBaseLayer('bsi')}
                                />
                                <span>BSI (Bare Soil Index)</span>
                            </label>

                            <h4 className="subcategory-title">🎯 Combined Risk</h4>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'cdi'}
                                    onChange={() => setActiveBaseLayer('cdi')}
                                />
                                <span title="Combined Drought Index — ICPAC-inspired seasonally-weighted composite of SPI, VHI, SMI and SPEI (see Legend for methodology note)">
                                    CDI (Combined Drought Index)
                                </span>
                            </label>
                        </div>
                    )}

                    {sidebarTab === 'forecast' && (
                        <div
                            className="radio-group"
                            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                        >
                            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                {[1, 3, 7, 14].map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => setForecastDays(d)}
                                        style={{
                                            flex: 1,
                                            padding: '5px',
                                            backgroundColor:
                                                forecastDays === d ? '#3498db' : '#ecf0f1',
                                            color: forecastDays === d ? 'white' : '#2c3e50',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        {d} Day{d > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'forecast_precip'}
                                    onChange={() => setActiveBaseLayer('forecast_precip')}
                                />
                                <span>Rainfall Forecast</span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    checked={activeBaseLayer === 'forecast_temp'}
                                    onChange={() => setActiveBaseLayer('forecast_temp')}
                                />
                                <span>Temperature Forecast</span>
                            </label>
                        </div>
                    )}
                </div>

                <div className="control-section">
                    <h3>Overlays</h3>
                    <div
                        className="checkbox-group"
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={activeOverlays.waterSources}
                                onChange={(e) =>
                                    setActiveOverlays({
                                        ...activeOverlays,
                                        waterSources: e.target.checked,
                                    })
                                }
                            />
                            <span>Water Sources</span>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={activeOverlays.customRegions}
                                onChange={(e) =>
                                    setActiveOverlays({
                                        ...activeOverlays,
                                        customRegions: e.target.checked,
                                    })
                                }
                            />
                            <span>Somalia Regions</span>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={activeOverlays.customDistricts}
                                onChange={(e) =>
                                    setActiveOverlays({
                                        ...activeOverlays,
                                        customDistricts: e.target.checked,
                                    })
                                }
                            />
                            <span>Somalia Districts</span>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={activeOverlays.customSettlements}
                                onChange={(e) =>
                                    setActiveOverlays({
                                        ...activeOverlays,
                                        customSettlements: e.target.checked,
                                    })
                                }
                            />
                            <span>Settlements</span>
                        </label>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={activeOverlays.flashFloodRisk}
                                onChange={(e) =>
                                    setActiveOverlays({
                                        ...activeOverlays,
                                        flashFloodRisk: e.target.checked,
                                    })
                                }
                            />
                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                                Flash Flood Risk
                            </span>
                        </label>
                    </div>
                </div>

                <div className="control-section">
                    {sidebarTab !== 'forecast' && (
                        <>
                            <h3>Timeline</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="styled-select-inline"
                                    style={{ flex: 1 }}
                                >
                                    {years.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="styled-select-inline"
                                    style={{ flex: 1 }}
                                >
                                    {availableMonths.map((m) => (
                                        <option key={m.val} value={m.val}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>

                <div className="control-section" id="legend-section">
                    <h3>Legend</h3>
                    <Legend activeLayer={activeBaseLayer} activeOverlays={activeOverlays} />
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
