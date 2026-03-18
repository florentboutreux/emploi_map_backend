const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

const FT_CLIENT_ID = process.env.FT_CLIENT_ID;
const FT_CLIENT_SECRET = process.env.FT_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = null;

async function getFranceTravailToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', FT_CLIENT_ID);
    params.append('client_secret', FT_CLIENT_SECRET);
    params.append('scope', 'api_offresdemploiv2 o2dsoffre');

    const response = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });
    if (!response.ok) throw new Error(`Échec auth: ${response.status}`);
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; 
    return cachedToken;
}

// ⚠️ C'EST CETTE LIGNE QUI EST IMPORTANTE : app.get('/api/jobs')
app.get('/api/jobs', async (req, res) => {
    try {
        const token = await getFranceTravailToken();
        const queryString = new URLSearchParams(req.query).toString();
        const url = `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (response.status === 204) return res.json({ resultats: [] });
        if (!response.ok) throw new Error(`API a retourné ${response.status}`);
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend sur ${PORT}`));

Une fois que votre `server.js` et votre `index.html` correspondent parfaitement, la communication se fera sans aucun blocage !
