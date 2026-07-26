import { useEffect, useState } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';

const TrendChart = ({ stats }) => {
    if (!stats || !stats.data || stats.data.length === 0)
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#64748b',
                    fontSize: '0.9rem',
                }}
            >
                No trend data available for this location.
            </div>
        );

    const type = stats.type || 'ndvi';
    const isTemp = type === 'temp' || type === 'temperature' || type === 'forecast_temp';
    const isRain = type === 'rainfall' || type === 'forecast_precip';

    // Select primary color based on metric
    const color =
        type === 'ndvi'
            ? '#4ade80'
            : type === 'smi'
              ? '#fb923c'
              : type === 'spei' || type === 'spi'
                ? '#2166ac'
                : type === 'vhi' || type === 'tci'
                  ? '#10b981'
                  : type === 'temp_anomaly'
                    ? '#f59e0b'
                    : type === 'bsi'
                      ? '#8b4513'
                      : isTemp
                        ? '#f87171'
                        : '#60a5fa';

    if (isRain) {
        return (
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                    />
                    <RechartsTooltip
                        contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            fontSize: '0.8rem',
                        }}
                    />
                    <Bar
                        dataKey="value"
                        fill="#5C97ED"
                        name="Rainfall (mm)"
                        radius={[4, 4, 0, 0]}
                        animationDuration={1000}
                    />
                </BarChart>
            </ResponsiveContainer>
        );
    }

    if (type === 'cdi') {
        return (
            <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                    />
                    <RechartsTooltip
                        contentStyle={{
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="cdi"
                        stroke="#ef4444"
                        name="CDI"
                        strokeWidth={3}
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="spi"
                        stroke="#3b82f6"
                        name="SPI"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="5 5"
                    />
                    <Line
                        type="monotone"
                        dataKey="smdi"
                        stroke="#10b981"
                        name="SMDI"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="5 5"
                    />
                </LineChart>
            </ResponsiveContainer>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={250}>
            <LineChart data={stats.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                />
                <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                />
                <RechartsTooltip
                    contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        fontSize: '0.8rem',
                    }}
                />
                {isTemp ? (
                    <>
                        <Line
                            type="monotone"
                            dataKey="avg"
                            stroke="#f87171"
                            name="Average"
                            strokeWidth={3}
                            dot={false}
                            animationDuration={1000}
                        />
                        <Line
                            type="monotone"
                            dataKey="max"
                            stroke="#ef4444"
                            name="Max"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="min"
                            stroke="#60a5fa"
                            name="Min"
                            strokeWidth={1}
                            strokeDasharray="5 5"
                            dot={false}
                        />
                    </>
                ) : (
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={4}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        name={stats.label}
                        animationDuration={1000}
                    />
                )}
            </LineChart>
        </ResponsiveContainer>
    );
};

const LoadingMessage = ({ type }) => {
    const messages = [
        `Connecting to orbital constellations... Harvesting ${type} signatures.`,
        `Extracting multispectral data for ${type}... Analyzing spectral indices.`,
        `Processing petabytes of planetary telemetry... Calibrating ${type} indicators.`,
        `Analyzing spatial distributions and temporal trends for ${type}...`,
        `Synthesizing real-time observations into actionable ${type} intelligence.`,
        `Decoding planetary vitals... Calculating standard anomalies for ${type}.`,
        `Querying Google Earth Engine... Reducing regions to ${type} time series.`,
    ];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % messages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <div className="loading-stats-container">
            <div className="satellite-loader">
                <div className="orbit"></div>
                <div className="planet"></div>
            </div>
            <div className="loading-message-text">{messages[index]}</div>
        </div>
    );
};

