const express = require('express');
const cors = require('cors');

const app = express();

// Autorise votre site web à interroger ce serveur
app.use(cors());

// Récupération des clés secrètes depuis l'environnement de l'hébergeur
const FT_CLIENT_ID = process.env.FT_CLIENT_ID;
const FT_CLIENT_SECRET = process.env.FT_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = null;

// Fonction interne pour obtenir ou rafraîchir le jeton France Travail
async function getFranceTravailToken() {
    // Si on a déjà un token valide, on le réutilise (optimisation)
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', FT_CLIENT_ID);
    params.append('client_secret', FT_CLIENT_SECRET);
    params.append('scope', 'api_offresdemploiv2 o2dsoffre');

    const response = await fetch('[https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire](https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire)', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (!response.ok) throw new Error(`Échec de l'authentification: ${response.status}`);
    
    const data = await response.json();
    cachedToken = data.access_token;
    // On expire le cache 1 minute avant la vraie expiration par sécurité
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; 
    return cachedToken;
}

// La route que votre site web va appeler
app.get('/api/jobs', async (req, res) => {
    try {
        if (!FT_CLIENT_ID || !FT_CLIENT_SECRET) {
            return res.status(500).json({ error: "Les identifiants France Travail ne sont pas configurés sur le serveur." });
        }

        // 1. On récupère le jeton sécurisé
        const token = await getFranceTravailToken();

        // 2. On transmet tous les filtres (motsCles, commune, etc.) à France Travail
        const queryString = new URLSearchParams(req.query).toString();
        const url = `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search${queryString ? '?' + queryString : ''}`;

        // 3. On interroge l'API Offres
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Accept': 'application/json' 
            }
        });

        // Gestion du cas où il n'y a aucun résultat (Code 204 de France Travail)
        if (response.status === 204) {
            return res.json({ resultats: [] });
        }

        if (!response.ok) {
            throw new Error(`France Travail a retourné l'erreur ${response.status}`);
        }

        // 4. On renvoie les données propres à votre site web
        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error("Erreur Backend:", error);
        res.status(500).json({ error: error.message });
    }
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur Backend démarré sur le port ${PORT}`);
});
