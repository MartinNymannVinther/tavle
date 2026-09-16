import type { DemoWords } from "./words";

/** The demo in Danish; the shape is documented in words.ts. */
export const DEMO_DA: DemoWords = {
  kanban: {
    name: "Webshop",
    key: "WEB",
    description:
      "Drift og forbedringer af webshoppen. Løbende flow, højst tre ting i gang ad gangen.",
    structure: {
      areas: ["Betalinger", "Katalog", "Levering", "Forside", "Platform"],
      themes: [
        { name: "Selvbetjening", color: "moss" },
        { name: "Konvertering", color: "clay" },
        { name: "Stabil drift", color: "sage" },
      ],
      epics: [
        {
          title: "Kunder kan betale som de vil",
          description:
            "Halvdelen af de afbrudte køb sker på betalingssiden, fordi kundens foretrukne metode mangler. Gavekortene sælges i den fysiske butik og skal kunne bruges online på samme vilkår.",
          doneWhen: "MobilePay, kort og gavekort virker i checkout på alle enheder",
          area: "Betalinger",
          themes: ["Konvertering", "Selvbetjening"],
          quarterOffset: 1,
          features: [
            {
              title: "Kunder kan betale med MobilePay på alle enheder",
              description:
                "MobilePay kom i drift på desktop først; på telefonen skal kunden ud i appen og tilbage igen, og det er dér, kurven bliver tømt. Springet skal holde, også når kunden bliver et par minutter i appen.",
              doneWhen: "Betalingen gennemføres på iPhone og Android uden at kurven tømmes",
            },
            {
              title: "Kunder kan betale med gavekort",
              description:
                "Gavekortene ligger i butikkens kassesystem, så saldoen skal slås op dér ved hvert køb. Kortnumrene er korte, så de skal beskyttes mod, at nogen gætter sig frem til et.",
              doneWhen: "Et gavekort kan indløses helt eller delvist i checkout",
            },
          ],
        },
        {
          title: "Kunder finder varen uden at lede",
          description:
            "Kataloget er vokset til over 2.000 varer, og kunderne bladrer i stedet for at finde det, de kom efter. Størstedelen af trafikken kommer fra mobilen, så det skal virke på en lille skærm først.",
          doneWhen: "Søgning og sortering bruges i 40 % af sessionerne og returraten falder",
          area: "Katalog",
          themes: ["Konvertering"],
          quarterOffset: 2,
          agedDays: 200,
          features: [
            {
              title: "Kunder kan sortere og filtrere kategorierne",
              description:
                "Filtrene skal kunne kombineres og stå i adressen, så en filtreret liste kan deles og åbnes igen. Varer uden data i et felt må ikke forsvinde ud af listen.",
              doneWhen: "Pris, popularitet og nyhed kan vælges på alle kategorisider",
            },
            {
              title: "Kunder kan læse og skrive anmeldelser",
              description:
                "Kun kunder med et køb bag sig kan skrive, og alt skal forbi kundeservice, før det vises. En anmeldelse, der bliver rapporteret, tages ned igen, indtil nogen har set på den.",
              doneWhen: "Anmeldelser vises på produktsiden og kan skrives efter et køb",
            },
          ],
        },
        {
          title: "Vi kan udrulle uden nedetid",
          description:
            "Udrulninger sker i dag i hånden om aftenen, og butikken er lukket imens. Det holder teamet fra at rette småting i løbet af dagen.",
          doneWhen: "Tre udrulninger i træk uden nedetid og uden manuelle trin",
          area: "Platform",
          themes: ["Stabil drift"],
          enabler: "infrastructure",
          features: [
            {
              title: "Udrulning sker automatisk fra main",
              description:
                "Pipelinen skal køre migrationer, skifte mellem to sæt servere og kunne rulle tilbage igen. Alt det, der i dag står i en køreplan på skrift, skal ind i den.",
              doneWhen: "En grøn pipeline ruller ud uden at nogen trykker på noget",
            },
          ],
        },
      ],
    },
    cards: [
      {
        title: "Kunder kan ikke betale med MobilePay på iPhone",
        column: "doing",
        priority: "urgent",
        estimate: 3,
        description: "Fejlen opstår efter man vender tilbage fra MobilePay-appen. Kurven er tom.",
        checklist: ["Genskab fejlen", "Find årsagen", "Ret og test på rigtig telefon"],
        dueOffset: 1,
        feature: "Kunder kan betale med MobilePay på alle enheder",
        bug: true,
      },
      {
        title: "Nyhedsbrev-tilmelding i footeren",
        description:
          "Kun mailadresse og et samtykkefelt. Tilmeldingen sendes videre til nyhedsbrevsystemet, som selv sender bekræftelsesmailen.",
        column: "doing",
        estimate: 2,
        dueOffset: 4,
        area: "Forside",
      },
      {
        title: "Hurtigere billeder på produktsiderne",
        description:
          "Billederne leveres i dag i fuld opløsning uanset skærm. De skal skaleres og konverteres til webp, før de sendes.",
        column: "doing",
        estimate: 5,
        blocked: "Venter på nye billeder fra fotografen",
        area: "Katalog",
      },
      {
        title: "Sortering efter pris i kategorierne",
        description:
          "Sorteringen skal ske i databasen, ikke i browseren — de store kategorier har for mange varer til at hente dem alle.",
        column: "doing",
        estimate: 3,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Gavekort kan indløses i checkout",
        description:
          "Saldoen må først trækkes, når resten af betalingen er godkendt. Ellers mister kunden penge på et kort, der aldrig blev til en ordre.",
        column: "todo",
        estimate: 8,
        priority: "high",
        feature: "Kunder kan betale med gavekort",
      },
      {
        title: "Opdatér handelsbetingelserne",
        description:
          "Vores advokat har sendt ny tekst om fortrydelsesret og returnering. Datoen nederst på siden skal også rettes.",
        column: "todo",
        estimate: 1,
        dueOffset: -2,
        area: "Forside",
      },
      {
        title: "Blue/green-opsætning af webserverne",
        description:
          "To ens miljøer side om side, så trafikken kan lægges om, når det nye er oppe. Databasen er fælles, så en ændring skal kunne tåle begge versioner i drift.",
        column: "todo",
        estimate: 5,
        feature: "Udrulning sker automatisk fra main",
        enabler: "infrastructure",
      },
      {
        title: "Sæson-banner til forsiden",
        description:
          "Marketing skal selv kunne sætte start- og slutdato, så vi ikke skal rulle ud for at skifte et billede.",
        column: "todo",
        estimate: 2,
        area: "Forside",
      },
      {
        title: "Returformular kunden kan udfylde selv",
        description:
          "I dag ringer kunden til kundeservice, som taster returneringen ind. Formularen skal kunne finde ordren frem ud fra ordrenummer og mailadresse.",
        column: "backlog",
        estimate: 5,
        area: "Levering",
      },
      {
        title: "Filtrér på størrelse og farve",
        description:
          "Størrelse og farve står som fritekst på varianterne, hvor XL, xl og X-large er den samme størrelse. Værdierne skal ryddes op, før der kan filtreres på dem.",
        column: "backlog",
        estimate: 5,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Skriv en anmeldelse efter et køb",
        description:
          "Kun kunder med en leveret ordre på varen må skrive. Anmeldelsen godkendes af kundeservice, før den vises.",
        column: "backlog",
        estimate: 8,
        feature: "Kunder kan læse og skrive anmeldelser",
      },
      {
        title: "Ønskeliste",
        description:
          "Skal virke uden login, så listen ligger på sessionen og skal flyttes med over, når kunden opretter sig.",
        column: "backlog",
        area: "Katalog",
      },
      {
        title: "Gavekort kan købes som gave",
        description:
          "Køberen vælger beløb og modtager, og koden sendes på mail på en valgt dato. Kortet må ikke kunne bruges før den dato.",
        column: "backlog",
        estimate: 5,
        feature: "Kunder kan betale med gavekort",
      },
      {
        title: "Levering til pakkeshop",
        description:
          "Kunden vælger udleveringssted på et kort i checkout. Listen kommer fra fragtfirmaets eget opslag på postnummeret.",
        column: "done",
        estimate: 5,
        area: "Levering",
      },
      {
        title: "Rabatkoder",
        description:
          "Kun én kode pr. ordre, og en kode kan ikke lægges oven i tilbudspriser. Begge dele håndhæves i kurven.",
        column: "done",
        estimate: 3,
        area: "Betalinger",
      },
      {
        title: "Søgning der tåler stavefejl",
        description:
          "Søgningen bruger trigrammer i Postgres i stedet for eksakt match, så et enkelt forkert bogstav stadig giver træf.",
        column: "done",
        estimate: 5,
        area: "Katalog",
      },
      {
        title: "Cookie-banner der ikke er irriterende",
        description:
          "Valget huskes i et år, og der indlæses ingen statistik, før kunden har sagt ja.",
        column: "done",
        estimate: 2,
        area: "Forside",
      },
      {
        title: "Ordrebekræftelse på mail",
        description:
          "Mailen sendes fra en kø, så en fejl hos mailudbyderen ikke vælter selve bestillingen.",
        column: "done",
        estimate: 3,
        area: "Betalinger",
      },
      {
        title: "Byg-pipeline på hvert commit",
        description:
          "Første skridt mod automatisk udrulning. Testene køres nu ét fælles sted i stedet for kun på den enkeltes maskine.",
        column: "done",
        estimate: 5,
        feature: "Udrulning sker automatisk fra main",
      },
      {
        title: "Opgradér Node-versionen",
        description:
          "Den gamle version fik ikke længere sikkerhedsrettelser. Opgraderingen trak to biblioteker med, som ikke virkede på den nye.",
        column: "done",
        estimate: 3,
        area: "Platform",
        enabler: "infrastructure",
      },
      {
        title: "MobilePay som betalingsmetode",
        column: "done",
        estimate: 8,
        description: "Første version i checkout, kun på desktop.",
        feature: "Kunder kan betale med MobilePay på alle enheder",
      },
      {
        title: "MobilePay-logo i checkout",
        description:
          "Logoet hentes ikke fra MobilePays eget site, men ligger hos os i de størrelser, deres retningslinjer tillader.",
        column: "done",
        estimate: 1,
        feature: "Kunder kan betale med MobilePay på alle enheder",
      },
      {
        title: "Kvittering efter MobilePay-betaling",
        description:
          "Kvitteringen viser både ordrenummer og betalingsreferencen fra MobilePay, så kundeservice kan slå betalingen op.",
        column: "done",
        estimate: 2,
        feature: "Kunder kan betale med MobilePay på alle enheder",
      },
      {
        title: "Timeout når MobilePay ikke svarer",
        column: "done",
        estimate: 3,
        description: "Checkout hang i to minutter, når appen ikke svarede.",
        feature: "Kunder kan betale med MobilePay på alle enheder",
        bug: true,
      },
      {
        title: "Migrationer kører automatisk",
        description:
          "Kører som et trin, før den nye version startes, og stopper udrulningen, hvis en migration fejler. En lås sikrer, at kun én server kører dem, når begge starter samtidig.",
        column: "done",
        estimate: 3,
        feature: "Udrulning sker automatisk fra main",
      },
      {
        title: "Logning samlet ét sted",
        column: "done",
        estimate: 5,
        description: "Vi ledte i tre systemer, hver gang noget gik galt.",
        area: "Platform",
        enabler: "infrastructure",
      },
      {
        title: "Fragtpriser efter vægt",
        description:
          "Vægten regnes ud fra varernes egen vægt plus emballage. Intervallerne kan rettes i administrationen uden en udrulning.",
        column: "done",
        estimate: 5,
        area: "Levering",
      },
      {
        title: "Sporingslink i ordrebekræftelsen",
        description:
          "Fragtfirmaet melder først sporingsnummeret tilbage, når pakken er pakket. Indtil da står der i mailen, at linket følger.",
        column: "done",
        estimate: 2,
        area: "Levering",
      },
      {
        title: "Sortering efter popularitet",
        description:
          "Popularitet er antal salg de sidste 30 dage, gjort op én gang i døgnet. Regnet på hver forespørgsel blev det for tungt i de store kategorier.",
        column: "done",
        estimate: 3,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Antal varer ud for hvert filter",
        description:
          "Tallene tælles med de øvrige valgte filtre. Ellers lover de resultater, der ikke findes.",
        column: "done",
        estimate: 2,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Filtrér på mærke",
        description:
          "Mærket stod som en del af varenavnet og ikke som et felt. Det måtte trækkes ud på alle varer først.",
        column: "done",
        estimate: 5,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Filtre huskes når man går tilbage",
        column: "done",
        estimate: 3,
        description: "Valgte filtre forsvandt, når kunden gik tilbage fra en produktside.",
        feature: "Kunder kan sortere og filtrere kategorierne",
        bug: true,
      },
      {
        title: "Ordrer blev trukket to gange",
        column: "done",
        estimate: 3,
        description: "Et dobbeltklik på betalingsknappen oprettede to ordrer.",
        area: "Betalinger",
        bug: true,
      },
      {
        title: "Faktura som betalingsmetode",
        description:
          "Kun for erhvervskunder med CVR-nummer og en godkendt kreditgrænse. Selve fakturaen sendes af økonomisystemet, ikke af shoppen.",
        column: "done",
        estimate: 5,
        area: "Betalinger",
      },
      {
        title: "Anmeldelser vises på produktsiden",
        column: "done",
        estimate: 5,
        description: "Kun visning; anmeldelser skrives stadig i det gamle system.",
        feature: "Kunder kan læse og skrive anmeldelser",
      },
      {
        title: "Gennemsnitlig vurdering i kategorien",
        description:
          "Vises først, når en vare har mindst tre anmeldelser. Under det siger gennemsnittet ingenting.",
        column: "done",
        estimate: 3,
        feature: "Kunder kan læse og skrive anmeldelser",
      },
      {
        title: "Rapportér en anmeldelse",
        description:
          "En rapporteret anmeldelse skjules ikke af sig selv, men havner i en liste, kundeservice tager stilling til.",
        column: "done",
        estimate: 2,
        feature: "Kunder kan læse og skrive anmeldelser",
      },
      {
        title: "Datamodel for gavekort",
        description:
          "Saldoen ligger ikke som et felt, men som summen af posteringer, så ethvert træk kan spores tilbage.",
        column: "done",
        estimate: 5,
        feature: "Kunder kan betale med gavekort",
      },
      {
        title: "Gavekortsaldo kan slås op",
        column: "done",
        estimate: 3,
        description: "Kundeservice skal kunne se, hvad der er tilbage på et kort.",
        feature: "Kunder kan betale med gavekort",
      },
      {
        title: "Udløbsdato på gavekort",
        description:
          "Tre år fra udstedelsen. Datoen står både på kortet og i checkout, så kunden ikke opdager den for sent.",
        column: "done",
        estimate: 2,
        feature: "Kunder kan betale med gavekort",
      },
      {
        title: "Rul tilbage med ét tryk",
        column: "done",
        estimate: 5,
        description: "Den forrige version kan sættes i drift igen uden manuelle trin.",
        feature: "Udrulning sker automatisk fra main",
      },
      {
        title: "Billedhåndtering ud af monolitten",
        description:
          "Billedbehandlingen åd hukommelse fra resten af shoppen ved hver upload. Den kører nu som sin egen tjeneste.",
        column: "done",
        estimate: 8,
        area: "Platform",
        enabler: "architecture",
      },
      {
        title: "Udsolgte varer nederst i listen",
        description:
          "De bliver stående i listen, så kunden kan se, at varen findes, og bede om besked, når den kommer hjem igen.",
        column: "done",
        estimate: 2,
        area: "Katalog",
      },
      {
        title: "Ny forside til efterårskampagnen",
        column: "done",
        estimate: 5,
        description: "Nye billeder og ny opbygning inden efterårets kampagne.",
        area: "Forside",
      },
      {
        title: "Menuen kunne ikke åbnes på mobil",
        description:
          "Et usynligt lag fra cookie-banneret blev liggende oven på knappen, efter at banneret var lukket.",
        column: "done",
        estimate: 2,
        area: "Forside",
        bug: true,
      },
    ],
    comment: "Jeg kan genskabe fejlen på min egen telefon. Kigger på det i dag.",
    releases: [
      { name: "Forår: betaling og katalog", dayOffset: -70 },
      { name: "Sommer: anmeldelser og drift", dayOffset: -28 },
      { name: "Black Friday-klar", dayOffset: 21 },
    ],
  },
  scrum: {
    name: "Medlemsapp",
    key: "APP",
    description: "Foreningens app til medlemmerne. To ugers sprints, demo hver anden fredag.",
    structure: {
      areas: ["Konto", "Arrangementer", "Betaling", "Beskeder"],
      themes: [
        { name: "Selvbetjening", color: "moss" },
        { name: "Fastholdelse", color: "clay" },
        { name: "Regulatorisk", color: "rust" },
      ],
      epics: [
        {
          title: "Medlemmer kan logge ind og se deres medlemskab",
          description:
            "Medlemmerne ringer i dag til kontoret for at høre, om kontingentet er betalt. Svaret står i medlemsregistret, og det er dét, appen skal vise, ikke en kopi ved siden af.",
          doneWhen: "90 % af medlemmerne har logget ind og set deres kontingent",
          area: "Konto",
          themes: ["Selvbetjening"],
          closed: true,
          features: [
            {
              title: "Medlemmer kan logge ind med MitID",
              description:
                "MitID knytter medlemmet til den rigtige post i medlemsregistret, uden at nogen skal taste et medlemsnummer. Medlemmer uden MitID skal stadig kunne få hjælp af kontoret.",
              doneWhen: "Login virker på iOS og Android og kontingentet vises",
              closed: true,
            },
          ],
        },
        {
          title: "Medlemmer kan tilmelde sig arrangementer i appen",
          description:
            "Tilmeldinger kommer i dag på mail og skrives i hånden ind i et regneark. Arrangørerne skal kunne se deres deltagere uden at spørge kontoret.",
          doneWhen: "Halvdelen af tilmeldingerne kommer fra appen",
          area: "Arrangementer",
          themes: ["Fastholdelse"],
          quarterOffset: 0,
          features: [
            {
              title: "Medlemmer kan tilmelde og afmelde sig",
              description:
                "Der er et begrænset antal pladser, så to medlemmer, der trykker samtidig, må ikke begge få den sidste. En afmelding skal rykke den næste på ventelisten op med det samme, også midt om natten.",
              doneWhen: "Tilmelding, afmelding, påmindelse og venteliste virker",
            },
            {
              title: "Medlemmer kan se programmet for et arrangement",
              description:
                "Arrangøren retter i programmet helt frem til dagen før, så siden må ikke vise en gemt udgave. Falder en oplægsholder fra, skal resten af tiderne blive, hvor de er.",
              doneWhen: "Tid, sted, program og praktisk info står på arrangementets side",
              closed: true,
            },
          ],
        },
        {
          title: "Medlemmer kan betale kontingent i appen",
          description:
            "Kontingentet opkræves i dag med girokort, og rykkerne koster kontoret en uge hvert kvartal. Kortoplysninger må ikke ligge hos foreningen, så betalingen går gennem udbyderen.",
          doneWhen: "80 % af kontingentbetalingerne sker i appen",
          area: "Betaling",
          themes: ["Selvbetjening", "Regulatorisk"],
          quarterOffset: 1,
          features: [
            {
              title: "Medlemmer kan betale med kort",
              description:
                "Et svar fra udbyderen kan blive væk undervejs, så den samme betaling må ikke kunne bogføres to gange. En afvist betaling skal sige hvorfor, så medlemmet ved, om det er kortet eller beløbet.",
              doneWhen: "En kortbetaling gennemføres og kvitteres inden for et minut",
            },
            {
              title: "Medlemmer kan se deres betalinger",
              description:
                "Tallene hentes fra foreningens bogholderi, ikke fra appens egne kvitteringer. Medlemmer beder jævnligt om dokumentation til deres arbejdsgiver.",
              doneWhen: "Alle betalinger fra de sidste tre år kan ses i appen",
            },
          ],
        },
        {
          title: "Medlemmer holder sig opdateret gennem appen",
          description:
            "Nyhedsbrevet på mail bliver læst af under en tiendedel af medlemmerne. Beskeder i appen skal kunne målrettes, så ingen får noget, der ikke angår dem.",
          doneWhen: "Push-beskeder åbnes af mindst en tredjedel af modtagerne",
          area: "Beskeder",
          themes: ["Fastholdelse"],
          quarterOffset: 2,
          features: [
            {
              title: "Medlemmer får push-beskeder",
              description:
                "Et medlem skal kunne sige nej til beskeder og stadig bruge resten af appen. Afsenderen skal kunne se, hvem beskeden rammer, inden den sendes.",
              doneWhen: "Beskeder kan sendes til alle eller til et arrangements deltagere",
            },
          ],
        },
        {
          title: "Medlemmer kan passe deres eget medlemskab",
          description:
            "Kontoret bruger i dag mest tid på adresseændringer og glemte medlemskort. Alt, medlemmet retter, skal slå igennem i medlemsregistret, som resten af foreningen arbejder ud fra.",
          doneWhen: "Oplysninger rettes af medlemmet selv, og medlemskortet vises i appen",
          area: "Konto",
          themes: ["Selvbetjening", "Fastholdelse"],
          quarterOffset: 0,
          closed: true,
          features: [
            {
              title: "Medlemmer kan rette deres kontaktoplysninger",
              description:
                "En ny mailadresse skal bekræftes, før den tages i brug, ellers kan et medlem låse sig selv ude. Rettelser skal også nå ud til nyhedsbrevet, som kører i et andet system.",
              doneWhen:
                "Adresse, mail og telefon kan rettes i appen og slår igennem i medlemsregistret",
              closed: true,
            },
            {
              title: "Medlemmer kan vise deres medlemskort",
              description:
                "Scannerne i hallen læser den stregkode, foreningen allerede bruger på plastikkortet. Kortet skal opdatere sig, når medlemskabet fornyes, og holde op med at virke, når det ophører.",
              doneWhen: "Medlemskortet kan vises uden net og scannes ved indgangen",
              closed: true,
            },
          ],
        },
      ],
    },
    pastSprints: [
      {
        name: "Sprint 1",
        goal: "Medlemmer kan logge ind og se deres kontingent",
        cards: [
          {
            title: "Login med MitID",
            description:
              "Login går gennem NemLog-in. Sessionen holder 30 dage, så medlemmet ikke skal igennem MitID ved hvert besøg.",
            estimate: 8,
            done: true,
            feature: "Medlemmer kan logge ind med MitID",
          },
          {
            title: "Kontingentoversigt",
            description:
              "Tallene hentes fra medlemsregistret om natten, så en betaling først er synlig dagen efter. Restancer står øverst.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan logge ind med MitID",
          },
          {
            title: "Skift adgangskode",
            description:
              "Kun for de medlemmer, der stadig logger ind med mail og adgangskode i stedet for MitID.",
            estimate: 2,
            done: true,
            feature: "Medlemmer kan logge ind med MitID",
          },
          {
            title: "Profilbillede",
            description:
              "Billedet beskæres og skaleres på telefonen, før det sendes, så billeder direkte fra kameraet ikke fylder serveren op.",
            estimate: 3,
            done: false,
            area: "Konto",
          },
        ],
      },
      {
        name: "Sprint 2",
        goal: "Tilmelding til arrangementer",
        cards: [
          {
            title: "Liste over kommende arrangementer",
            description:
              "Sorteret efter dato, og et arrangement falder af listen ved midnat samme dag. Antallet af ledige pladser står på hver række.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Tilmeld og afmeld",
            description:
              "En tilmelding optager en plads med det samme. Afmelding er mulig indtil den frist, arrangøren har sat.",
            estimate: 8,
            done: true,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Påmindelse dagen før",
            description:
              "Sendes som mail klokken 16 dagen før, da push-beskeder endnu ikke findes.",
            estimate: 3,
            done: true,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Venteliste",
            description:
              "Den første i køen får pladsen og besked på mail, så snart nogen melder fra. Arrangøren tildeler ikke pladser manuelt.",
            estimate: 5,
            done: false,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Profilbillede",
            description:
              "Billedet beskæres og skaleres på telefonen, før det sendes, så billeder direkte fra kameraet ikke fylder serveren op.",
            estimate: 3,
            done: true,
            area: "Konto",
          },
        ],
      },
      {
        name: "Sprint 3",
        goal: "Medlemmer retter selv deres oplysninger",
        cards: [
          {
            title: "Ret adresse og telefonnummer",
            description:
              "Adressen slås op i det danske adresseregister, så den bliver skrevet ens for alle medlemmer.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan rette deres kontaktoplysninger",
          },
          {
            title: "Bekræft ny mailadresse",
            description:
              "Linket gælder et døgn, og den gamle adresse bruges videre, indtil den nye er bekræftet.",
            estimate: 3,
            done: true,
            feature: "Medlemmer kan rette deres kontaktoplysninger",
          },
          {
            title: "Ændringer sendes til medlemsregistret",
            description:
              "Registrets grænseflade er kun oppe i dagtimerne, så ændringer lægges i kø og sendes igen, til de går igennem.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan rette deres kontaktoplysninger",
          },
          {
            title: "Adressen gemmes ikke på Android",
            description:
              "Tastaturet lukkede formularen, før feltet blev gemt. Kun på Android 13 og nyere.",
            estimate: 2,
            done: true,
            feature: "Medlemmer kan rette deres kontaktoplysninger",
            bug: true,
          },
          {
            title: "Slet min konto",
            description:
              "Bogføringsloven kræver, at betalinger gemmes i fem år, så medlemmet anonymiseres i stedet for at blive slettet.",
            estimate: 5,
            done: false,
            area: "Konto",
          },
        ],
      },
      {
        name: "Sprint 4",
        goal: "Medlemskortet ligger i telefonen",
        cards: [
          {
            title: "Medlemskort med stregkode",
            description:
              "Stregkoden er Code 128 med medlemsnummeret, fordi det er det, scannerne ved indgangen kan læse.",
            estimate: 8,
            done: true,
            feature: "Medlemmer kan vise deres medlemskort",
          },
          {
            title: "Medlemskortet virker uden net",
            description:
              "Kortet gemmes signeret på telefonen og udløber efter syv dage, så et opsagt medlemskab ikke kan bruges videre.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan vise deres medlemskort",
          },
          {
            title: "Scanning ved indgangen",
            description:
              "Frivillige scanner med foreningens håndscannere. Skærmen viser navn og grønt eller rødt, så køen ikke går i stå.",
            estimate: 3,
            done: true,
            feature: "Medlemmer kan vise deres medlemskort",
          },
          {
            title: "Medlemskort i Apple Wallet",
            description:
              "Kortet udstedes som en pkpass-fil signeret med foreningens certifikat og opdaterer sig selv, når kontingentet er betalt.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan vise deres medlemskort",
          },
          {
            title: "Automatiske tests af medlemskortet",
            description:
              "Testene kører i en emulator uden net og tjekker både stregkoden og udløbet efter syv dage. De er sat på pipelinen, så ingen skal huske at køre dem.",
            estimate: 3,
            done: false,
            area: "Konto",
            enabler: "architecture",
          },
        ],
      },
      {
        name: "Sprint 5",
        goal: "Programmet for et arrangement i appen",
        cards: [
          {
            title: "Side for et arrangement",
            description:
              "Tid, sted og tilmeldingsknap øverst, resten af teksten nedenunder. Siden kan åbnes direkte fra linket i påmindelsesmailen.",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan se programmet for et arrangement",
          },
          {
            title: "Program med tider og oplægsholdere",
            description:
              "Punkterne står i tidsrækkefølge, og to spor, der kører samtidig, vises ved siden af hinanden.",
            estimate: 8,
            done: true,
            feature: "Medlemmer kan se programmet for et arrangement",
          },
          {
            title: "Praktisk info på arrangementssiden",
            description:
              "Parkering, forplejning og hvad man selv skal have med. Arrangøren skriver teksten og kan rette den, til arrangementet begynder.",
            estimate: 3,
            done: true,
            feature: "Medlemmer kan se programmet for et arrangement",
          },
          {
            title: "Automatiske tests af medlemskortet",
            description:
              "Testene kører i en emulator uden net og tjekker både stregkoden og udløbet efter syv dage. De er sat på pipelinen, så ingen skal huske at køre dem.",
            estimate: 3,
            done: true,
            area: "Konto",
            enabler: "architecture",
          },
          {
            title: "Kort og vejvisning til stedet",
            description:
              "Et statisk kort på siden og en knap, der åbner telefonens eget kortprogram, så vi slipper for en nøgle til en korttjeneste.",
            estimate: 5,
            done: false,
            area: "Arrangementer",
          },
        ],
      },
      {
        name: "Sprint 6",
        goal: "Arrangementer er nemme at finde og planlægge",
        cards: [
          {
            title: "Kort og vejvisning til stedet",
            description:
              "Et statisk kort på siden og en knap, der åbner telefonens eget kortprogram, så vi slipper for en nøgle til en korttjeneste.",
            estimate: 5,
            done: true,
            area: "Arrangementer",
          },
          {
            title: "Søg og filtrér i arrangementerne",
            description:
              "Fritekst på titel og beskrivelse plus filtre på dato og sted. Søgningen kører i databasen, så der er ingen søgemaskine at drifte.",
            estimate: 8,
            done: true,
            area: "Arrangementer",
          },
          {
            title: "Tilføj arrangement til kalenderen",
            description:
              "Appen laver en ics-fil. Den opdaterer sig ikke bagefter, så en flyttet dato meldes stadig ud på mail.",
            estimate: 5,
            done: true,
            area: "Arrangementer",
          },
          {
            title: "Billeder i programmet vender forkert",
            description:
              "Skaleringen smed billedets exif-orientering væk, så telefonbilleder lå ned. Rettet i det trin, der laver miniaturerne.",
            estimate: 2,
            done: true,
            feature: "Medlemmer kan se programmet for et arrangement",
            bug: true,
          },
          {
            title: "Testmiljø hos betalingsudbyderen",
            description:
              "Konto, testkort og nøgler i udbyderens sandkasse, så betalingerne kan prøves af uden rigtige penge.",
            estimate: 3,
            done: true,
            feature: "Medlemmer kan betale med kort",
            enabler: "infrastructure",
          },
          {
            title: "Deltagerliste til arrangøren",
            description:
              "Kun arrangøren kan se listen, og den kan hentes som regneark til afkrydsning ved indgangen.",
            estimate: 3,
            done: false,
            area: "Arrangementer",
          },
        ],
      },
    ],
    activeSprint: {
      name: "Sprint 7",
      goal: "Betaling af kontingent direkte i appen",
      cards: [
        {
          title: "Vælg betalingsmetode",
          description:
            "Kun kort i første omgang, men skærmen er bygget, så MobilePay kan komme til uden at flowet laves om. Valget huskes til næste betaling.",
          estimate: 3,
          state: "done",
          mine: true,
          feature: "Medlemmer kan betale med kort",
        },
        {
          title: "Betal med kort",
          description:
            "Betalingen sker i udbyderens vindue med 3D Secure, så vi aldrig håndterer kortnumre selv. Det svære er at få medlemmet tilbage i appen bagefter, selv når bank-appen tager et minut.",
          estimate: 8,
          state: "doing",
          priority: "high",
          mine: true,
          feature: "Medlemmer kan betale med kort",
        },
        {
          title: "Kvittering på mail",
          description:
            "Kvitteringen skal kunne bruges som bilag, så foreningens CVR-nummer og beløbet står på den. Den sendes, når udbyderen bekræfter betalingen, ikke når appen tror, den gik igennem.",
          estimate: 2,
          state: "done",
          feature: "Medlemmer kan betale med kort",
        },
        {
          title: "Betalingshistorik",
          description:
            "De ældste betalinger står kun i medlemsregistret, så listen skal hente fra to kilder og vise dem som én. Kvitteringen kan hentes frem igen fra hver linje.",
          estimate: 5,
          state: "doing",
          feature: "Medlemmer kan se deres betalinger",
        },
        {
          title: "Venteliste",
          description:
            "Den første i køen får pladsen og besked på mail, så snart nogen melder fra. Arrangøren tildeler ikke pladser manuelt.",
          estimate: 5,
          state: "todo",
          feature: "Medlemmer kan tilmelde og afmelde sig",
        },
        {
          title: "Fejlbeskeder når betalingen afvises",
          description:
            "Udbyderens fejlkoder står råt på skærmen i dag. De skal oversættes til noget, medlemmet kan gøre noget ved, uden at røbe mere om kortet end banken selv gør.",
          estimate: 3,
          state: "todo",
          feature: "Medlemmer kan betale med kort",
          bug: true,
        },
      ],
    },
    backlog: [
      {
        title: "Push-beskeder",
        description:
          "Kræver tilladelse fra medlemmet på både iOS og Android og en nøgle pr. telefon, som skal ryddes op, når en telefon skiftes ud. Selve afsendelsen sker fra administrationen, ikke fra appen.",
        estimate: 8,
        feature: "Medlemmer får push-beskeder",
      },
      {
        title: "Del et arrangement",
        description:
          "Telefonens egen delefunktion med et link til arrangementets side. Siden skal kunne åbnes uden login, ellers er der ikke meget ved at dele den.",
        estimate: 2,
        area: "Arrangementer",
      },
      {
        title: "Mørkt tema",
        description:
          "Følger telefonens indstilling, med mulighed for at låse den fast på lyst eller mørkt. Medlemskortets stregkode skal blive ved med at være læsbar for scanneren ved indgangen.",
        estimate: 3,
        area: "Konto",
      },
      {
        title: "Familiemedlemskab",
        description:
          "Flere personer under ét kontingent betyder et medlemskort og en tilmelding pr. person, men kun én betaler. Arbejdet rører både medlemsregistret og betalingen, og de tretten point er et gæt, indtil det er skåret op.",
        estimate: 13,
        area: "Konto",
      },
      {
        title: "Automatiske tests af login-flowet",
        description:
          "Et rigtigt MitID-login kan ikke køre i en test, så flowet må køre mod udbyderens testmiljø. I dag gennemgår vi det samme login i hånden før hver udgivelse.",
        estimate: 5,
        area: "Konto",
        enabler: "architecture",
      },
      {
        title: "Engelsk sprogversion",
        description:
          "Teksterne skal først ud af koden, og så er der indholdet fra administrationen — arrangementer og beskeder skrives kun på dansk i dag. Derfor er der ikke sat point på endnu.",
        estimate: null,
        area: "Konto",
      },
    ],
    plannedSprint: { name: "Sprint 8", goal: "Beskeder til medlemmerne" },
    releases: [
      { name: "1.0 Login og kontingent", dayOffset: -84 },
      { name: "1.1 Min side", dayOffset: -56 },
      { name: "1.2 Arrangementer", dayOffset: -28 },
      { name: "1.3 Betaling i appen", dayOffset: 14 },
    ],
  },
};
