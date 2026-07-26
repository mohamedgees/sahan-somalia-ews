import React, { useState, useEffect } from 'react';
import './FilterPanel.css';

const FilterPanel = ({ onFilterChange }) => {
    const [regions, setRegions] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch Regions on mount
        fetch('http://localhost:8000/api/regions')
            .then((res) => res.json())
            .then((data) => {
                if (data.regions) {
                    setRegions(data.regions);
                }
            })
            .catch((err) => console.error('Error fetching regions:', err));
    }, []);

    useEffect(() => {
        // Fetch Districts when Region changes
        if (selectedRegion) {
            fetch(`http://localhost:8000/api/districts?region=${selectedRegion}`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.districts) {
                        setDistricts(data.districts);
                        setSelectedDistrict(''); // Reset district
                    }
                })
                .catch((err) => console.error('Error fetching districts:', err));
        } else {
            setDistricts([]);
            setSelectedDistrict('');
        }
    }, [selectedRegion]);

    const handleRegionChange = async (e) => {
        const region = e.target.value;
        setSelectedRegion(region);
        await updateBoundary(region, null);
    };

    const handleDistrictChange = async (e) => {
        const district = e.target.value;
        setSelectedDistrict(district);
        await updateBoundary(selectedRegion, district);
    };

    const updateBoundary = async (region, district) => {
        if (!region && !district) {
            onFilterChange(null);
            return;
        }

        setLoading(true);
        try {
            let url = `http://localhost:8000/api/boundary?`;
            if (district) url += `district=${district}`;
            else if (region) url += `region=${region}`;

            const res = await fetch(url);
            const geojson = await res.json();

            if (geojson.error) {
                console.error('Boundary error:', geojson.error);
                onFilterChange(null);
            } else {
                onFilterChange(geojson);
            }
        } catch (err) {
            console.error('Error fetching boundary:', err);
            onFilterChange(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="filter-panel">
            <h3>Filter Area</h3>
            <div className="filter-group">
                <label>Region (Gobol)</label>
                <select
                    value={selectedRegion}
                    onChange={handleRegionChange}
                    disabled={loading && !regions.length}
                >
                    <option value="">All Somalia</option>
                    {regions.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </select>
            </div>

            {selectedRegion && (
                <div className="filter-group">
                    <label>District (Degmo)</label>
                    <select
                        value={selectedDistrict}
                        onChange={handleDistrictChange}
                        disabled={loading || !districts.length}
                    >
                        <option value="">All Districts</option>
                        {districts.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {loading && <div className="loading-spinner">Loading boundary...</div>}
        </div>
    );
};

export default FilterPanel;
