import React, { useMemo } from 'react';
import { CircleMarker, Popup, Tooltip, LayerGroup, Marker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const WaterSourceMap = ({ data, selectedRegion, selectedDistrict, onMarkerClick }) => {
    const filteredFeatures = useMemo(() => {
        if (!data || !data.features) return [];

        return data.features.filter((f) => {
            const props = f.properties;

            // Filter by Region (Case-insensitive comparison for robustness)
            if (selectedRegion && props.region) {
                if (props.region.toLowerCase() !== selectedRegion.toLowerCase()) {
                    return false;
                }
            }

            // Further filter by District
            if (selectedDistrict && props.district) {
                if (props.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
                    return false;
                }
            }

            return true;
        });
    }, [data, selectedRegion, selectedDistrict]);

    // Customize cluster icon
    const createClusterCustomIcon = function (cluster) {
        return L.divIcon({
            html: `<span>${cluster.getChildCount()}</span>`,
            className: 'marker-cluster-custom',
            iconSize: L.point(40, 40, true),
        });
    };

    const getIcon = (props) => {
        // Color based on status
        let colorClass = 'status-unknown';
        if (props.functioning === 'yes') colorClass = 'status-functional';
        if (props.functioning === 'no') colorClass = 'status-broken';
        if (props.functioning === 'abandoned') colorClass = 'status-abandoned';

        let typeClass = 'type-borehole';
        const type = (props.type || '').toLowerCase();

        if (type.includes('borehole')) typeClass = 'type-borehole';
        else if (type.includes('dug well') || type.includes('dugwell')) typeClass = 'type-dugwell';
        else if (type.includes('dam')) typeClass = 'type-dam';
        else if (type.includes('berkad')) typeClass = 'type-berkad';
        else if (type.includes('spring')) typeClass = 'type-spring';

        // Icon shape mapping based on type
        // Borehole: Cylinder/Circle with border
        // DugWell: Circle with dot
        // Dam: Rectangle
        // Berkad: Square
        // Spring: Triangle/Teardrop

        return L.divIcon({
            className: `custom-marker-icon ${colorClass} ${typeClass}`,
            html: `<div class="marker-inner"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12],
        });
    };

    return (
        <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterCustomIcon}
            maxClusterRadius={60}
            spiderfyOnMaxZoom={true}
        >
            {filteredFeatures.map((f, idx) => (
                <Marker
                    key={`ws-marker-${idx}-${f.id}`}
                    position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
                    icon={getIcon(f.properties)}
                    eventHandlers={{
                        click: () => {
                            if (onMarkerClick) onMarkerClick(f.properties);
                        },
                    }}
                >
                    <Tooltip direction="top" offset={[0, -15]} opacity={0.9}>
                        <div style={{ fontWeight: 'bold' }}>{f.properties.name}</div>
                        <div>Status: {(f.properties.functioning || 'unknown').toUpperCase()}</div>
                        <div>Capacity: {f.properties.capacity} m³</div>
                    </Tooltip>

                    <Popup>
                        <div className="water-source-popup">
                            <h4
                                style={{
                                    margin: '0 0 8px 0',
                                    color: '#2c3e50',
                                    borderBottom: '1.5px solid #eee',
                                    paddingBottom: '4px',
                                }}
                            >
                                {f.properties.name}
                            </h4>
                            <div
                                style={{
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                }}
                            >
                                <div>
                                    <strong>Type:</strong> {f.properties.type}
                                </div>
                                <div>
                                    <strong>Status:</strong>
                                    <span
                                        style={{
                                            marginLeft: '4px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background:
                                                f.properties.functioning === 'yes'
                                                    ? '#d4edda'
                                                    : f.properties.functioning === 'no'
                                                      ? '#f8d7da'
                                                      : '#e2e3e5',
                                            color:
                                                f.properties.functioning === 'yes'
                                                    ? '#155724'
                                                    : f.properties.functioning === 'no'
                                                      ? '#721c24'
                                                      : '#383d41',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        {(f.properties.functioning || 'unknown').toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <strong>Capacity:</strong> {f.properties.capacity} m³
                                </div>
                                <div>
                                    <strong>Settlement:</strong> {f.properties.settlement}
                                </div>
                                <div>
                                    <strong>Region:</strong> {f.properties.region}
                                </div>
                                <div>
                                    <strong>District:</strong> {f.properties.district}
                                </div>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MarkerClusterGroup>
    );
};

export default WaterSourceMap;
