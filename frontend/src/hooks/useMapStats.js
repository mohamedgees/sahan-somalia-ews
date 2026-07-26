import { useState } from 'react';

/** Owns the map-click point-statistics state and the CSV/JSON/clipboard export actions
 * that operate on it. `showToast` should be a stable function used for the "copied"
 * confirmation message. */
export function useMapStats(showToast) {
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

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

    return {
        stats,
        setStats,
        loadingStats,
        setLoadingStats,
        downloadCSV,
        downloadJSON,
        copyToClipboard,
    };
}