const BottomStatsPanel = ({
    stats,
    setStats,
    loadingStats,
    forecastDays,
    downloadCSV,
    downloadJSON,
    copyToClipboard,
    waterSourceInsights,
    setWaterSourceInsights,
}) => {
    return (
        <>
            {waterSourceInsights && (
                <div className="bottom-insights-panel water-source-insights">
                    <button className="close-panel-btn" onClick={() => setWaterSourceInsights(null)}>
                        ×
                    </button>
                    <div
                        className="stats-content"
                        style={{ display: 'flex', gap: '30px', height: '100%' }}
                    >
                        <div style={{ flex: 1.5, minWidth: 0, overflowY: 'auto' }}>
                            <h4
                                style={{
                                    color: '#004a99',
                                    borderBottom: '2px solid #eee',
                                    paddingBottom: '8px',
                                }}
                            >
                                {waterSourceInsights.name} - Technical Profile
                            </h4>
                            <div
                                className="borehole-details-grid"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '15px',
                                    marginTop: '10px',
                                }}
                            >
                                <div className="detail-item">
                                    <strong>Type:</strong> {waterSourceInsights.type}
                                </div>
                                <div className="detail-item">
                                    <strong>Status:</strong>
                                    <span
                                        style={{
                                            color:
                                                waterSourceInsights.functioning === 'yes'
                                                    ? '#2ecc71'
                                                    : '#e74c3c',
                                            fontWeight: 'bold',
                                            marginLeft: '5px',
                                        }}
                                    >
                                        {(waterSourceInsights.functioning || 'unknown').toUpperCase()}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <strong>Yield:</strong> {waterSourceInsights.yield} m³/hr
                                </div>
                                <div className="detail-item">
                                    <strong>Depth:</strong> {waterSourceInsights.depth} m
                                </div>
                                <div className="detail-item">
                                    <strong>Static Level:</strong> {waterSourceInsights.static_level}{' '}
                                    m
                                </div>
                                <div className="detail-item">
                                    <strong>Temperature:</strong> {waterSourceInsights.temperature}{' '}
                                    °C
                                </div>
                                <div className="detail-item">
                                    <strong>Water Quality (EC):</strong> {waterSourceInsights.ec}{' '}
                                    µS/cm
                                </div>
                                <div className="detail-item">
                                    <strong>Water Quality (pH):</strong> {waterSourceInsights.pH}
                                </div>
                                <div className="detail-item">
                                    <strong>Total Dissolved Solids:</strong>{' '}
                                    {waterSourceInsights.tds}
                                </div>
                                <div className="detail-item">
                                    <strong>Water Cost:</strong> {waterSourceInsights.cost} (local
                                    unit)
                                </div>
                                <div className="detail-item">
                                    <strong>Region/District:</strong> {waterSourceInsights.region} /{' '}
                                    {waterSourceInsights.district}
                                </div>
                                <div className="detail-item">
                                    <strong>Agency:</strong> {waterSourceInsights.agency}
                                </div>
                            </div>
                        </div>

                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                background: '#f8fafc',
                                borderRadius: '12px',
                                padding: '15px',
                            }}
                        >
                            <h4 style={{ marginBottom: '15px', textAlign: 'center' }}>
                                Comparison of Key Metrics
                            </h4>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart
                                    data={[
                                        {
                                            name: 'Yield x100',
                                            val: (waterSourceInsights.yield || 0) / 100,
                                        },
                                        { name: 'Depth', val: waterSourceInsights.depth || 0 },
                                        {
                                            name: 'Static Lvl',
                                            val: waterSourceInsights.static_level || 0,
                                        },
                                        {
                                            name: 'EC / 10',
                                            val: (waterSourceInsights.ec || 0) / 10,
                                        },
                                        {
                                            name: 'Temp',
                                            val: waterSourceInsights.temperature || 0,
                                        },
                                    ]}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                                    <Bar dataKey="val" fill="#3498db" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            <p
                                style={{
                                    fontSize: '0.65rem',
                                    color: '#64748b',
                                    textAlign: 'center',
                                    marginTop: '8px',
                                }}
                            >
                                Values scaled for visual comparison. Yield is m³/hr (divided by 100).
                                EC is µS/cm (divided by 10).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {(stats || loadingStats) && (
                <div className="bottom-insights-panel">
                    <button className="close-panel-btn" onClick={() => setStats(null)}>
                        ×
                    </button>
                    {loadingStats ? (
                        <LoadingMessage type={stats?.type || 'Satellite'} />
                    ) : (
                        <div className="stats-content">
                            <div className="chart-section">
                                <div className="panel-header">
                                    <h4>{stats.label} Trends</h4>
                                    <div className="action-group">
                                        <button
                                            className="icon-btn"
                                            onClick={copyToClipboard}
                                            title="Copy to Clipboard"
                                        >
                                            📋
                                        </button>
                                        <button className="download-btn csv" onClick={downloadCSV}>
                                            CSV
                                        </button>
                                        <button className="download-btn json" onClick={downloadJSON}>
                                            JSON
                                        </button>
                                    </div>
                                </div>
                                <div className="chart-container-inner" style={{ minHeight: '250px' }}>
                                    <TrendChart
                                        stats={{
                                            ...stats,
                                            data: stats.type.startsWith('forecast')
                                                ? stats.data.slice(0, forecastDays)
                                                : stats.data,
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="table-section">
                                <div className="panel-header">
                                    <h4>Tabular Data</h4>
                                </div>
                                <div className="stats-table-container">
                                    <table className="stats-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                {stats.data &&
                                                    stats.data.length > 0 &&
                                                    Object.keys(stats.data[0])
                                                        .filter((k) => k !== 'date')
                                                        .map((k) => <th key={k}>{k}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(stats.type.startsWith('forecast')
                                                ? stats.data.slice(0, forecastDays)
                                                : stats.data
                                            )
                                                .slice()
                                                .reverse()
                                                .map((d, i) => (
                                                    <tr key={i}>
                                                        <td>{d.date}</td>
                                                        {Object.keys(d)
                                                            .filter((k) => k !== 'date')
                                                            .map((k) => (
                                                                <td key={k}>
                                                                    {typeof d[k] === 'number'
                                                                        ? d[k].toFixed(2)
                                                                        : d[k]}
                                                                </td>
                                                            ))}
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default BottomStatsPanel;
