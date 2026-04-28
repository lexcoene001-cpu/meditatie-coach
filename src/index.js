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
  const { berichten, context = {} } = req.body;

  let contextTekst = '';
  if (context && Object.keys(context).length > 0) {
    const regels = [];
    if (context.streak > 0) regels.push(`Streak: ${context.streak} dagen op rij`);
    if (context.totaalSessies > 0) regels.push(`Totaal meditaties: ${context.totaalSessies} (${context.totaalMinuten} minuten)`);
    if (context.meestGedaan) regels.push(`Meest beoefend: ${context.meestGedaan}`);
    if (context.heeftProgramma) {
      regels.push(`Volgt het 28-daags programma: dag ${context.programmaDag}, fase ${context.programmaFase}`);
      if (context.meditatieVandaagGedaan) regels.push(`Meditatie vandaag: gedaan`);
      else regels.push(`Meditatie vandaag: nog niet gedaan`);
      if (context.tussendoorVandaagGedaan) regels.push(`Tussendoor vandaag: gedaan`);
      else regels.push(`Tussendoor vandaag: nog niet gedaan`);
    } else {
      regels.push(`Volgt geen programma`);
    }
    contextTekst = `\n\nGebruikerscontext (gebruik dit subtiel — noem het niet letterlijk tenzij relevant):\n${regels.join('\n')}`;
  }

  const systeem = `Je bent een warme, rustige meditatie-coach — zoals een goede vriendin die toevallig veel van meditatie weet.
Je beantwoordt vragen over meditatie, mindfulness en de dagelijkse oefenpraktijk.
Je bent eerlijk en praktisch, maar nooit klinisch. Je mag ook gewoon iets terugvragen als dat past.
Maximaal 3-4 zinnen per antwoord. Geen opsommingen, gewoon een gesprek.${contextTekst}`;

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

app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacyverklaring — ZIT</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 680px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; line-height: 1.7; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; margin-top: 40px; margin-bottom: 8px; }
    p, li { font-size: 16px; color: #333; }
    ul { padding-left: 20px; }
    a { color: #1D9E75; }
    .sub { color: #888; font-size: 14px; margin-bottom: 40px; }
  </style>
</head>
<body>
  <h1>Privacyverklaring</h1>
  <p class="sub">ZIT — Minder app, Meer meditatie<br>Laatst bijgewerkt: april 2026</p>

  <h2>1. Wie zijn wij</h2>
  <p>ZIT is een meditatie-app ontwikkeld door Lex Coene. Voor vragen over privacy kun je contact opnemen via <a href="mailto:verlichting2010@gmail.com">verlichting2010@gmail.com</a>.</p>

  <h2>2. Welke gegevens verzamelen we</h2>
  <ul>
    <li><strong>E-mailadres</strong> — voor inloggen via een eenmalige code (OTP). Er is geen wachtwoord.</li>
    <li><strong>Meditatiesessies</strong> — type, duur en datum van je meditaties en tussendoor-momenten.</li>
    <li><strong>Profiel</strong> — of je ervaring hebt met mediteren en de startdatum van je programma.</li>
    <li><strong>Feedback</strong> — tekst die je zelf invult via het feedbackformulier.</li>
  </ul>
  <p>We verzamelen geen locatiegegevens, betaalgegevens of apparaatinformatie.</p>

  <h2>3. Waarom verzamelen we deze gegevens</h2>
  <ul>
    <li>Om je te kunnen laten inloggen en je voortgang bij te houden.</li>
    <li>Om je streak, sessiegeschiedenis en programmavoortgang te tonen.</li>
    <li>Om de app te verbeteren op basis van feedback.</li>
  </ul>

  <h2>4. Hoe lang bewaren we je gegevens</h2>
  <p>Je gegevens worden bewaard zolang je account actief is. Je kunt op elk moment je account en alle bijbehorende gegevens laten verwijderen via <a href="mailto:verlichting2010@gmail.com">verlichting2010@gmail.com</a>.</p>

  <h2>5. Delen met derden</h2>
  <p>We delen je gegevens niet met derden, behalve:</p>
  <ul>
    <li><strong>Supabase</strong> — onze database- en authenticatieprovider, servers in de EU (AVG-conform).</li>
    <li><strong>Anthropic</strong> — de AI-coach verwerkt berichten via de Anthropic API. Gesprekken worden niet opgeslagen na de sessie.</li>
  </ul>

  <h2>6. AI-coach</h2>
  <p>De coach in ZIT is een AI, aangedreven door Claude van Anthropic. De coach is geen vervanging voor professionele psychologische of medische hulp. Berichten die je naar de coach stuurt worden verwerkt door de Anthropic API en niet door ons opgeslagen.</p>

  <h2>7. Jouw rechten</h2>
  <p>Op grond van de AVG heb je het recht op inzage, correctie en verwijdering van je gegevens. Stuur een e-mail naar <a href="mailto:verlichting2010@gmail.com">verlichting2010@gmail.com</a> en we reageren binnen 30 dagen.</p>

  <h2>8. Beveiliging</h2>
  <p>Je gegevens worden opgeslagen bij Supabase met versleutelde verbindingen (HTTPS) en row-level security. Alleen jij hebt toegang tot jouw gegevens.</p>

  <h2>9. Wijzigingen</h2>
  <p>We kunnen deze privacyverklaring aanpassen. Bij belangrijke wijzigingen word je via de app geïnformeerd.</p>

  <h2>10. Contact</h2>
  <p>Vragen? Mail naar <a href="mailto:verlichting2010@gmail.com">verlichting2010@gmail.com</a>.</p>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Coach server draait op poort ${PORT}`);
});