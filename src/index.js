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
  // `streak` is 30 juli 2026 uit het contract gehaald: de app kent geen streaks
  // meer. Een oude client die het veld nog meestuurt, wordt niet gebroken — het
  // wordt simpelweg genegeerd.
  const { naam, stemming, tijd } = req.body;

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
      messages: [{ role: 'user', content: `Naam: ${naam}\nStemming: "${stemming}"\nTijd: ${tijd} minuten` }],
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
  const { berichten = [], tijd, type, gestopt = false, gedaanMinuten, programmaDag, programmaFase } = req.body;

  const FASE_CONTEXT = {
    lichaam:    'Week 1 — kennismaking en grondleggen. De gebruiker begint net.',
    adem:       'Week 2 — verdieping. De basis is gelegd, nu verder.',
    gedachten:  'Week 3 — vaak de zwaarste week. Volhouden is hier de oefening.',
    stilte:     'Week 4 — integratie en afronding. De gebruiker is bijna klaar met het programma.',
  };

  const programmaContext = (programmaDag && programmaFase)
    ? `\n\nProgrammacontext (gebruik spaarzaam — alleen waar het natuurlijk past bij wat de gebruiker zegt, nooit geforceerd):\nDag ${programmaDag} van 28 — ${FASE_CONTEXT[programmaFase] || programmaFase}`
    : '';

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
- Sluit pas af na minstens 4 uitwisselingen — nodig dan uit om af te ronden of door te gaan. Gebruik één van deze variaties (kies op gevoel wat past bij het gesprek):
  • "Is er nog iets wat je kwijt wil, of voelt dit als een goed moment om te stoppen?"
  • "Heb je het gevoel dat je gezegd hebt wat je wilde zeggen?"
  • "Is er nog iets dat blijft hangen, of is dit genoeg voor nu?"
  • "Wil je hier nog even bij stilstaan, of is dit een goed punt om af te ronden?"
  • "Nog iets dat je wil delen, of laten we het hierbij?"
  • "Voelt dit compleet, of is er nog iets?"
- Bij afsluiten: geef een korte, persoonlijke observatie die aansluit op wat de gebruiker deelde

