import { useState } from 'react';
import axios from 'axios';
import config from '../config';

/** Owns the AI-insights fetch state and the geographic scope selector it's generated
 * for. `activeBaseLayer`/`selectedMonth`/`selectedYear` are read fresh on each call to
 * fetchAiInsights (same closure-per-render behavior as before this was extracted). */
export function useAiInsights(activeBaseLayer, selectedMonth, selectedYear) {
    const [aiInsights, setAiInsights] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [insightScopeLevel, setInsightScopeLevel] = useState('national'); // 'national', 'region', 'district'
    const [insightScopeName, setInsightScopeName] = useState('Somalia');

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

    return {
        aiInsights,
        loadingAi,
        aiError,
        insightScopeLevel,
        setInsightScopeLevel,
        insightScopeName,
        setInsightScopeName,
        fetchAiInsights,
    };
}
