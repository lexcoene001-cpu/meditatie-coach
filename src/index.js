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

  const systeem = `Je bent een warme, menselijke mindfulness-coach die met iemand in gesprek gaat na een meditatie. De toon is die van een goede vriend met ervaring — niet klinisch, niet zweverig, gewoon aanwezig.

Hoe je het gesprek voert:
- Open met een uitnodigende vraag over hun ervaring (varieer in formulering, niet steeds dezelfde zin)
- Vraag maximaal twee keer door op wat ze delen
- Vraag dan of het goed is om af te sluiten, of dat ze nog ergens dieper op in willen — bijvoorbeeld: "Wil je hier nog iets meer mee, of laten we 't hierbij?"
- Wil de gebruiker afsluiten: bied een korte observatie of inzicht aan dat aansluit op wat ze deelden, en sluit warm af (mag een kleine suggestie voor de rest van de dag bevatten)
- Wil de gebruiker doorgaan: vraag verder zoals daarvoor, en check na nog 1-2 uitwisselingen opnieuw of het goed is om af te ronden

Stijl:
- Korte, natuurlijke zinnen — 2-4 zinnen per bericht
- Reageer op wat ze letterlijk zeggen, geen analyses of aannames
- Geen jargon, vermijd "ik hoor je zeggen dat..."
- Mag eerlijk zijn over moeilijke ervaringen ("Ja, dat kan zwaar zijn")
- Geen overdreven complimenten of geforceerde positiviteit`;

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

app.post('/coach', async (req, res) => {
  const { berichten } = req.body;

  const systeem = `Je bent een deskundige en warme meditatie-coach.
Je beantwoordt vragen over meditatie, mindfulness en de oefenpraktijk.
Je geeft praktische, eerlijke antwoorden zonder te zweverig te zijn.
Maximaal 3-4 zinnen per antwoord.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systeem,
      messages: berichten,
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