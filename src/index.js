require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Coach is online!' });
});

app.post('/check-in', async (req, res) => {
  const { naam, streak, stemming, tijd } = req.body;

  if (!naam || !stemming) {
    return res.status(400).json({ fout: 'naam en stemming zijn verplicht' });
  }

  const SYSTEEM_PROMPT = `Je bent een warme, rustige mindfulness-coach in een meditatie-app.
Je werkt met mensen die al een cursus hebben gedaan en helpt hen hun dagelijkse praktijk levend te houden.

Jouw stijl:
- Kort en menselijk. Maximaal 3 zinnen.
- Erken eerst hoe iemand zich voelt, stel dan pas iets voor.
- Nooit pusherig of overdreven positief.

Beschikbare sessies:
- "adem_3min"      → Ademfocus, 3 minuten
- "bodyscan_10min" → Body scan, 10 minuten
- "open_10min"     → Open aandacht, 10 minuten
- "metta_10min"    → Liefdevolle vriendelijkheid, 10 minuten

Geef ALLEEN een JSON terug, geen extra tekst, geen markdown, geen backticks:
{
  "bericht": "...",
  "sessie_id": "...",
  "reden": "..."
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEEM_PROMPT,
      messages: [{ role: 'user', content: `Naam: ${naam}\nStreak: ${streak} dagen\nStemming: "${stemming}"\nTijd: ${tijd} minuten` }],
    });

    const tekst = response.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    res.json(JSON.parse(tekst));
  } catch (err) {
    console.error(err);
    res.status(500).json({ fout: 'Coach kon geen reactie genereren' });
  }
});

app.post('/inquiry', async (req, res) => {
  const { berichten, tijd, type } = req.body;

  const systeem = `Je bent een warme, rustige mindfulness-coach die een inquiry doet na een meditatie sessie.

Een inquiry is een open, nieuwsgierig gesprek over de meditatie-ervaring. Je stelt één vraag tegelijk, luistert aandachtig en vraagt door op wat de gebruiker zegt.

Regels:
- Stel altijd maar één vraag per bericht
- Korte, open vragen — geen suggesties of adviezen
- Reageer op wat de gebruiker letterlijk zegt
- Geen interpretaties of analyses
- Na 3-4 uitwisselingen sluit je warm af met een korte observatie
- Maximum 2-3 zinnen per reactie

Start altijd met: "Hoe was het om te zitten?"`;

  try {
    const messages = berichten.length === 0
      ? [{ role: 'user', content: `De gebruiker heeft zojuist een ${tijd} minuten ${type} meditatie gedaan. Start de inquiry.` }]
      : berichten;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systeem,
      messages,
    });

    res.json({ bericht: response.content[0].text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ fout: 'Kon geen reactie genereren' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Coach server draait op poort ${PORT}`);
});