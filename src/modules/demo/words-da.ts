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
          doneWhen: "MobilePay, kort og gavekort virker i checkout på alle enheder",
          area: "Betalinger",
          themes: ["Konvertering", "Selvbetjening"],
          quarterOffset: 1,
          features: [
            {
              title: "Kunder kan betale med MobilePay på alle enheder",
              doneWhen: "Betalingen gennemføres på iPhone og Android uden at kurven tømmes",
            },
            {
              title: "Kunder kan betale med gavekort",
              doneWhen: "Et gavekort kan indløses helt eller delvist i checkout",
            },
          ],
        },
        {
          title: "Kunder finder varen uden at lede",
          doneWhen: "Søgning og sortering bruges i 40 % af sessionerne og returraten falder",
          area: "Katalog",
          themes: ["Konvertering"],
          quarterOffset: 2,
          agedDays: 200,
          features: [
            {
              title: "Kunder kan sortere og filtrere kategorierne",
              doneWhen: "Pris, popularitet og nyhed kan vælges på alle kategorisider",
            },
            {
              title: "Kunder kan læse og skrive anmeldelser",
              doneWhen: "Anmeldelser vises på produktsiden og kan skrives efter et køb",
            },
          ],
        },
        {
          title: "Vi kan udrulle uden nedetid",
          doneWhen: "Tre udrulninger i træk uden nedetid og uden manuelle trin",
          area: "Platform",
          themes: ["Stabil drift"],
          enabler: "infrastructure",
          features: [
            {
              title: "Udrulning sker automatisk fra main",
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
        column: "doing",
        estimate: 2,
        dueOffset: 4,
        area: "Forside",
      },
      {
        title: "Hurtigere billeder på produktsiderne",
        column: "doing",
        estimate: 5,
        blocked: "Venter på nye billeder fra fotografen",
        area: "Katalog",
      },
      {
        title: "Sortering efter pris i kategorierne",
        column: "doing",
        estimate: 3,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Gavekort kan indløses i checkout",
        column: "todo",
        estimate: 8,
        priority: "high",
        feature: "Kunder kan betale med gavekort",
      },
      {
        title: "Opdatér handelsbetingelserne",
        column: "todo",
        estimate: 1,
        dueOffset: -2,
        area: "Forside",
      },
      {
        title: "Blue/green-opsætning af webserverne",
        column: "todo",
        estimate: 5,
        feature: "Udrulning sker automatisk fra main",
        enabler: "infrastructure",
      },
      {
        title: "Sæson-banner til forsiden",
        column: "todo",
        estimate: 2,
        area: "Forside",
      },
      {
        title: "Returformular kunden kan udfylde selv",
        column: "backlog",
        estimate: 5,
        area: "Levering",
      },
      {
        title: "Filtrér på størrelse og farve",
        column: "backlog",
        estimate: 5,
        feature: "Kunder kan sortere og filtrere kategorierne",
      },
      {
        title: "Skriv en anmeldelse efter et køb",
        column: "backlog",
        estimate: 8,
        feature: "Kunder kan læse og skrive anmeldelser",
      },
      { title: "Ønskeliste", column: "backlog", area: "Katalog" },
      {
        title: "Gavekort kan købes som gave",
        column: "backlog",
        estimate: 5,
        feature: "Kunder kan betale med gavekort",
      },
      { title: "Levering til pakkeshop", column: "done", estimate: 5, area: "Levering" },
      { title: "Rabatkoder", column: "done", estimate: 3, area: "Betalinger" },
      { title: "Søgning der tåler stavefejl", column: "done", estimate: 5, area: "Katalog" },
      {
        title: "Cookie-banner der ikke er irriterende",
        column: "done",
        estimate: 2,
        area: "Forside",
      },
      { title: "Ordrebekræftelse på mail", column: "done", estimate: 3, area: "Betalinger" },
    ],
    comment: "Jeg kan genskabe fejlen på min egen telefon. Kigger på det i dag.",
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
          doneWhen: "90 % af medlemmerne har logget ind og set deres kontingent",
          area: "Konto",
          themes: ["Selvbetjening"],
          closed: true,
          features: [
            {
              title: "Medlemmer kan logge ind med MitID",
              doneWhen: "Login virker på iOS og Android og kontingentet vises",
              closed: true,
            },
          ],
        },
        {
          title: "Medlemmer kan tilmelde sig arrangementer i appen",
          doneWhen: "Halvdelen af tilmeldingerne kommer fra appen",
          area: "Arrangementer",
          themes: ["Fastholdelse"],
          quarterOffset: 0,
          features: [
            {
              title: "Medlemmer kan tilmelde og afmelde sig",
              doneWhen: "Tilmelding, afmelding, påmindelse og venteliste virker",
            },
          ],
        },
        {
          title: "Medlemmer kan betale kontingent i appen",
          doneWhen: "80 % af kontingentbetalingerne sker i appen",
          area: "Betaling",
          themes: ["Selvbetjening", "Regulatorisk"],
          quarterOffset: 1,
          features: [
            {
              title: "Medlemmer kan betale med kort",
              doneWhen: "En kortbetaling gennemføres og kvitteres inden for et minut",
            },
            {
              title: "Medlemmer kan se deres betalinger",
              doneWhen: "Alle betalinger fra de sidste tre år kan ses i appen",
            },
          ],
        },
        {
          title: "Medlemmer holder sig opdateret gennem appen",
          doneWhen: "Push-beskeder åbnes af mindst en tredjedel af modtagerne",
          area: "Beskeder",
          themes: ["Fastholdelse"],
          quarterOffset: 2,
          features: [
            {
              title: "Medlemmer får push-beskeder",
              doneWhen: "Beskeder kan sendes til alle eller til et arrangements deltagere",
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
            estimate: 8,
            done: true,
            feature: "Medlemmer kan logge ind med MitID",
          },
          {
            title: "Kontingentoversigt",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan logge ind med MitID",
          },
          {
            title: "Skift adgangskode",
            estimate: 2,
            done: true,
            feature: "Medlemmer kan logge ind med MitID",
          },
          { title: "Profilbillede", estimate: 3, done: false, area: "Konto" },
        ],
      },
      {
        name: "Sprint 2",
        goal: "Tilmelding til arrangementer",
        cards: [
          {
            title: "Liste over kommende arrangementer",
            estimate: 5,
            done: true,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Tilmeld og afmeld",
            estimate: 8,
            done: true,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Påmindelse dagen før",
            estimate: 3,
            done: true,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          {
            title: "Venteliste",
            estimate: 5,
            done: false,
            feature: "Medlemmer kan tilmelde og afmelde sig",
          },
          { title: "Profilbillede", estimate: 3, done: true, area: "Konto" },
        ],
      },
    ],
    activeSprint: {
      name: "Sprint 3",
      goal: "Betaling af kontingent direkte i appen",
      cards: [
        {
          title: "Vælg betalingsmetode",
          estimate: 3,
          state: "done",
          mine: true,
          feature: "Medlemmer kan betale med kort",
        },
        {
          title: "Betal med kort",
          estimate: 8,
          state: "doing",
          priority: "high",
          mine: true,
          feature: "Medlemmer kan betale med kort",
        },
        {
          title: "Kvittering på mail",
          estimate: 2,
          state: "done",
          feature: "Medlemmer kan betale med kort",
        },
        {
          title: "Betalingshistorik",
          estimate: 5,
          state: "doing",
          feature: "Medlemmer kan se deres betalinger",
        },
        {
          title: "Venteliste",
          estimate: 5,
          state: "todo",
          feature: "Medlemmer kan tilmelde og afmelde sig",
        },
        {
          title: "Fejlbeskeder når betalingen afvises",
          estimate: 3,
          state: "todo",
          feature: "Medlemmer kan betale med kort",
          bug: true,
        },
      ],
    },
    backlog: [
      { title: "Push-beskeder", estimate: 8, feature: "Medlemmer får push-beskeder" },
      { title: "Del et arrangement", estimate: 2, area: "Arrangementer" },
      { title: "Mørkt tema", estimate: 3, area: "Konto" },
      { title: "Familiemedlemskab", estimate: 13, area: "Konto" },
      {
        title: "Automatiske tests af login-flowet",
        estimate: 5,
        area: "Konto",
        enabler: "architecture",
      },
      { title: "Engelsk sprogversion", estimate: null, area: "Konto" },
    ],
    plannedSprint: { name: "Sprint 4", goal: "Beskeder til medlemmerne" },
  },
};