Stijl:
- Korte, natuurlijke zinnen — 2-4 zinnen per bericht
- Geen analyses of interpretaties — reageer op wat er letterlijk gezegd wordt
- Geen jargon, vermijd "ik hoor je zeggen dat..."
- Mag eerlijk zijn over moeilijke ervaringen ("Ja, dat kan zwaar zijn")
- Geen overdreven complimenten of geforceerde positiviteit${programmaContext}`;

  try {
    let startBericht;
    if (berichten.length === 0) {
      if (gestopt) {
        const gedaan = gedaanMinuten > 0 ? `${gedaanMinuten} van de ${tijd} minuten` : 'minder dan een minuut';
        startBericht = `De gebruiker had een ${tijd} minuten ${type} meditatie gestart maar stopte na ${gedaan}. Begin het gesprek — erken dat stoppen ook oké is, vraag hoe het was zonder oordeel. Eén korte vraag.`;
      } else {
        startBericht = `De gebruiker heeft zojuist een ${tijd} minuten ${type} meditatie gedaan. Start de inquiry.`;
      }
    }
    const messages = berichten.length === 0
      ? [{ role: 'user', content: startBericht }]
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
    // Geen streak-regel meer (30 juli 2026): de app toont geen dagen-op-rij, dus
    // de coach hoort er ook niet over te kunnen praten. Zou een oude client het
    // veld nog meesturen, dan wordt het hier niet meer gelezen.
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
Maximaal 3-4 zinnen per antwoord. Geen opsommingen, gewoon een gesprek.

De ZIT-app werkt met 4 meditatie-typen die ook de 4 weken van het 28-daagse programma vormen:
- Lichaam (week 1, 5 min): aandacht richten op lichamelijke sensaties — spanning, warmte, contact met de grond. Laagdrempelig startpunt.
- Adem (week 2, 10 min): de adem als anker voor de aandacht. Steeds terugkomen als de aandacht afdwaalt.
- Gedachten (week 3, 15 min): gedachten opmerken zonder erin mee te gaan — ze zien als voorbijdrijvende wolken.
- Stilte (week 4, 20 min): open aanwezigheid zonder specifieke focus. Gewoon aanwezig zijn met wat er is.

Je kent de ZIT-app van binnen en van buiten en kunt vragen over de app beantwoorden:
- Uitloggen: tik op het i-knopje rechtsboven op het hoofdscherm → scroll naar beneden → "Uitloggen"
- Voortgang bekijken: tik op het vlammetje (🔥) of grafiekje (📊) rechtsboven
- 28-daags programma starten: tik op het i-knopje → "Start het programma", of scroll naar beneden op het Mediteren-scherm
- Programma bekijken: via de "Programma"-tab onderin (verschijnt als je een programma hebt)
- Tussendoor-tab: mindful momenten tussendoor, los van een meditatie
- Achtergrondgeluid: kies bij het instellen van je meditatie onderaan
- Feedback geven: i-knopje → "Feedback geven"
- Privacyverklaring: i-knopje → onderaan "Privacyverklaring"
- Vrije meditatie: kies "Vrij" bij de tijdkeuze en typ zelf een aantal minuten in${contextTekst}`;

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

  const vandaag = new Date().toISOString().split('T')[0];

  const systeem = `Je bent een warme begeleider die iemand helpt starten met een 28-daags meditatieprogramma.
Vandaag is het ${vandaag}.

Het programma:
- Week 1: Lichaam (5 min per dag)
- Week 2: Adem (10 min per dag)
- Week 3: Gedachten (15 min per dag)
- Week 4: Stilte (20 min per dag)
Elke week: 6 actieve dagen + 1 rustdag.
Elke actieve dag: 1 meditatie + 1 mindful moment tussendoor.

Programma-duur is vast — pas de gebruiker aan, niet het programma:
- De begeleide meditaties hebben vaste lengtes: 5, 10, 15 en 20 minuten. Er bestaat geen variant van 3 of 4 minuten — de audio is op deze duren gestandaardiseerd.
- Bij minder dan 5 minuten: erken eerst kort, leg vriendelijk uit dat 5 minuten het kortste startpunt is. Help concreet om 5 minuten te vinden in hun dag (bijv. direct na opstaan, vóór de koffie, of vlak voor het slapen). Pas pas door naar de volgende vraag als ze akkoord zijn met 5.
- Bij meer dan 20 minuten beschikbaar (bijv. 25 of 30 min): leg uit dat de begeleide meditaties tot 20 min gaan. Stel voor de extra tijd in te vullen met een mindful tussendoor-moment (Tussendoor-tab) of met een vrije meditatie zonder begeleiding.
- Bij tussenwaarden (zoals 7 of 12 min): prima — leg uit dat het programma per week opbouwt (5 → 10 → 15 → 20) zodat ze weten wat eraan komt en op hun eigen tempo kunnen meegroeien.

Stel deze vragen één voor één, in deze volgorde:
1. Begin met een warme begroeting en vraag: op welk moment van de dag wil je het liefst mediteren?
2. Vraag: hoeveel minuten kun je daar dagelijks voor vrijmaken? (Antwoord toetsen aan de duur-regels hierboven en passend reageren voordat je naar stap 3 gaat.)
3. Vraag: wat brengt je naar meditatie?
4. Leg het programma voor — gebruik LETTERLIJK hun antwoorden. Noem hun tijdstip, hun beschikbare tijd, hun reden. Stel je toon af op hun motivatie. Vraag daarna: wil je vandaag beginnen, morgen, of liever op een vaste dag zoals maandag?

Wanneer de gebruiker aangeeft wanneer ze willen starten:
- Bereken de exacte startdatum op basis van hun antwoord (vandaag = ${vandaag}, morgen = de dag erna, maandag = de eerstvolgende maandag, etc.)
- Geef een korte persoonlijke afsluiting die aansluit op hun antwoorden
- Eindig je bericht ALTIJD met exact: [PROGRAMMA_START:YYYY-MM-DD] waarbij YYYY-MM-DD de berekende startdatum is

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
    const startMatch = tekst.match(/\[PROGRAMMA_START:(\d{4}-\d{2}-\d{2})\]/);
    const programmaBevestigd = !!startMatch;
    const startDatum = startMatch ? startMatch[1] : null;
    const schooneTekst = tekst.replace(/\[PROGRAMMA_START:[^\]]*\]/, '').trim();

    res.json({ bericht: schooneTekst, programma_bevestigd: programmaBevestigd, start_datum: startDatum });
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
  <p>ZIT is een meditatie-app. Voor vragen over privacy kun je contact opnemen via <a href="mailto:lexcoene001@gmail.com">lexcoene001@gmail.com</a>.</p>

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
    <li>Om je sessiegeschiedenis en programmavoortgang te tonen.</li>
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