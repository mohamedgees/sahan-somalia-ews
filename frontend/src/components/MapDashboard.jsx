import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import L from 'leaflet';
import {
    MapContainer,
    TileLayer,
    LayersControl,
    LayerGroup,
    Pane,
    useMapEvents,
    ZoomControl,
    Marker,
} from 'react-leaflet';
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
    Cell,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import config from '../config';
import Legend from './Legend';
import SafeGeoJSON from './SafeGeoJSON';
import WaterSourceMap from './WaterSourceMap';
import '../App.css';

// Custom Admin Layers
import customRegionsData from '../data/maps/sm-admin-all.json';
import customDistrictsData from '../data/maps/Districts.json';
import customSettlementsData from '../data/maps/Settlements.json';

const escapeHtml = (val) =>
    String(val ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

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

const center = [5.15, 46.15];
const zoom = 6.4;

const fetchStats = async (
    lat,
    lon,
    type,
    setStats,
    setLoadingStats,
    endDate = null,
    onError = null,
    shouldApply = () => true
) => {
    console.log(`[fetchStats] Initiating fetch for type: ${type} at (${lat}, ${lon})`);
    if (!shouldApply()) return;
    setLoadingStats(true);
    setStats({ type, data: [], label: type, loading: true }); // Temp state to force panel visibility
    try {
        let url = `${config.API_BASE_URL}/stats/point_v2?lat=${lat}&lon=${lon}&type=${type}`;
        if (endDate) url += `&end=${endDate}`;
        const res = await axios.get(url);
        if (!shouldApply()) return;
        if (res.data.error) {
            onError?.(res.data.error);
            setLoadingStats(false);
            setStats(null);
            return;
        }
        setStats({
            lat: parseFloat(lat).toFixed(4),
            lon: parseFloat(lon).toFixed(4),
            data: res.data.data,
            label: res.data.label,
            type: type,
        });
    } catch (err) {
        if (!shouldApply()) return;
        console.error(err);
        onError?.('Failed to fetch statistics.');
        setStats(null);
    } finally {
        if (shouldApply()) setLoadingStats(false);
    }
};

const MapEvents = ({
    setStats,
    setLoadingStats,
    activeLayer,
    sidebarTab,
    manualCoords,
    setManualCoords,
    setMapZoomClass,
    selectedYear,
    selectedMonth,
    onStatsError,
}) => {
    const requestIdRef = useRef(0);

    const getEndDate = useCallback(() => {
        const end = new Date(selectedYear, selectedMonth, 0);
        return end.toISOString().split('T')[0];
    }, [selectedYear, selectedMonth]);

    const map = useMapEvents({
        click: async (e) => {
            const { lat, lng } = e.latlng;
            console.log(`[MapEvents] Map clicked at: ${lat}, ${lng}. Active Layer: ${activeLayer}`);
            const reqId = ++requestIdRef.current;
            fetchStats(
                lat,
                lng,
                activeLayer,
                setStats,
                setLoadingStats,
                getEndDate(),
                onStatsError,
                () => requestIdRef.current === reqId
            );
        },
        zoomend: () => {
            const z = map.getZoom();
            let zoomClass = 'map-zoom-low';
            if (z >= 8 && z < 12) zoomClass = 'map-zoom-medium';
            if (z >= 12 && z < 14) zoomClass = 'map-zoom-high';
            if (z >= 14) zoomClass = 'map-zoom-max';
            setMapZoomClass(zoomClass);
        },
    });

    useEffect(() => {
        const z = map.getZoom();
        let zoomClass = 'map-zoom-low';
        if (z >= 8 && z < 12) zoomClass = 'map-zoom-medium';
        if (z >= 12 && z < 14) zoomClass = 'map-zoom-high';
        if (z >= 14) zoomClass = 'map-zoom-max';
        setMapZoomClass(zoomClass);
    }, [map, setMapZoomClass]);

    useEffect(() => {
        if (manualCoords) {
            map.setView([manualCoords.lat, manualCoords.lon], 9);
            const reqId = ++requestIdRef.current;
            fetchStats(
                manualCoords.lat,
                manualCoords.lon,
                activeLayer,
                setStats,
                setLoadingStats,
                getEndDate(),
                onStatsError,
                () => requestIdRef.current === reqId
            );
            setManualCoords(null);
        }
    }, [
        manualCoords,
        map,
        activeLayer,
        sidebarTab,
        setStats,
        setLoadingStats,
        setManualCoords,
        selectedYear,
        selectedMonth,
        onStatsError,
        getEndDate,
    ]);

    return null;
};

// Authoritative region label positions - calibrated against screenshot and Somalia geography.
// Format: [latitude, longitude]
const REGION_LABEL_COORDS = {
    // NORTH
    Awdal: [10.45, 43.4],
    'Woqooyi Galbeed': [9.8, 44.0],
    Sanaag: [10.4, 47.5],
    Bari: [9.8, 49.5],
    // CENTRAL
    Togdheer: [9.0, 45.3],
    Sool: [8.7, 47.5],
    Nugaal: [8.3, 49.0],
    Mudug: [6.8, 48.0],
    Galgaduud: [5.5, 46.6],
    Hiraan: [4.4, 45.3],
    // SOUTH
    Bay: [2.9, 43.6],
    Bakool: [4.1, 43.9],
    Gedo: [3.3, 42.0],
    'Shabelle Dhexe': [2.8, 45.8],
    'Juba Dhexe': [1.5, 42.3],
    'Shabelle Hoose': [1.6, 44.5],
    Banadir: [2.05, 45.35],
    'Juba Hoose': [-0.2, 41.8],
};

const DISTRICT_LABEL_COORDS = {
    Saakow: [1.7, 42.3],
    Diinsoor: [1.95, 42.73],
    'Ceel Afweyn': [10.1, 46.44],
    Caynabo: [9.45, 46.43],
};

const getFeatureCentroid = (feature) => {
    if (!feature || !feature.geometry) return null;

    const name =
        feature.properties.ADM1_NAME ||
        feature.properties.DIST_NAME ||
        feature.properties.DIST_2_NAM ||
        '';

    // Use hardcoded authoritative position for regions or districts if available
    if (REGION_LABEL_COORDS[name]) {
        return REGION_LABEL_COORDS[name];
    }
    if (DISTRICT_LABEL_COORDS[name]) {
        return DISTRICT_LABEL_COORDS[name];
    }

    // Fallback: compute from polygon vertices for districts
    try {
        const geom = feature.geometry;
        let bestRing = null;
        let maxArea = -1;

        if (geom.type === 'Polygon') {
            bestRing = geom.coordinates[0];
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((poly) => {
                const ring = poly[0];
                let area = 0;
                for (let i = 0; i < ring.length - 1; i++) {
                    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
                }
                area = Math.abs(area);
                if (area > maxArea) {
                    maxArea = area;
                    bestRing = ring;
                }
            });
        }

        if (!bestRing) return null;

        let sumX = 0,
            sumY = 0;
        bestRing.forEach((p) => {
            sumX += p[0];
            sumY += p[1];
        });
        return [sumY / bestRing.length, sumX / bestRing.length];
    } catch (e) {
        return null;
    }
};

const MapDashboard = () => {
    const [sidebarTab, setSidebarTab] = useState('monitor');

    // REFACTORED STATE
    const [activeBaseLayer, setActiveBaseLayer] = useState('ndvi');
    const [activeOverlays, setActiveOverlays] = useState({
        waterSources: false,
        customRegions: true,
        customDistricts: false,
        customSettlements: false,
        flashFloodRisk: false,
    });

    const [layerUrl, setLayerUrl] = useState(null);

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [forecastDays, setForecastDays] = useState(7);

    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message, tone = 'error') => setToast({ message, tone });

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }, [toast]);

    const [waterSourcesData, setWaterSourcesData] = useState(null);
    const [, setLoadingWaterSources] = useState(false);
    const [waterSourceInsights, setWaterSourceInsights] = useState(null);

    const [flashFloodData, setFlashFloodData] = useState(null);
    const [, setLoadingFlashFlood] = useState(false);

    const mapRef = useRef(null);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [mapZoomClass, setMapZoomClass] = useState('map-zoom-low');
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
    const [aiInsights, setAiInsights] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [aiError, setAiError] = useState(null);

    // AI Insight Scope States
    const [insightScopeLevel, setInsightScopeLevel] = useState('national'); // 'national', 'region', 'district'
    const [insightScopeName, setInsightScopeName] = useState('Somalia');

    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
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

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 2000 + 1 }, (_, i) => currentYear - i);
    const allMonths = [
        { val: 1, label: 'January' },
        { val: 2, label: 'February' },
        { val: 3, label: 'March' },
        { val: 4, label: 'April' },
        { val: 5, label: 'May' },
        { val: 6, label: 'June' },
        { val: 7, label: 'July' },
        { val: 8, label: 'August' },
        { val: 9, label: 'September' },
        { val: 10, label: 'October' },
        { val: 11, label: 'November' },
        { val: 12, label: 'December' },
    ];

    const availableMonths =
        selectedYear === new Date().getFullYear()
            ? allMonths.filter((m) => m.val <= new Date().getMonth() + 1)
            : allMonths;

    // Fetch Water Sources
    useEffect(() => {
        if (activeOverlays.waterSources && !waterSourcesData) {
            const fetchWS = async () => {
                setLoadingWaterSources(true);
                try {
                    const res = await axios.get(`${config.API_BASE_URL}/water-sources`);
                    if (res.data && res.data.type === 'FeatureCollection')
                        setWaterSourcesData(res.data);
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoadingWaterSources(false);
                }
            };
            fetchWS();
        }
    }, [activeOverlays.waterSources, waterSourcesData]);

    // Fetch Flash Flood Data
    useEffect(() => {
        if (activeOverlays.flashFloodRisk && !flashFloodData) {
            const fetchFloodData = async () => {
                setLoadingFlashFlood(true);
                try {
                    const res = await axios.get(`${config.API_BASE_URL}/layers/flash-flood-basins`);
                    if (res.data && res.data.type === 'FeatureCollection') {
                        setFlashFloodData(res.data);
                    }
                } catch (err) {
                    console.error('Failed to fetch flash flood data:', err);
                } finally {
                    setLoadingFlashFlood(false);
                }
            };
            fetchFloodData();
        }
    }, [activeOverlays.flashFloodRisk, flashFloodData]);

    // Fetch Layer URL
    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        const fetchLayer = async () => {
            if (activeBaseLayer === 'none') {
                setLayerUrl(null);
                return;
            }
            try {
                setLayerUrl(null);
                const start = new Date(selectedYear, selectedMonth - 1, 1)
                    .toISOString()
                    .split('T')[0];
                const end = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

                let endpoint = activeBaseLayer;
                let res;
                const axiosOpts = { signal: controller.signal };
                if (
                    activeBaseLayer === 'cdi' ||
                    activeBaseLayer === 'smi' ||
                    activeBaseLayer === 'spei' ||
                    activeBaseLayer === 'spi' ||
                    activeBaseLayer === 'vhi' ||
                    activeBaseLayer === 'temp_anomaly' ||
                    activeBaseLayer === 'tci' ||
                    activeBaseLayer === 'bsi'
                ) {
                    res = await axios.get(
                        `${config.API_BASE_URL}/layers/${activeBaseLayer}?date=${start}`,
                        axiosOpts
                    );
                } else if (activeBaseLayer.startsWith('forecast_')) {
                    const type = activeBaseLayer.replace('forecast_', '');
                    res = await axios.get(
                        `${config.API_BASE_URL}/layers/forecast?type=${type}&days=${forecastDays}`,
                        axiosOpts
                    );
                } else {
                    res = await axios.get(
                        `${config.API_BASE_URL}/layers/${endpoint}?start=${start}&end=${end}`,
                        axiosOpts
                    );
                }

                if (cancelled) return;
                if (res.data.url) setLayerUrl(res.data.url);
                else if (res.data.error) showToast(res.data.error);
            } catch (err) {
                if (axios.isCancel(err) || cancelled) return;
                showToast('Failed to load map layer.');
            }
        };
        fetchLayer();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [selectedYear, selectedMonth, activeBaseLayer, forecastDays]);

    // Removed auto drought stats fetch to rely purely on manual insights trigger.

    const fetchAiInsights = () => {
        setLoadingAi(true);
        setAiInsights(null);
        setAiError(null);

        const payload = {
            scope_level: insightScopeLevel,
            scope_name: insightScopeName,
            layer: activeBaseLayer.toUpperCase(),
            month: selectedMonth,
            year: selectedYear,
        };

        axios
            .post(`${config.API_BASE_URL}/insights/analyze`, payload)
            .then((aiRes) => {
                if (aiRes && aiRes.data && !aiRes.data.error) {
                    setAiInsights(aiRes.data);
                } else if (aiRes.data && aiRes.data.error) {
                    let errMsg = aiRes.data.error;
                    if (
                        errMsg.includes('429') ||
                        errMsg.includes('quota') ||
                        errMsg.includes('Quota')
                    ) {
                        errMsg =
                            'AI Service Quota Exceeded. You have hit the API rate limit for Gemini context. Please wait 1 to 2 minutes before analyzing again.';
                    }
                    setAiError(errMsg);
                } else {
                    setAiError('An unknown error occurred while analyzing insights.');
                }
            })
            .catch((err) => {
                console.error('Error fetching AI insights:', err);
                setAiError('Failed to connect to the AI engine. Please verify your connection.');
            })
            .finally(() => {
                setLoadingAi(false);
            });
    };

    const generatePDFReport = async () => {
        setGeneratingPDF(true);
        try {
            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFillColor(15, 32, 39);
            doc.rect(0, 0, pageWidth, 25, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.text('Somalia Drought EWS', 15, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 15, 15, {
                align: 'right',
            });

            // Capture Map
            const mapContainer = mapRef.current._container;
            const mapCanvas = await html2canvas(mapContainer, { useCORS: true, scale: 2 });
            const mapImgData = mapCanvas.toDataURL('image/png');

            const mapWidth = pageWidth - 20;
            const mapHeight = (mapCanvas.height * mapWidth) / mapCanvas.width;
            doc.addImage(mapImgData, 'PNG', 10, 30, mapWidth, mapHeight);

            doc.save(`Somalia_EWS_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error(err);
            showToast('PDF export failed.');
        } finally {
            setGeneratingPDF(false);
        }
    };

    const downloadCSV = () => {
        if (!stats || !stats.data) return;
        let csvContent = 'data:text/csv;charset=utf-8,';
        const isTemperature =
            stats.type === 'temp' || stats.type === 'temperature' || stats.type === 'forecast_temp';
        const keys = isTemperature ? ['date', 'min', 'avg', 'max'] : ['date', 'value'];

        csvContent += keys.join(',') + '\n';
        csvContent += stats.data.map((d) => keys.map((k) => d[k] ?? 0).join(',')).join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `ews_stats_${stats.type}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadJSON = () => {
        if (!stats || !stats.data) return;
        const dataStr =
            'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(stats, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', `ews_stats_${stats.type}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyToClipboard = () => {
        if (!stats || !stats.data) return;
        const isTemperature =
            stats.type === 'temp' || stats.type === 'temperature' || stats.type === 'forecast_temp';
        const text = stats.data
            .map((d) => {
                const val = isTemperature ? `Avg: ${d.avg}` : `Val: ${d.value}`;
                return `${d.date}\t${val}`;
            })
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            showToast('Data copied to clipboard!', 'success');
        });
    };

    return (
        <div className={`dashboard-container ${isRightPanelOpen ? 'has-right-panel' : ''}`}>
            <div className="sidebar" style={{ zIndex: 1001 }}>
                <div className="sidebar-header">
                    <img
                        src="/terratech_logo.png"
                        alt="TerraTech Solutions"
                        className="sidebar-logo"
                    />
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

                                <h4 className="subcategory-title">
                                    🌿 Vegetation & Ecosystem Health
                                </h4>
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

                    <div className="control-section">
                        <button
                            className="export-btn"
                            onClick={generatePDFReport}
                            disabled={generatingPDF}
                        >
                            {generatingPDF ? '⌛ Exporting PDF...' : '📄 Situation Report (PDF)'}
                        </button>
                    </div>
                </div>
            </div>

            <div className={`map-area ${mapZoomClass}`}>
                <MapContainer
                    center={center}
                    zoom={zoom}
                    zoomSnap={0.1}
                    zoomControl={false}
                    style={{ height: '100%', width: '100%' }}
                    ref={mapRef}
                >
                    <MapEvents
                        setStats={setStats}
                        setLoadingStats={setLoadingStats}
                        activeLayer={activeBaseLayer}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        setMapZoomClass={setMapZoomClass}
                        onStatsError={showToast}
                    />
                    <ZoomControl position="topright" />

                    <Pane name="thematic-pane" style={{ zIndex: 350 }} />
                    <Pane name="admin-pane" style={{ zIndex: 500 }} />
                    <Pane name="settlements-pane" style={{ zIndex: 600 }} />

                    <LayersControl position="topright">
                        <LayersControl.BaseLayer name="OpenStreetMap">
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                maxZoom={19}
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer checked name="Street Map (Light)">
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                                maxZoom={19}
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Satellite View">
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                                maxZoom={19}
                            />
                        </LayersControl.BaseLayer>

                        {layerUrl && (
                            <LayersControl.Overlay checked name="Base Layer Data">
                                <TileLayer
                                    pane="thematic-pane"
                                    url={layerUrl}
                                    opacity={
                                        activeBaseLayer === 'rainfall' ||
                                        activeBaseLayer === 'forecast_precip'
                                            ? 1.0
                                            : 0.7
                                    }
                                />
                            </LayersControl.Overlay>
                        )}

                        {activeOverlays.waterSources && waterSourcesData && (
                            <WaterSourceMap
                                data={waterSourcesData}
                                selectedRegion={''}
                                selectedDistrict={''}
                                onMarkerClick={(props) => {
                                    setWaterSourceInsights(props);
                                    setStats(null); // Close base stats when opening borehole insights
                                }}
                            />
                        )}

                        <LayersControl.Overlay
                            checked={activeOverlays.customRegions}
                            name="Somalia Regions"
                        >
                            <SafeGeoJSON
                                data={customRegionsData}
                                pane="admin-pane"
                                style={{
                                    color: '#2d3748',
                                    weight: 2,
                                    fillOpacity: 0,
                                    interactive: false,
                                }}
                            />
                            {/* Standalone invisible markers at exact label positions */}
                            {customRegionsData &&
                                customRegionsData.features &&
                                customRegionsData.features.map((feature, idx) => {
                                    const name = feature.properties.ADM1_NAME;
                                    const coords = REGION_LABEL_COORDS[name];
                                    if (!coords) return null;
                                    // HTML display names - use <br> for long multi-word names to prevent cross-boundary overflow
                                    const DISPLAY_NAMES = {
                                        'Woqooyi Galbeed': 'WOQOOYI<br>GALBEED',
                                        'Shabelle Hoose': 'SHABELLE<br>HOOSE',
                                        'Shabelle Dhexe': 'SHABELLE<br>DHEXE',
                                        'Juba Dhexe': 'JUBA<br>DHEXE',
                                        'Juba Hoose': 'JUBA<br>HOOSE',
                                    };
                                    const displayHtml = DISPLAY_NAMES[name] || name.toUpperCase();
                                    return (
                                        <Marker
                                            key={`region-label-${idx}`}
                                            position={coords}
                                            pane="admin-pane"
                                            icon={L.divIcon({
                                                className: 'region-label',
                                                html: `<span>${displayHtml}</span>`,
                                                iconAnchor: [0, 0],
                                                iconSize: [0, 0],
                                            })}
                                            interactive={false}
                                        />
                                    );
                                })}
                        </LayersControl.Overlay>

                        <LayersControl.Overlay
                            checked={activeOverlays.customDistricts}
                            name="Somalia Districts"
                        >
                            <SafeGeoJSON
                                data={customDistrictsData}
                                pane="admin-pane"
                                style={{
                                    color: '#4a5568',
                                    weight: 0.8,
                                    dashArray: '3, 4',
                                    fillOpacity: 0,
                                    interactive: false,
                                }}
                                onEachFeature={(feature, layer) => {
                                    const name =
                                        feature.properties.DIST_NAME ||
                                        feature.properties.DIST_2_NAM ||
                                        'Unknown';
                                    const centroid = getFeatureCentroid(feature);
                                    if (centroid && layer.bindTooltip) {
                                        // Force tooltip to use land-based centroid
                                        layer.getCenter = () => L.latLng(centroid[0], centroid[1]);
                                        layer.bindTooltip(name, {
                                            permanent: true,
                                            direction: 'center',
                                            className: 'district-label',
                                            sticky: false,
                                            interactive: false,
                                        });
                                    }
                                }}
                            />
                        </LayersControl.Overlay>

                        <LayersControl.Overlay
                            checked={activeOverlays.customSettlements}
                            name="Settlements"
                        >
                            <SafeGeoJSON
                                data={customSettlementsData}
                                pane="settlements-pane"
                                pointToLayer={(feature, latlng) =>
                                    L.circleMarker(latlng, {
                                        radius: 3,
                                        fillColor: '#ed8936',
                                        color: '#fff',
                                        weight: 1,
                                        opacity: 1,
                                        fillOpacity: 0.8,
                                    })
                                }
                                onEachFeature={(feature, layer) => {
                                    if (feature.properties && feature.properties.NAME) {
                                        layer.bindTooltip(feature.properties.NAME, {
                                            permanent: false,
                                            direction: 'top',
                                            className: 'settlement-hover-label',
                                            offset: [0, -5],
                                        });
                                    }
                                }}
                            />
                        </LayersControl.Overlay>

                        <LayersControl.Overlay
                            checked={activeOverlays.flashFloodRisk}
                            name="Flash Flood Risk"
                        >
                            {flashFloodData && (
                                <SafeGeoJSON
                                    data={flashFloodData}
                                    pane="thematic-pane"
                                    filter={(feature) => feature.properties.status !== 'Low'}
                                    style={(feature) => ({
                                        color: feature.properties.color || '#3388ff',
                                        weight: 2,
                                        fillOpacity: 0.7,
                                        fillColor: feature.properties.color || '#3388ff',
                                    })}
                                    onEachFeature={(feature, layer) => {
                                        const props = feature.properties;
                                        if (props) {
                                            const tooltipContent = `
                                                <div style="padding: 5px;">
                                                    <b>Basin Flood Risk</b><br/>
                                                    Status: <span style="color: ${escapeHtml(props.color)}; font-weight: bold;">${escapeHtml(props.status || 'N/A')}</span><br/>
                                                    Risk Score: ${escapeHtml(props.risk_score ?? 'N/A')}<br/>
                                                    Rainfall: ${escapeHtml(props.current_rainfall ?? 0)} mm<br/>
                                                    Susceptibility: ${props.ffsi ? escapeHtml(Number(props.ffsi).toFixed(2)) : 'N/A'}
                                                </div>
                                            `;
                                            layer.bindTooltip(tooltipContent, {
                                                permanent: false,
                                                direction: 'auto',
                                                className: 'flash-flood-tooltip',
                                            });
                                        }
                                    }}
                                />
                            )}
                        </LayersControl.Overlay>
                    </LayersControl>
                </MapContainer>

                {waterSourceInsights && (
                    <div className="bottom-insights-panel water-source-insights">
                        <button
                            className="close-panel-btn"
                            onClick={() => setWaterSourceInsights(null)}
                        >
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
                                            {waterSourceInsights.functioning.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Yield:</strong> {waterSourceInsights.yield} m³/hr
                                    </div>
                                    <div className="detail-item">
                                        <strong>Depth:</strong> {waterSourceInsights.depth} m
                                    </div>
                                    <div className="detail-item">
                                        <strong>Static Level:</strong>{' '}
                                        {waterSourceInsights.static_level} m
                                    </div>
                                    <div className="detail-item">
                                        <strong>Temperature:</strong>{' '}
                                        {waterSourceInsights.temperature} °C
                                    </div>
                                    <div className="detail-item">
                                        <strong>Water Quality (EC):</strong>{' '}
                                        {waterSourceInsights.ec} µS/cm
                                    </div>
                                    <div className="detail-item">
                                        <strong>Water Quality (pH):</strong>{' '}
                                        {waterSourceInsights.pH}
                                    </div>
                                    <div className="detail-item">
                                        <strong>Total Dissolved Solids:</strong>{' '}
                                        {waterSourceInsights.tds}
                                    </div>
                                    <div className="detail-item">
                                        <strong>Water Cost:</strong> {waterSourceInsights.cost}{' '}
                                        (local unit)
                                    </div>
                                    <div className="detail-item">
                                        <strong>Region/District:</strong>{' '}
                                        {waterSourceInsights.region} /{' '}
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
                                    Values scaled for visual comparison. Yield is m³/hr (divided by
                                    100). EC is µS/cm (divided by 10).
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
                                            <button
                                                className="download-btn csv"
                                                onClick={downloadCSV}
                                            >
                                                CSV
                                            </button>
                                            <button
                                                className="download-btn json"
                                                onClick={downloadJSON}
                                            >
                                                JSON
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        className="chart-container-inner"
                                        style={{ minHeight: '250px' }}
                                    >
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
            </div>
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

            {!isRightPanelOpen && (
                <div className="right-panel-minimized" onClick={() => setIsRightPanelOpen(true)}>
                    <span className="vertical-text">
                        {sidebarTab === 'forecast'
                            ? `Rainfall and Temperature Forecast Insights for ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`
                            : `Environmental Insights for ${allMonths.find((m) => m.val === selectedMonth)?.label} ${selectedYear}`}
                    </span>
                </div>
            )}

            {isRightPanelOpen && (
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
                            <h3>
                                {sidebarTab === 'forecast'
                                    ? `Rainfall and Temperature Forecast Insights for ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`
                                    : `Environmental Insights for ${allMonths.find((m) => m.val === selectedMonth)?.label} ${selectedYear}`}
                            </h3>
                            <button
                                className="close-panel"
                                onClick={() => setIsRightPanelOpen(false)}
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    <div
                        className="panel-content"
                        style={{
                            padding: '15px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px',
                        }}
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
                                <label
                                    style={{
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#475569',
                                    }}
                                >
                                    Select Scope
                                </label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <select
                                        className="styled-select-inline"
                                        style={{ flex: 1 }}
                                        value={insightScopeLevel}
                                        onChange={(e) => {
                                            setInsightScopeLevel(e.target.value);
                                            if (e.target.value === 'national')
                                                setInsightScopeName('Somalia');
                                            else if (
                                                e.target.value === 'region' &&
                                                allRegions.length > 0
                                            )
                                                setInsightScopeName(allRegions[0]);
                                            else if (
                                                e.target.value === 'district' &&
                                                allDistricts.length > 0
                                            )
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
                            <h4
                                style={{
                                    margin: 0,
                                    fontWeight: 700,
                                    fontSize: '1.1rem',
                                    color: '#1d4ed8',
                                }}
                            >
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
                                        ? forecastMessages[
                                              loadingMessageIndex % forecastMessages.length
                                          ]
                                        : monitorMessages[
                                              loadingMessageIndex % monitorMessages.length
                                          ]}
                                </h4>
                                <p
                                    style={{
                                        fontSize: '0.85rem',
                                        color: '#7f8c8d',
                                        margin: '5px 0 0 0',
                                    }}
                                >
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
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '15px',
                                    overflowY: 'auto',
                                }}
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

                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '10px',
                                            }}
                                        >
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
                                                        <li
                                                            key={idx}
                                                            style={{ marginBottom: '6px' }}
                                                        >
                                                            {k}
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>

                                        {aiInsights.early_warnings &&
                                            aiInsights.early_warnings.length > 0 && (
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
                                                        aiInsights.risk_level
                                                            ?.toLowerCase()
                                                            .includes('severe') ||
                                                        aiInsights.risk_level
                                                            ?.toLowerCase()
                                                            .includes('critical')
                                                            ? '#fee2e2'
                                                            : aiInsights.risk_level
                                                                    ?.toLowerCase()
                                                                    .includes('high')
                                                              ? '#ffedd5'
                                                              : '#dcfce3',
                                                    color:
                                                        aiInsights.risk_level
                                                            ?.toLowerCase()
                                                            .includes('severe') ||
                                                        aiInsights.risk_level
                                                            ?.toLowerCase()
                                                            .includes('critical')
                                                            ? '#991b1b'
                                                            : aiInsights.risk_level
                                                                    ?.toLowerCase()
                                                                    .includes('high')
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
                                            <p
                                                style={{
                                                    margin: 0,
                                                    fontSize: '0.95rem',
                                                    color: '#334155',
                                                    lineHeight: '1.5',
                                                }}
                                            >
                                                {aiInsights.situation ||
                                                    'No situation summary provided. Please re-analyze.'}
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
                                                {aiInsights.drivers &&
                                                aiInsights.drivers.length > 0 ? (
                                                    aiInsights.drivers.map((driver, idx) => (
                                                        <li
                                                            key={idx}
                                                            style={{ marginBottom: '4px' }}
                                                        >
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
                                                {aiInsights.impact &&
                                                aiInsights.impact.length > 0 ? (
                                                    aiInsights.impact.map((impact, idx) => (
                                                        <li
                                                            key={idx}
                                                            style={{ marginBottom: '4px' }}
                                                        >
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
                                                {aiInsights.recommendations &&
                                                aiInsights.recommendations.length > 0 ? (
                                                    aiInsights.recommendations.map((rec, idx) => (
                                                        <li
                                                            key={idx}
                                                            style={{ marginBottom: '6px' }}
                                                        >
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
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '15px',
                                        }}
                                    >
                                        {aiInsights.charts.map((chart, idx) => {
                                            const isPercentage = chart.isPercentage;
                                            const valFormatter = (val) =>
                                                isPercentage ? `${(val * 100).toFixed(0)}%` : val;

                                            // Handle offset gradient for the temperature line
                                            let off = 0.5;
                                            if (
                                                chart.type === 'line' &&
                                                chart.data &&
                                                chart.data.length > 0
                                            ) {
                                                const max = Math.max(
                                                    ...chart.data.map((i) => i[chart.dataKey])
                                                );
                                                const min = Math.min(
                                                    ...chart.data.map((i) => i[chart.dataKey])
                                                );
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
                                                                margin={{
                                                                    top: 0,
                                                                    right: 0,
                                                                    left: -20,
                                                                    bottom: 0,
                                                                }}
                                                            >
                                                                <CartesianGrid
                                                                    strokeDasharray="3 3"
                                                                    vertical={false}
                                                                />
                                                                <XAxis
                                                                    dataKey="date"
                                                                    tick={{
                                                                        fontSize: 10,
                                                                        fill: '#64748b',
                                                                    }}
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                />
                                                                <YAxis
                                                                    tickFormatter={valFormatter}
                                                                    tick={{
                                                                        fontSize: 10,
                                                                        fill: '#64748b',
                                                                    }}
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
                                                                    cursor={{
                                                                        fill: 'rgba(0,0,0,0.05)',
                                                                    }}
                                                                />
                                                                <Bar
                                                                    dataKey={chart.dataKey}
                                                                    radius={[4, 4, 0, 0]}
                                                                >
                                                                    {chart.data.map(
                                                                        (entry, index) => (
                                                                            <Cell
                                                                                key={`cell-${index}`}
                                                                                fill={
                                                                                    entry[
                                                                                        chart
                                                                                            .dataKey
                                                                                    ] >= 0
                                                                                        ? '#3b82f6'
                                                                                        : '#ef4444'
                                                                                }
                                                                            />
                                                                        )
                                                                    )}
                                                                </Bar>
                                                            </BarChart>
                                                        ) : (
                                                            <LineChart
                                                                data={chart.data}
                                                                margin={{
                                                                    top: 0,
                                                                    right: 0,
                                                                    left: -20,
                                                                    bottom: 0,
                                                                }}
                                                            >
                                                                <defs>
                                                                    <linearGradient
                                                                        id={`splitColor-${idx}`}
                                                                        x1="0"
                                                                        y1="0"
                                                                        x2="0"
                                                                        y2="1"
                                                                    >
                                                                        <stop
                                                                            offset={off}
                                                                            stopColor="#ef4444"
                                                                            stopOpacity={1}
                                                                        />
                                                                        <stop
                                                                            offset={off}
                                                                            stopColor="#3b82f6"
                                                                            stopOpacity={1}
                                                                        />
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid
                                                                    strokeDasharray="3 3"
                                                                    vertical={false}
                                                                />
                                                                <XAxis
                                                                    dataKey="date"
                                                                    tick={{
                                                                        fontSize: 10,
                                                                        fill: '#64748b',
                                                                    }}
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                />
                                                                <YAxis
                                                                    tickFormatter={valFormatter}
                                                                    tick={{
                                                                        fontSize: 10,
                                                                        fill: '#64748b',
                                                                    }}
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
                                                                        chart.title.includes(
                                                                            'Temperature'
                                                                        )
                                                                            ? `url(#splitColor-${idx})`
                                                                            : chart.color ||
                                                                              '#10b981'
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
                                <h4
                                    style={{
                                        color: '#2c3e50',
                                        margin: '0 0 5px 0',
                                        fontSize: '1.05rem',
                                    }}
                                >
                                    Ready for Analysis
                                </h4>
                                <p
                                    style={{
                                        fontSize: '0.85rem',
                                        color: '#7f8c8d',
                                        margin: 0,
                                        lineHeight: '1.5',
                                    }}
                                >
                                    Select your geographic scope above and click{' '}
                                    <strong>Generate Insights</strong> to interpret comprehensive
                                    environmental indices including rainfall, vegetation, and
                                    climate trends.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapDashboard;
