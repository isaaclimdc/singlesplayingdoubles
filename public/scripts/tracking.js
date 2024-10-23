// Function to get UTM parameters from the URL
function getUTMParameters() {
    const params = new URLSearchParams(window.location.search);
    return {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
    };
}

// Function to save UTM parameters and referrer in localStorage
function saveTrackingData() {
    const utmParams = getUTMParameters();
    const referrer = document.referrer || '';

    // Check if UTM parameters are present in the URL
    if (utmParams.utm_source || utmParams.utm_medium || utmParams.utm_campaign) {
        // Store UTM parameters in localStorage
        localStorage.setItem('utm_source', utmParams.utm_source || '');
        localStorage.setItem('utm_medium', utmParams.utm_medium || '');
        localStorage.setItem('utm_campaign', utmParams.utm_campaign || '');
    }

    // Store the referrer if no UTM parameters are found
    if (!localStorage.getItem('referrer')) {
        localStorage.setItem('referrer', referrer);
    }
}

// Run the function to capture and store data
saveTrackingData();
