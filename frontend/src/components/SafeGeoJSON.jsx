import React from 'react';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';

const SafeGeoJSON = (props) => {
    const { data, ...other } = props;
    if (!data) return null;

    try {
        // Validate the data structure
        if (!data || typeof data !== 'object') {
            console.warn('SafeGeoJSON: Invalid data type', data);
            return null;
        }

        // Check if it's a FeatureCollection
        if (data.type === 'FeatureCollection') {
            const validFeatures = (data.features || []).filter((f) => {
                try {
                    if (!f || !f.geometry || !f.geometry.type) {
                        return false;
                    }

                    // Support both standard geometries and GeometryCollections
                    const hasValidLogic =
                        f.geometry.type === 'GeometryCollection'
                            ? f.geometry.geometries && Array.isArray(f.geometry.geometries)
                            : f.geometry.coordinates;

                    if (!hasValidLogic) return false;
                    // Try to create a layer to validate
                    L.GeoJSON.geometryToLayer(f);
                    return true;
                } catch (e) {
                    console.warn('SafeGeoJSON: Invalid feature filtered out', f, e.message);
                    return false;
                }
            });

            if (validFeatures.length === 0) {
                console.warn('SafeGeoJSON: No valid features in FeatureCollection');
                return null;
            }

            return (
                <GeoJSON data={{ type: 'FeatureCollection', features: validFeatures }} {...other} />
            );
        } else {
            // Single feature or geometry
            if (!data.geometry || !data.geometry.type) {
                console.warn('SafeGeoJSON: Invalid geometry structure', data);
                return null;
            }
            const hasValidLogic =
                data.geometry.type === 'GeometryCollection'
                    ? data.geometry.geometries && Array.isArray(data.geometry.geometries)
                    : data.geometry.coordinates;

            if (!hasValidLogic) return null;
            L.GeoJSON.geometryToLayer(data);
            return <GeoJSON data={data} {...other} />;
        }
    } catch (err) {
        console.warn('SafeGeoJSON: Validation failed, skipping render', err.message);
        return null;
    }
};

export default SafeGeoJSON;
