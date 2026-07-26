import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import L from 'leaflet';
import {
    MapContainer,
    TileLayer,
    LayersControl,
    Pane,
    useMapEvents,
    ZoomControl,
    Marker,
} from 'react-leaflet';

import config from '../config';
import SafeGeoJSON from './SafeGeoJSON';
import WaterSourceMap from './WaterSourceMap';
import BottomStatsPanel from './BottomStatsPanel';

// Custom Admin Layers
import customRegionsData from '../data/maps/sm-admin-all.json';
import customDistrictsData from '../data/maps/Districts.json';
import customSettlementsData from '../data/maps/Settlements.json';

const escapeHtml = (val) =>
    String(val ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

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

const MapView = ({
    activeBaseLayer,
    selectedYear,
    selectedMonth,
    forecastDays,
    activeOverlays,
    layerUrl,
    setStats,
    setLoadingStats,
    onStatsError,
    stats,
    loadingStats,
    waterSourceInsights,
    setWaterSourceInsights,
    downloadCSV,
    downloadJSON,
    copyToClipboard,
}) => {
    const [mapZoomClass, setMapZoomClass] = useState('map-zoom-low');
    const [waterSourcesData, setWaterSourcesData] = useState(null);
    const [, setLoadingWaterSources] = useState(false);
    const [flashFloodData, setFlashFloodData] = useState(null);
    const [, setLoadingFlashFlood] = useState(false);

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

    return (
        <div className={`map-area ${mapZoomClass}`}>
            <MapContainer
                center={center}
                zoom={zoom}
                zoomSnap={0.1}
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
            >
                <MapEvents
                    setStats={setStats}
                    setLoadingStats={setLoadingStats}
                    activeLayer={activeBaseLayer}
                    selectedYear={selectedYear}
                    selectedMonth={selectedMonth}
                    setMapZoomClass={setMapZoomClass}
                    onStatsError={onStatsError}
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

                    <LayersControl.Overlay checked={activeOverlays.customRegions} name="Somalia Regions">
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

                    <LayersControl.Overlay checked={activeOverlays.customSettlements} name="Settlements">
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

                    <LayersControl.Overlay checked={activeOverlays.flashFloodRisk} name="Flash Flood Risk">
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

            <BottomStatsPanel
                stats={stats}
                setStats={setStats}
                loadingStats={loadingStats}
                forecastDays={forecastDays}
                downloadCSV={downloadCSV}
                downloadJSON={downloadJSON}
                copyToClipboard={copyToClipboard}
                waterSourceInsights={waterSourceInsights}
                setWaterSourceInsights={setWaterSourceInsights}
            />
        </div>
    );
};

export default MapView;
