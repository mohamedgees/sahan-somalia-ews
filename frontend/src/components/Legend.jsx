import React from 'react';

const Legend = ({ activeLayer, activeOverlays }) => {
    // Define gradients for each layer
    // NDVI: Red -> Yellow -> Green
    const ndviGradient =
        'linear-gradient(to right, #d73027, #f46d43, #fdae61, #fee08b, #d9ef8b, #a6d96a, #66bd63, #1a9850)';

    // SMI: Red -> Yellow -> Blue
    const smiGradient =
        'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee090, #e0f3f8, #abd9e9, #74add1, #4575b4, #313695)';

    // SPEI: Dark Red -> White -> Dark Blue
    const speiGradient =
        'linear-gradient(to right, #67001f, #b2182b, #d6604d, #f4a582, #fddbc7, #f7f7f7, #d1e5f0, #92c5de, #4393c3, #2166ac, #053061)';

    // Temperature (MODIS): Blue -> Yellow -> Red
    const tempGradient = 'linear-gradient(to right, #0000ff, #00ffff, #ffff00, #ff0000, #df0000)';

    // CDI: Green (Normal) -> Yellow -> Orange -> Red -> Dark Red (Extreme) — must match
    // the cdi_palette used server-side in gee_utils.py's get_cdi_layer (0-1 scale).
    const cdiGradient = 'linear-gradient(to right, #05e100, #ffff00, #ff9900, #ff0000, #990000)';

    // SPI: Red -> Yellow -> Blue
    const spiGradient =
        'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee090, #e0f3f8, #abd9e9, #74add1, #4575b4, #313695)';

    // VHI: Red -> Yellow -> Green (Standard 0-100 scale)
    const vhiGradient =
        'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee08b, #d9ef8b, #a6d96a, #66bd63, #1a9850, #006837)';

    // Temperature Anomaly: Blue -> White -> Red
    const tempAnomalyGradient =
        'linear-gradient(to right, #313695, #4575b4, #74add1, #abd9e9, #e0f3f8, #ffffbf, #fee090, #fdae61, #f46d43, #d73027, #a50026)';

    // TCI: Red -> Yellow -> Blue
    const tciGradient =
        'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee08b, #d9ef8b, #a6d96a, #66bd63, #1a9850, #006837)';

    // BSI: Green -> Yellow -> Orange -> Deep Red (High Contrast degradation)
    const bsiGradient =
        'linear-gradient(to right, #1b5e20, #aed581, #ffeb3b, #ff9800, #e65100, #3e2723)';

    // SWALIM Rainfall Colors and Labels
    const rainfallColors = [
        '#FFFFFF',
        '#FFFBCC',
        '#BCE895',
        '#2E6219',
        '#53BBD4',
        '#29AEE2',
        '#5C97ED',
        '#1D3F96',
        '#441269',
        '#D64A13',
        '#7A2617',
    ];
    const rainfallLabels = [
        '0 - 2',
        '2 - 5',
        '5 - 10',
        '10 - 20',
        '20 - 30',
        '30 - 40',
        '40 - 50',
        '50 - 100',
        '100 - 150',
        '150 - 200',
        '200 - 250',
    ];

    let title,
        gradient,
        leftLabel,
        rightLabel,
        note,
        isDiscreteRain = false;

    if (activeLayer === 'ndvi') {
        title = 'NDVI (Vegetation Index)';
        gradient = ndviGradient;
        leftLabel = 'Poor/Drought';
        rightLabel = 'Healthy';
    } else if (activeLayer === 'vhi') {
        title = 'VHI (Vegetation Health Index)';
        gradient = vhiGradient;
        leftLabel = 'Extremely Poor (0)';
        rightLabel = 'Optimal (100)';
    } else if (activeLayer === 'rainfall') {
        title = 'Rainfall (CHIRPS)';
        isDiscreteRain = true;
    } else if (activeLayer === 'smi') {
        title = 'Soil Moisture Index';
        gradient = smiGradient;
        leftLabel = 'Dry (-2)';
        rightLabel = 'Wet (+2)';
    } else if (activeLayer === 'spei') {
        title = 'SPEI (Drought Index – Climate)';
        gradient = speiGradient;
        leftLabel = 'Drought (-2.5)';
        rightLabel = 'Wet (+2.5)';
    } else if (activeLayer === 'spi') {
        title = 'SPI (Standardized Precipitation Index)';
        gradient = spiGradient;
        leftLabel = 'Extremely Dry (-2)';
        rightLabel = 'Extremely Wet (+2)';
    } else if (activeLayer === 'cdi') {
        title = 'CDI (Combined Drought Index)';
        gradient = cdiGradient;
        leftLabel = 'Normal (0)';
        rightLabel = 'Extreme Drought (1)';
        note =
            'ICPAC-inspired simplified composite (SPI+VHI+SMI+SPEI); not the official ICPAC/JRC-EDO categorical methodology.';
    } else if (activeLayer.startsWith('forecast_precip')) {
        const days = activeLayer.split('_')[2];
        title = `Predicted Rainfall (${days}-Day) (mm)`;
        isDiscreteRain = true;
    } else if (activeLayer.startsWith('forecast_temp')) {
        const days = activeLayer.split('_')[2];
        title = `Predicted Temperature (${days}-Day)`;
        gradient = tempGradient;
        leftLabel = 'Cool (20°C)';
        rightLabel = 'Hot (45°C)';
    } else if (activeLayer === 'temp_anomaly') {
        title = 'Temperature Anomaly (°C)';
        gradient = tempAnomalyGradient;
        leftLabel = 'Cooler (-2)';
        rightLabel = 'Warmer (+2)';
    } else if (activeLayer === 'tci') {
        title = 'TCI (Temperature Condition Index)';
        gradient = tciGradient;
        leftLabel = 'Heat Stress (0)';
        rightLabel = 'Optimal (100)';
    } else if (activeLayer === 'bsi') {
        title = 'BSI (Bare Soil Index)';
        gradient = bsiGradient;
        leftLabel = 'Vegetated';
        rightLabel = 'Bare Soil/Degraded';
    } else if (activeLayer === 'none') {
        title = 'Satellite View';
        gradient = null;
    } else {
        title = 'Land Surface Temp (MODIS)';
        gradient = tempGradient;
        leftLabel = 'Cool (20°C)';
        rightLabel = 'Hot (50°C)';
    }

    return (
        <div
            style={{
                position: 'relative',
                bottom: 'auto',
                right: 'auto',
                zIndex: 1000,
                background: 'transparent',
                padding: '10px 0',
                borderRadius: '8px',
                boxShadow: 'none',
                fontFamily: '"Inter", sans-serif',
                width: '100%',
                color: '#1e293b',
            }}
        >
            {/* Base Layer Legend */}
            {isDiscreteRain ? (
                <div style={{ marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>
                        {title}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {rainfallColors.map((color, idx) => (
                            <div
                                key={idx}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                            >
                                <div
                                    style={{
                                        width: '24px',
                                        height: '14px',
                                        backgroundColor: color,
                                        border: color === '#FFFFFF' ? '1px solid #e2e8f0' : 'none',
                                        borderRadius: '2px',
                                    }}
                                ></div>
                                <span
                                    style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}
                                >
                                    {rainfallLabels[idx]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                gradient && (
                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e293b' }}>
                            {title}
                        </h4>
                        <div
                            style={{
                                height: '12px',
                                width: '100%',
                                background: gradient,
                                borderRadius: '4px',
                                marginBottom: '5px',
                            }}
                        ></div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: '#64748b',
                                fontWeight: 600,
                            }}
                        >
                            <span>{leftLabel}</span>
                            <span>{rightLabel}</span>
                        </div>
                        {note && (
                            <p
                                style={{
                                    margin: '6px 0 0 0',
                                    fontSize: '10px',
                                    color: '#94a3b8',
                                    lineHeight: 1.4,
                                }}
                            >
                                {note}
                            </p>
                        )}
                    </div>
                )
            )}

            {/* Water Sources Legend */}
            {activeOverlays && activeOverlays.waterSources && (
                <div
                    style={{ marginTop: '5px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}
                >
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b' }}>
                        Water Sources
                    </h4>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            fontSize: '11px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                                className="custom-marker-icon type-borehole status-functional"
                                style={{ width: '14px', height: '14px' }}
                            >
                                <div className="marker-inner"></div>
                            </div>
                            <span>Borehole</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                                className="custom-marker-icon type-dugwell status-functional"
                                style={{ width: '14px', height: '14px' }}
                            >
                                <div className="marker-inner"></div>
                            </div>
                            <span>Dug Well</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                                className="custom-marker-icon type-dam status-functional"
                                style={{ width: '14px', height: '14px' }}
                            >
                                <div className="marker-inner"></div>
                            </div>
                            <span>Dam</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                                className="custom-marker-icon type-berkad status-functional"
                                style={{ width: '14px', height: '14px' }}
                            >
                                <div className="marker-inner"></div>
                            </div>
                            <span>Berkad</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div
                                className="custom-marker-icon type-spring status-functional"
                                style={{ width: '14px', height: '14px' }}
                            >
                                <div className="marker-inner"></div>
                            </div>
                            <span>Spring</span>
                        </div>
                    </div>

                    <h5
                        style={{
                            margin: '12px 0 6px 0',
                            fontSize: '11px',
                            color: '#64748b',
                            textTransform: 'uppercase',
                        }}
                    >
                        Status
                    </h5>
                    <div style={{ display: 'flex', gap: '15px', fontSize: '11px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    background: '#2ecc71',
                                    borderRadius: '50%',
                                }}
                            ></div>
                            <span>Working</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    background: '#e74c3c',
                                    borderRadius: '50%',
                                }}
                            ></div>
                            <span>Broken</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    background: '#95a5a6',
                                    borderRadius: '50%',
                                }}
                            ></div>
                            <span>Aband</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Admin Layers Legend */}
            {activeOverlays &&
                (activeOverlays.customRegions ||
                    activeOverlays.customDistricts ||
                    activeOverlays.customSettlements) && (
                    <div
                        style={{
                            marginTop: '5px',
                            paddingTop: '10px',
                            borderTop: '1px solid #e2e8f0',
                        }}
                    >
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b' }}>
                            Boundaries & Places
                        </h4>

                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                fontSize: '11px',
                            }}
                        >
                            {activeOverlays.customRegions && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div
                                        style={{
                                            width: '24px',
                                            height: '2px',
                                            backgroundColor: '#4a5568',
                                        }}
                                    ></div>
                                    <span>Federal Regions</span>
                                </div>
                            )}
                            {activeOverlays.customDistricts && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div
                                        style={{ width: '24px', borderTop: '2px dashed #718096' }}
                                    ></div>
                                    <span>District Boundaries</span>
                                </div>
                            )}
                            {activeOverlays.customSettlements && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: '#ed8936',
                                            borderRadius: '50%',
                                            border: '1px solid #fff',
                                        }}
                                    ></div>
                                    <span>Major Settlements</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {/* Flash Flood Risk Legend */}
            {activeOverlays && activeOverlays.flashFloodRisk && (
                <div
                    style={{ marginTop: '5px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}
                >
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b' }}>
                        Flash Flood Risk
                    </h4>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            fontSize: '11px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: '#e74c3c',
                                    opacity: 0.7,
                                    border: '2px solid #e74c3c',
                                }}
                            ></div>
                            <span>High Risk</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: '#f39c12',
                                    opacity: 0.7,
                                    border: '2px solid #f39c12',
                                }}
                            ></div>
                            <span>Moderate Risk</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Legend;
