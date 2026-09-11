import type { Priority } from "@/core/db/schema";

/**
 * The demo's content in both languages. Ordinary work a small team would
 * recognise: a webshop run as a flow, an app built in sprints.
 */

export type DemoCard = {
  title: string;
  description?: string;
  column: "backlog" | "todo" | "doing" | "done";
  estimate?: number;
  priority?: Priority;
  dueOffset?: number;
  checklist?: string[];
  blocked?: string;
};

export type DemoWords = {
  kanban: { name: string; key: string; description: string; cards: DemoCard[]; comment: string };
  scrum: {
    name: string;
    key: string;
    description: string;
    pastSprints: Array<{
      name: string;
      goal: string;
      cards: Array<{ title: string; estimate: number; done: boolean }>;
    }>;
    activeSprint: {
      name: string;
      goal: string;
      cards: Array<{
        title: string;
        estimate: number;
        state: "todo" | "doing" | "done";
        priority?: Priority;
        mine?: boolean;
      }>;
    };
    backlog: Array<{ title: string; estimate: number | null }>;
    plannedSprint: { name: string; goal: string };
  };
};

export const DEMO_DA: DemoWords = {
  kanban: {
    name: "Webshop",
    key: "WEB",
    description:
      "Drift og forbedringer af webshoppen. Løbende flow, højst tre ting i gang ad gangen.",
    cards: [
      {
        title: "Kunder kan ikke betale med MobilePay på iPhone",
        column: "doing",
        priority: "urgent",
        estimate: 3,
        description: "Fejlen opstår efter man vender tilbage fra MobilePay-appen. Kurven er tom.",
        checklist: ["Genskab fejlen", "Find årsagen", "Ret og test på rigtig telefon"],
        dueOffset: 1,
      },
      { title: "Nyhedsbrev-tilmelding i footeren", column: "doing", estimate: 2, dueOffset: 4 },
      {
        title: "Hurtigere billeder på produktsiderne",
        column: "doing",
        estimate: 5,
        blocked: "Venter på nye billeder fra fotografen",
      },
      { title: "Sortering efter pris i kategorierne", column: "doing", estimate: 3 },
      { title: "Gavekort som betalingsmiddel", column: "todo", estimate: 8, priority: "high" },
      { title: "Opdatér handelsbetingelserne", column: "todo", estimate: 1, dueOffset: -2 },
      { title: "Sæson-banner til forsiden", column: "todo", estimate: 2 },
      { title: "Returformular kunden kan udfylde selv", column: "backlog", estimate: 5 },
      { title: "Ønskeliste", column: "backlog" },
      { title: "Produktanmeldelser", column: "backlog", estimate: 8 },
      { title: "Levering til pakkeshop", column: "done", estimate: 5 },
      { title: "Rabatkoder", column: "done", estimate: 3 },
      { title: "Søgning der tåler stavefejl", column: "done", estimate: 5 },
      { title: "Cookie-banner der ikke er irriterende", column: "done", estimate: 2 },
      { title: "Ordrebekræftelse på mail", column: "done", estimate: 3 },
    ],
    comment: "Jeg kan genskabe fejlen på min egen telefon. Kigger på det i dag.",
  },
  scrum: {
    name: "Medlemsapp",
    key: "APP",
    description: "Foreningens app til medlemmerne. To ugers sprints, demo hver anden fredag.",
    pastSprints: [
      {
        name: "Sprint 1",
        goal: "Medlemmer kan logge ind og se deres kontingent",
        cards: [
          { title: "Login med MitID", estimate: 8, done: true },
          { title: "Kontingentoversigt", estimate: 5, done: true },
          { title: "Skift adgangskode", estimate: 2, done: true },
          { title: "Profilbillede", estimate: 3, done: false },
        ],
      },
      {
        name: "Sprint 2",
        goal: "Tilmelding til arrangementer",
        cards: [
          { title: "Liste over kommende arrangementer", estimate: 5, done: true },
          { title: "Tilmeld og afmeld", estimate: 8, done: true },
          { title: "Påmindelse dagen før", estimate: 3, done: true },
          { title: "Venteliste", estimate: 5, done: false },
          { title: "Profilbillede", estimate: 3, done: true },
        ],
      },
    ],
    activeSprint: {
      name: "Sprint 3",
      goal: "Betaling af kontingent direkte i appen",
      cards: [
        { title: "Vælg betalingsmetode", estimate: 3, state: "done", mine: true },
        { title: "Betal med kort", estimate: 8, state: "doing", priority: "high", mine: true },
        { title: "Kvittering på mail", estimate: 2, state: "done" },
        { title: "Betalingshistorik", estimate: 5, state: "doing" },
        { title: "Venteliste", estimate: 5, state: "todo" },
        { title: "Fejlbeskeder når betalingen afvises", estimate: 3, state: "todo" },
      ],
    },
    backlog: [
      { title: "Push-beskeder", estimate: 8 },
      { title: "Mørkt tema", estimate: 3 },
      { title: "Del et arrangement", estimate: 2 },
      { title: "Familiemedlemskab", estimate: 13 },
      { title: "Engelsk sprogversion", estimate: null },
    ],
    plannedSprint: { name: "Sprint 4", goal: "Beskeder til medlemmerne" },
  },
};

