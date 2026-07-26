import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';

import customRegionsData from '../data/maps/sm-admin-all.json';
import customDistrictsData from '../data/maps/Districts.json';
import { ALL_MONTHS } from '../utils/constants';

const forecastMessages = [
    '📡 Simulating NOAA-NCEP Forecast Models...',
    '☁️ Analyzing High-Resolution GFS Atmospheric Data...',
    '🌡️ Projecting Thermal Anomalies & Heat Stress Paths...',
    '🌦️ Calculating cumulative 16-day rainfall probabilities...',
    '🛰️ Querying orbital telemetry for localized centroids...',
    '🏗️ Structuring Predictive Intelligence Grid...',
    '📊 Finalizing decision-ready forecast metrics...',
];
const monitorMessages = [
    '🧠 Analyzing Multi-Spectral Vegetation Health...',
    '🛰️ Harvesting Satellite CDI Signatures...',
    '📈 Calculating 12-Month Precipitation Deviations...',
    '📋 Synthesizing Historical Climatology Baseline...',
    '🔬 Decoding Soil Moisture Anomalies...',
    '🌍 Processing regional environmental vitals...',
    '🤖 Aligning DeepSeek Analyst intelligence...',
];

const allRegions = customRegionsData
    ? Array.from(
          new Set(customRegionsData.features.map((f) => f.properties.ADM1_NAME).filter(Boolean))
      ).sort()
    : [];
const allDistricts = customDistrictsData
    ? Array.from(
          new Set(
              customDistrictsData.features
                  .map((f) => f.properties.DIST_NAME || f.properties.DIST_2_NAM)
                  .filter(Boolean)
          )
      ).sort()
    : [];

