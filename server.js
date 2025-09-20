// Simple Express server exposing GET /home that proxies an external API
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Serve UI
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /home -> fetch external API and return its response
app.get('/home', async (req, res) => {
    try {
        // You can optionally allow overriding query params via incoming request
        const id = req.query.id || '0097055';
        const firstName = req.query.first_name || 'Aymen';
        const qr = req.query.qr || '';

        const url = `https://aa.ministry.et/student-result/${encodeURIComponent(
            id
        )}?first_name=${encodeURIComponent(firstName)}&qr=${encodeURIComponent(qr)}`;

        const response = await axios.get(url, {
            // Forward minimal headers; avoid leaking server info
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'IKS-Verify/1.0 (+server)'
            },
            timeout: 15000,
            // If the endpoint returns JSON, axios will parse it; otherwise we pass through data
            validateStatus: (status) => status >= 200 && status < 500,
        });

        // Mirror upstream status when feasible
        res.status(response.status).send(response.data);
    } catch (err) {
        console.error('Error fetching external API:', err.message);
        res.status(502).json({ error: 'Bad Gateway', message: 'Failed to fetch external API' });
    }
});

// Generic HTTP caller
// POST /call
// Body: { method: 'GET'|'POST'|..., url: string, json?: object }
app.post('/call', async (req, res) => {
    try {
        const { method = 'GET', url, json } = req.body || {};
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Bad Request', message: 'url is required' });
        }
        const m = String(method).toUpperCase();
        const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
        if (!allowed.includes(m)) {
            return res.status(400).json({ error: 'Bad Request', message: `Unsupported method: ${method}` });
        }
        // Basic protocol guard
        if (!/^https?:\/\//i.test(url)) {
            return res.status(400).json({ error: 'Bad Request', message: 'Only http/https URLs are allowed' });
        }

        const axiosConfig = {
            method: m,
            url,
            timeout: 20000,
            headers: { 'User-Agent': 'IKS-Verify/1.0 (+server)' },
            validateStatus: (status) => status >= 200 && status < 500,
        };
        if (m === 'GET' && json && typeof json === 'object') {
            axiosConfig.params = json;
        } else if (json !== undefined) {
            axiosConfig.data = json;
            axiosConfig.headers['Content-Type'] = 'application/json';
        }

        const upstream = await axios(axiosConfig);
        const ct = String(upstream.headers['content-type'] || '');
        if (ct.includes('application/json')) {
            res.status(upstream.status).json(upstream.data);
        } else {
            res.status(upstream.status).send(upstream.data);
        }
    } catch (err) {
        console.error('Error in /call:', err.message);
        res.status(502).json({ error: 'Bad Gateway', message: 'Failed to call remote API' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

