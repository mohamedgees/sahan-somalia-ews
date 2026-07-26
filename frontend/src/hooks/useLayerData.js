import { useEffect, useState } from 'react';
import axios from 'axios';
import config from '../config';

/** Fetches the active satellite-layer tile URL whenever the layer/date/forecast-window
 * changes, with abort + staleness guards so a slow, superseded response can't overwrite
 * newer state. `onError` should be a stable (useCallback'd) function. */
export function useLayerData(activeBaseLayer, selectedYear, selectedMonth, forecastDays, onError) {
    const [layerUrl, setLayerUrl] = useState(null);

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
                else if (res.data.error) onError?.(res.data.error);
            } catch (err) {
                if (axios.isCancel(err) || cancelled) return;
                onError?.('Failed to load map layer.');
            }
        };
        fetchLayer();
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [selectedYear, selectedMonth, activeBaseLayer, forecastDays, onError]);

    return { layerUrl };
}
