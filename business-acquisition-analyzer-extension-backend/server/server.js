const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Configuration, OpenAIApi } = require("openai");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

app.use(bodyParser.json());
app.use(cors());

function cleanExplanation(text) {
  return text.replace(/\*\*/g, '').replace(/###\s/g, '');
}

function loadConfig(site) {
  try {
    const configPath = path.join(__dirname, `configs/${site}.js`);
    if (fs.existsSync(configPath)) {
      return require(configPath);
    } else {
      console.error(`Configuration file not found for site: ${site}`);
      return null;
    }
  } catch (error) {
    console.error(`Error loading configuration for site ${site}:`, error);
    return null;
  }
}

app.post('/analyze', async (req, res) => {
  console.log("Requête reçue à /analyze");
  console.log("Données reçues:", req.body);

  const { site, title, location, price, revenue, employees, description } = req.body;

  // Validation des données reçues (commentée)
  // if (!site || !title || !location || !price || !revenue || !employees || !description) {
  //   console.error('Validation Error: Toutes les données sont requises.');
  //   return res.status(400).json({ error: 'Toutes les données sont requises' });
  // }

  const config = loadConfig(site);
  if (!config) {
    console.error('Validation Error: Invalid site configuration');
    return res.status(400).json({ error: 'Invalid site configuration' });
  }

  const prompt = `Évaluez le potentiel d'acquisition de l'entreprise suivante. Fournissez une note de 0 à 100 et une explication détaillée en HTML :

  Description : ${description}
  Titre : ${title}
  Localisation : ${location}
  Prix : ${price}
  Chiffre d'affaires : ${revenue}
  Employés : ${employees}
  
  Format de réponse attendu :
  Note: [0-100]
  <h2><strong>Explication:</strong></h2>
    <div>
      [explication détaillée ici]
    </div>`;

  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Vous êtes un expert analyste d'affaires." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1500,
    });

    if (response && response.data && response.data.choices) {
      const result = response.data.choices[0].message.content.trim();
      console.log("Réponse de l'IA :", result);

      const scoreMatch = result.match(/Note:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      let explanation = result.replace(/Note:\s*\d+\s*/, '').trim();
      explanation = cleanExplanation(explanation);

      console.log("Note analysée :", score);
      console.log("Explication analysée :", explanation);

      if (score !== null) {
        res.json({ score, explanation });
      } else {
        throw new Error("Impossible de parser la note à partir de la réponse de l'IA.");
      }
    } else {
      throw new Error("Réponse invalide de l'API OpenAI.");
    }
  } catch (error) {
    console.error("Erreur de l'API OpenAI :", error);
    res.status(500).json({ error: 'Erreur lors de l\'analyse de l\'entreprise.', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