const RightPanel = ({
    isRightPanelOpen,
    setIsRightPanelOpen,
    sidebarTab,
    selectedMonth,
    selectedYear,
    insightScopeLevel,
    setInsightScopeLevel,
    insightScopeName,
    setInsightScopeName,
    fetchAiInsights,
    loadingAi,
    aiError,
    aiInsights,
}) => {
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

    useEffect(() => {
        let interval;
        if (loadingAi) {
            interval = setInterval(() => {
                setLoadingMessageIndex((prev) => prev + 1);
            }, 3000);
        } else {
            setLoadingMessageIndex(0);
        }
        return () => clearInterval(interval);
    }, [loadingAi]);

    const panelTitle =
        sidebarTab === 'forecast'
            ? `Rainfall and Temperature Forecast Insights for ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`
            : `Environmental Insights for ${ALL_MONTHS.find((m) => m.val === selectedMonth)?.label} ${selectedYear}`;

    if (!isRightPanelOpen) {
        return (
            <div className="right-panel-minimized" onClick={() => setIsRightPanelOpen(true)}>
                <span className="vertical-text">{panelTitle}</span>
            </div>
        );
    }

    return (
        <div className="right-panel anim-slide-in">
            <div className="panel-header">
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                    }}
                >
                    <h3>{panelTitle}</h3>
                    <button className="close-panel" onClick={() => setIsRightPanelOpen(false)}>
                        ×
                    </button>
                </div>
            </div>

            <div
                className="panel-content"
                style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}
            >
                {/* Scope Selector */}
                <div
                    style={{
                        background: '#f1f5f9',
                        padding: '15px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                            Select Scope
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select
                                className="styled-select-inline"
                                style={{ flex: 1 }}
                                value={insightScopeLevel}
                                onChange={(e) => {
                                    setInsightScopeLevel(e.target.value);
                                    if (e.target.value === 'national') setInsightScopeName('Somalia');
                                    else if (e.target.value === 'region' && allRegions.length > 0)
                                        setInsightScopeName(allRegions[0]);
                                    else if (e.target.value === 'district' && allDistricts.length > 0)
                                        setInsightScopeName(allDistricts[0]);
                                }}
                            >
                                <option value="national">National Analysis</option>
                                <option value="region">Region Analysis</option>
                                <option value="district">District Analysis</option>
                            </select>

                            {insightScopeLevel === 'region' && (
                                <select
                                    className="styled-select-inline"
                                    style={{ flex: 1 }}
                                    value={insightScopeName}
                                    onChange={(e) => setInsightScopeName(e.target.value)}
                                >
                                    {allRegions.map((r) => (
                                        <option key={r} value={r}>
                                            {r}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {insightScopeLevel === 'district' && (
                                <select
                                    className="styled-select-inline"
                                    style={{ flex: 1 }}
                                    value={insightScopeName}
                                    onChange={(e) => setInsightScopeName(e.target.value)}
                                >
                                    {allDistricts.map((d) => (
                                        <option key={d} value={d}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <button
                            onClick={fetchAiInsights}
                            className="export-btn"
                            style={{
                                width: '100%',
                                marginTop: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                            }}
                            disabled={loadingAi}
                        >
                            {loadingAi ? '⌛ Analyzing...' : '✨ Generate Insights'}
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '5px',
                    }}
                >
                    <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1d4ed8' }}>
                        Results
                    </h4>
                </div>

                {loadingAi && (
                    <div
                        className="ai-loading-container"
                        style={{
                            textAlign: 'center',
                            padding: '30px 10px',
                            background: 'rgba(255,255,255,0.7)',
                            borderRadius: '12px',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                        }}
                    >
                        <div
                            className="spinner"
                            style={{
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #3498db',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto 15px',
                            }}
                        ></div>
                        <h4 style={{ color: '#2c3e50', margin: 0, fontSize: '1.05rem' }}>
                            {sidebarTab === 'forecast'
                                ? forecastMessages[loadingMessageIndex % forecastMessages.length]
                                : monitorMessages[loadingMessageIndex % monitorMessages.length]}
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#7f8c8d', margin: '5px 0 0 0' }}>
                            {sidebarTab === 'forecast'
                                ? 'Retrieving high-resolution NOAA-NCEP GFS atmospheric data, calculating 16-day rainfall probability parameters, and projecting extreme temperature anomalies for your decision-ready insight grid.'
                                : 'Synthesizing global satellite telemetry into structured environmental intelligence for early warning decision support.'}
                        </p>
                    </div>
                )}

                {aiError && !loadingAi && (
                    <div
                        className="ai-error-container"
                        style={{
                            textAlign: 'center',
                            padding: '20px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '12px',
                        }}
                    >
                        <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
                        <h4 style={{ color: '#991b1b', margin: 0, fontSize: '1rem' }}>
                            AI Processing Error
                        </h4>
                        <p
                            style={{
                                fontSize: '0.85rem',
                                color: '#b91c1c',
                                margin: '8px 0 0 0',
                                lineHeight: '1.4',
                            }}
                        >
                            {aiError}
                        </p>
                    </div>
                )}

                {aiInsights && !loadingAi && (
                    <div
                        className="ai-insights-card"
                        style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}
                    >
                        {aiInsights.isForecast ? (
                            <>
                                <div
                                    style={{
                                        background: '#f8fafc',
                                        padding: '15px',
                                        borderRadius: '10px',
                                        borderLeft: '4px solid #3b82f6',
                                    }}
                                >
                                    <h5
                                        style={{
                                            margin: '0 0 5px 0',
                                            color: '#1e293b',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        Forecast Summary
                                    </h5>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: '0.95rem',
                                            color: '#334155',
                                            lineHeight: '1.5',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {aiInsights.summary}
                                    </p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <div
                                        style={{
                                            background: '#fff',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                color: '#64748b',
                                                textTransform: 'uppercase',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            Drought Risk
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem',
                                                color: aiInsights.risk_levels?.drought
                                                    ?.toLowerCase()
                                                    .includes('high')
                                                    ? '#e11d48'
                                                    : '#2563eb',
                                            }}
                                        >
                                            {aiInsights.risk_levels?.drought}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: '#fff',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                color: '#64748b',
                                                textTransform: 'uppercase',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            Flood Risk
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem',
                                                color: aiInsights.risk_levels?.flood
                                                    ?.toLowerCase()
                                                    .includes('high')
                                                    ? '#e11d48'
                                                    : '#2563eb',
                                            }}
                                        >
                                            {aiInsights.risk_levels?.flood}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: '#fff',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                color: '#64748b',
                                                textTransform: 'uppercase',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            Heat Stress
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem',
                                                color: aiInsights.risk_levels?.heat_stress
                                                    ?.toLowerCase()
                                                    .includes('high')
                                                    ? '#e11d48'
                                                    : '#d97706',
                                            }}
                                        >
                                            {aiInsights.risk_levels?.heat_stress}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            background: '#fff',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                color: '#64748b',
                                                textTransform: 'uppercase',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            Water Availability
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 'bold',
                                                fontSize: '0.9rem',
                                                color: aiInsights.risk_levels?.water_availability
                                                    ?.toLowerCase()
                                                    .includes('critical')
                                                    ? '#e11d48'
                                                    : '#059669',
                                            }}
                                        >
                                            {aiInsights.risk_levels?.water_availability}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        background: '#fff',
                                        padding: '15px',
                                        borderRadius: '10px',
                                        border: '1px solid #e2e8f0',
                                    }}
                                >
                                    <h5
                                        style={{
                                            margin: '0 0 10px 0',
                                            color: '#1e293b',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        Key Insights
                                    </h5>
                                    <ul
                                        style={{
                                            margin: '0',
                                            paddingLeft: '20px',
                                            color: '#334155',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.6',
                                        }}
                                    >
                                        {aiInsights.key_insights &&
                                            aiInsights.key_insights.map((k, idx) => (
                                                <li key={idx} style={{ marginBottom: '6px' }}>
                                                    {k}
                                                </li>
                                            ))}
                                    </ul>
                                </div>

                                {aiInsights.early_warnings && aiInsights.early_warnings.length > 0 && (
                                    <div
                                        style={{
                                            background: '#fef2f2',
                                            padding: '15px',
                                            borderRadius: '10px',
                                            border: '1px solid #fecaca',
                                        }}
                                    >
                                        <h5
                                            style={{
                                                margin: '0 0 5px 0',
                                                color: '#991b1b',
                                                fontSize: '0.85rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                            }}
                                        >
                                            ⚠️ Early Warnings
                                        </h5>
                                        <ul
                                            style={{
                                                margin: 0,
                                                paddingLeft: '20px',
                                                color: '#991b1b',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {aiInsights.early_warnings.map((w, idx) => (
                                                <li key={idx}>{w}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        background: '#fff',
                                        padding: '12px 15px',
                                        borderRadius: '10px',
                                        border: '1px solid #e2e8f0',
                                    }}
                                >
                                    <h5
                                        style={{
                                            margin: 0,
                                            color: '#1e293b',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        Risk Level:
                                    </h5>
                                    <span
                                        style={{
                                            fontWeight: 800,
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            background:
                                                aiInsights.risk_level?.toLowerCase().includes('severe') ||
                                                aiInsights.risk_level?.toLowerCase().includes('critical')
                                                    ? '#fee2e2'
                                                    : aiInsights.risk_level?.toLowerCase().includes('high')
                                                      ? '#ffedd5'
                                                      : '#dcfce3',
                                            color:
                                                aiInsights.risk_level?.toLowerCase().includes('severe') ||
                                                aiInsights.risk_level?.toLowerCase().includes('critical')
                                                    ? '#991b1b'
                                                    : aiInsights.risk_level?.toLowerCase().includes('high')
                                                      ? '#9a3412'
                                                      : '#166534',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        }}
                                    >
                                        {aiInsights.risk_level || 'Unknown'}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        background: '#f8fafc',
                                        padding: '15px',
                                        borderRadius: '10px',
                                        borderLeft: '4px solid #3b82f6',
                                    }}
                                >
                                    <h5
                                        style={{
                                            margin: '0 0 5px 0',
                                            color: '#1e293b',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        Situation
                                    </h5>
                                    <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: '1.5' }}>
                                        {aiInsights.situation || 'No situation summary provided. Please re-analyze.'}
                                    </p>
                                </div>

                                <div
                                    style={{
                                        background: '#fff',
                                        padding: '15px',
                                        borderRadius: '10px',
                                        border: '1px solid #e2e8f0',
                                    }}
                                >
                                    <h5
                                        style={{
                                            margin: '0 0 10px 0',
                                            color: '#1e293b',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        Drivers & Impact
                                    </h5>
                                    <h6
                                        style={{
                                            margin: '0 0 5px 0',
                                            color: '#64748b',
                                            fontSize: '0.8rem',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Drivers
                                    </h6>
                                    <ul
                                        style={{
                                            margin: '0 0 10px 0',
                                            paddingLeft: '20px',
                                            color: '#334155',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.6',
                                        }}
                                    >
                                        {aiInsights.drivers && aiInsights.drivers.length > 0 ? (
                                            aiInsights.drivers.map((driver, idx) => (
                                                <li key={idx} style={{ marginBottom: '4px' }}>
                                                    {driver}
                                                </li>
                                            ))
                                        ) : (
                                            <li>No drivers identified.</li>
                                        )}
                                    </ul>
                                    <h6
                                        style={{
                                            margin: '0 0 5px 0',
                                            color: '#64748b',
                                            fontSize: '0.8rem',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        Impact
                                    </h6>
                                    <ul
                                        style={{
                                            margin: 0,
                                            paddingLeft: '20px',
                                            color: '#334155',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.6',
                                        }}
                                    >
                                        {aiInsights.impact && aiInsights.impact.length > 0 ? (
                                            aiInsights.impact.map((impact, idx) => (
                                                <li key={idx} style={{ marginBottom: '4px' }}>
                                                    {impact}
                                                </li>
                                            ))
                                        ) : (
                                            <li>No impact data available.</li>
                                        )}
                                    </ul>
                                </div>

                                <div
                                    style={{
                                        background: '#fffbeb',
                                        padding: '15px',
                                        borderRadius: '10px',
                                        border: '1px solid #fef3c7',
                                    }}
                                >
                                    <h5
                                        style={{
                                            margin: '0 0 10px 0',
                                            color: '#92400e',
                                            fontSize: '0.85rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        Recommendations
                                    </h5>
                                    <ul
                                        style={{
                                            margin: 0,
                                            paddingLeft: '20px',
                                            color: '#92400e',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.6',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {aiInsights.recommendations && aiInsights.recommendations.length > 0 ? (
                                            aiInsights.recommendations.map((rec, idx) => (
                                                <li key={idx} style={{ marginBottom: '6px' }}>
                                                    {rec}
                                                </li>
                                            ))
                                        ) : (
                                            <li>No recommendations available.</li>
                                        )}
                                    </ul>
                                </div>
                            </>
                        )}

                        {aiInsights.charts && aiInsights.charts.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {aiInsights.charts.map((chart, idx) => {
                                    const isPercentage = chart.isPercentage;
                                    const valFormatter = (val) =>
                                        isPercentage ? `${(val * 100).toFixed(0)}%` : val;

                                    // Handle offset gradient for the temperature line
                                    let off = 0.5;
                                    if (chart.type === 'line' && chart.data && chart.data.length > 0) {
                                        const max = Math.max(...chart.data.map((i) => i[chart.dataKey]));
                                        const min = Math.min(...chart.data.map((i) => i[chart.dataKey]));
                                        if (max <= 0) off = 0;
                                        else if (min >= 0) off = 1;
                                        else off = max / (max - min);
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                background: '#fff',
                                                padding: '15px',
                                                borderRadius: '10px',
                                                border: '1px solid #e2e8f0',
                                            }}
                                        >
                                            <h5
                                                style={{
                                                    margin: '0 0 15px 0',
                                                    color: '#1e293b',
                                                    fontSize: '0.85rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                }}
                                            >
                                                📈 {chart.title}
                                            </h5>
                                            <ResponsiveContainer width="100%" height={200}>
                                                {chart.type === 'bar' ? (
                                                    <BarChart
                                                        data={chart.data}
                                                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis
                                                            dataKey="date"
                                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <YAxis
                                                            tickFormatter={valFormatter}
                                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <RechartsTooltip
                                                            formatter={valFormatter}
                                                            contentStyle={{
                                                                fontSize: '0.8rem',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                            }}
                                                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                                        />
                                                        <Bar dataKey={chart.dataKey} radius={[4, 4, 0, 0]}>
                                                            {chart.data.map((entry, index) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={
                                                                        entry[chart.dataKey] >= 0
                                                                            ? '#3b82f6'
                                                                            : '#ef4444'
                                                                    }
                                                                />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                ) : (
                                                    <LineChart
                                                        data={chart.data}
                                                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                                                    >
                                                        <defs>
                                                            <linearGradient
                                                                id={`splitColor-${idx}`}
                                                                x1="0"
                                                                y1="0"
                                                                x2="0"
                                                                y2="1"
                                                            >
                                                                <stop offset={off} stopColor="#ef4444" stopOpacity={1} />
                                                                <stop offset={off} stopColor="#3b82f6" stopOpacity={1} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                        <XAxis
                                                            dataKey="date"
                                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <YAxis
                                                            tickFormatter={valFormatter}
                                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <RechartsTooltip
                                                            formatter={valFormatter}
                                                            contentStyle={{
                                                                fontSize: '0.8rem',
                                                                borderRadius: '8px',
                                                                border: 'none',
                                                            }}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey={chart.dataKey}
                                                            stroke={
                                                                chart.title.includes('Temperature')
                                                                    ? `url(#splitColor-${idx})`
                                                                    : chart.color || '#10b981'
                                                            }
                                                            strokeWidth={2}
                                                            dot={{ r: 3 }}
                                                            activeDot={{ r: 5 }}
                                                        />
                                                    </LineChart>
                                                )}
                                            </ResponsiveContainer>
                                            {chart.explanation && (
                                                <p
                                                    style={{
                                                        margin: '10px 0 0 0',
                                                        fontSize: '0.75rem',
                                                        color: '#64748b',
                                                        fontStyle: 'italic',
                                                        lineHeight: '1.4',
                                                    }}
                                                >
                                                    {chart.explanation}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {!aiInsights && !loadingAi && (
                    <div
                        style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            background: 'rgba(255,255,255,0.7)',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                        }}
                    >
                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>🌍</div>
                        <h4 style={{ color: '#2c3e50', margin: '0 0 5px 0', fontSize: '1.05rem' }}>
                            Ready for Analysis
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#7f8c8d', margin: 0, lineHeight: '1.5' }}>
                            Select your geographic scope above and click <strong>Generate Insights</strong> to
                            interpret comprehensive environmental indices including rainfall, vegetation, and
                            climate trends.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RightPanel;