export const DEMO_EN: DemoWords = {
  kanban: {
    name: "Webshop",
    key: "WEB",
    description:
      "Running and improving the webshop. Continuous flow, at most three things in progress.",
    cards: [
      {
        title: "Customers cannot pay with MobilePay on iPhone",
        column: "doing",
        priority: "urgent",
        estimate: 3,
        description: "Happens after returning from the MobilePay app. The basket is empty.",
        checklist: ["Reproduce it", "Find the cause", "Fix and test on a real phone"],
        dueOffset: 1,
      },
      { title: "Newsletter sign-up in the footer", column: "doing", estimate: 2, dueOffset: 4 },
      {
        title: "Faster images on product pages",
        column: "doing",
        estimate: 5,
        blocked: "Waiting for new photos from the photographer",
      },
      { title: "Sort by price in categories", column: "doing", estimate: 3 },
      { title: "Gift cards as a payment method", column: "todo", estimate: 8, priority: "high" },
      { title: "Update the terms of sale", column: "todo", estimate: 1, dueOffset: -2 },
      { title: "Seasonal banner on the front page", column: "todo", estimate: 2 },
      { title: "Return form customers fill in themselves", column: "backlog", estimate: 5 },
      { title: "Wish list", column: "backlog" },
      { title: "Product reviews", column: "backlog", estimate: 8 },
      { title: "Delivery to parcel shops", column: "done", estimate: 5 },
      { title: "Discount codes", column: "done", estimate: 3 },
      { title: "Search that tolerates typos", column: "done", estimate: 5 },
      { title: "A cookie banner that is not annoying", column: "done", estimate: 2 },
      { title: "Order confirmation by mail", column: "done", estimate: 3 },
    ],
    comment: "I can reproduce this on my own phone. Looking at it today.",
  },
  scrum: {
    name: "Member app",
    key: "APP",
    description:
      "The association's app for its members. Two-week sprints, demo every other Friday.",
    pastSprints: [
      {
        name: "Sprint 1",
        goal: "Members can log in and see their membership fee",
        cards: [
          { title: "Login with MitID", estimate: 8, done: true },
          { title: "Fee overview", estimate: 5, done: true },
          { title: "Change password", estimate: 2, done: true },
          { title: "Profile picture", estimate: 3, done: false },
        ],
      },
      {
        name: "Sprint 2",
        goal: "Signing up for events",
        cards: [
          { title: "List of upcoming events", estimate: 5, done: true },
          { title: "Sign up and cancel", estimate: 8, done: true },
          { title: "Reminder the day before", estimate: 3, done: true },
          { title: "Waiting list", estimate: 5, done: false },
          { title: "Profile picture", estimate: 3, done: true },
        ],
      },
    ],
    activeSprint: {
      name: "Sprint 3",
      goal: "Paying the membership fee in the app",
      cards: [
        { title: "Choose a payment method", estimate: 3, state: "done", mine: true },
        { title: "Pay by card", estimate: 8, state: "doing", priority: "high", mine: true },
        { title: "Receipt by mail", estimate: 2, state: "done" },
        { title: "Payment history", estimate: 5, state: "doing" },
        { title: "Waiting list", estimate: 5, state: "todo" },
        { title: "Error messages when a payment is declined", estimate: 3, state: "todo" },
      ],
    },
    backlog: [
      { title: "Push notifications", estimate: 8 },
      { title: "Dark theme", estimate: 3 },
      { title: "Share an event", estimate: 2 },
      { title: "Family membership", estimate: 13 },
      { title: "English language version", estimate: null },
    ],
    plannedSprint: { name: "Sprint 4", goal: "Messages to members" },
  },
};
