const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

async function genereerCoachReactie(gebruiker) {
  const gebruikersContext = `
Naam: ${gebruiker.naam}
Streak: ${gebruiker.streak} dagen
Stemming vandaag: "${gebruiker.stemming}"
Beschikbare tijd: ${gebruiker.tijd} minuten
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEEM_PROMPT,
    messages: [{ role: 'user', content: gebruikersContext }],
  });

  const tekst = response.content[0].text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(tekst);
}

module.exports = { genereerCoachReactie };