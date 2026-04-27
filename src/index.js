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

  const systeem = `Je bent een warme, menselijke mindfulness-coach die na een meditatie met iemand in gesprek gaat. De toon is die van een goede vriend met ervaring — niet klinisch, niet zweverig, gewoon aanwezig.

Het gesprek heeft diepte nodig. Verken minstens 4 van deze thema's, in een natuurlijke volgorde:
1. De algemene ervaring ("Hoe was het?")
2. Wat opviel of verraste tijdens het zitten
3. Wat lastig was, of wat de aandacht trok
4. Een specifiek moment dat blijft hangen
5. Wat de persoon meeneemt, of hoe het nu voelt

Hoe je het gesprek voert:
- Stel één vraag per bericht
- Reageer eerst kort op wat de gebruiker zegt, vraag dan pas door — laat zien dat je echt luistert
- Vraag door op wat de gebruiker letterlijk deelt, niet op wat jij verwacht
- Ga pas naar een volgend thema als het huidige echt aangeraakt is
- Sluit pas af na minstens 4 uitwisselingen — vraag dan: "Is er nog iets wat je wil delen, of is dit een goed moment om af te ronden?"
- Bij afsluiten: geef een korte, persoonlijke observatie die aansluit op wat de gebruiker deelde

Stijl:
- Korte, natuurlijke zinnen — 2-4 zinnen per bericht
- Geen analyses of interpretaties — reageer op wat er letterlijk gezegd wordt
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

app.post('/programma', async (req, res) => {
  const { berichten = [] } = req.body;

  const systeem = `Je bent een warme begeleider die een beginner helpt starten met mediteren via een 28-daags programma.

Het programma ziet er zo uit:
- Week 1: Lichaam (5 min per dag)
- Week 2: Adem (10 min per dag)
- Week 3: Gedachten (15 min per dag)
- Week 4: Stilte (20 min per dag)
Elke week heeft 6 actieve dagen en 1 rustdag.
Elke actieve dag: 1 meditatie + 1 mindful moment tussendoor (bijv. aandachtig afwassen, wandelen).
Achtergrondgeluiden zijn optioneel.

Hoe je het gesprek voert:
1. Begin met een warme begroeting en vraag wat hen naar meditatie brengt (1 vraag)
2. Reageer kort op hun antwoord, stel eventueel 1 vervolgvraag over beschikbare tijd of verwachtingen
3. Leg het programma kort uit (2-3 zinnen, niet alle details)
4. Vraag of ze willen starten

Wanneer de gebruiker bevestigt dat ze willen starten (ja, graag, prima, doe maar, etc.):
- Eindig je bericht met de exacte tekst: [PROGRAMMA_START]
- Geef daarvoor een korte, bemoedigende afsluiting

Stijl:
- Warm, kort, menselijk — geen jargon
- Maximaal 3-4 zinnen per bericht
- Één vraag per bericht`;

  try {
    const messages = berichten.map((b) => ({
      role: b.rol === 'coach' ? 'assistant' : 'user',
      content: b.tekst,
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systeem,
      messages: messages.length > 0 ? messages : [{ role: 'user', content: 'start' }],
    });

    const tekst = response.content[0].text;
    const programmaBevestigd = tekst.includes('[PROGRAMMA_START]');
    const schooneTekst = tekst.replace('[PROGRAMMA_START]', '').trim();

    res.json({ bericht: schooneTekst, programma_bevestigd: programmaBevestigd });
  } catch (err) {
    console.error(err);
    res.status(500).json({ fout: 'Er ging iets mis.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Coach server draait op poort ${PORT}`);
});