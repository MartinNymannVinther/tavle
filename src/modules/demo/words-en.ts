import type { DemoWords } from "./words";

/** The demo in English, the same boards word for word. */
export const DEMO_EN: DemoWords = {
  kanban: {
    name: "Webshop",
    key: "WEB",
    description:
      "Running and improving the webshop. Continuous flow, at most three things in progress.",
    structure: {
      areas: ["Payments", "Catalogue", "Delivery", "Front page", "Platform"],
      themes: [
        { name: "Self-service", color: "moss" },
        { name: "Conversion", color: "clay" },
        { name: "Stable operations", color: "sage" },
      ],
      epics: [
        {
          title: "Customers can pay the way they want",
          doneWhen: "MobilePay, cards and gift cards work in checkout on every device",
          area: "Payments",
          themes: ["Conversion", "Self-service"],
          quarterOffset: 1,
          features: [
            {
              title: "Customers can pay with MobilePay on every device",
              doneWhen: "The payment completes on iPhone and Android without emptying the basket",
            },
            {
              title: "Customers can pay with gift cards",
              doneWhen: "A gift card can be redeemed in full or in part in checkout",
            },
          ],
        },
        {
          title: "Customers find the product without searching",
          doneWhen: "Search and sorting are used in 40 % of sessions and the return rate drops",
          area: "Catalogue",
          themes: ["Conversion"],
          quarterOffset: 2,
          agedDays: 200,
          features: [
            {
              title: "Customers can sort and filter the categories",
              doneWhen: "Price, popularity and newness can be chosen on every category page",
            },
            {
              title: "Customers can read and write reviews",
              doneWhen: "Reviews show on the product page and can be written after a purchase",
            },
          ],
        },
        {
          title: "We can deploy without downtime",
          doneWhen: "Three deployments in a row with no downtime and no manual steps",
          area: "Platform",
          themes: ["Stable operations"],
          enabler: "infrastructure",
          features: [
            {
              title: "Deployment happens automatically from main",
              doneWhen: "A green pipeline deploys without anybody pressing anything",
            },
          ],
        },
      ],
    },
    cards: [
      {
        title: "Customers cannot pay with MobilePay on iPhone",
        column: "doing",
        priority: "urgent",
        estimate: 3,
        description: "Happens after returning from the MobilePay app. The basket is empty.",
        checklist: ["Reproduce it", "Find the cause", "Fix and test on a real phone"],
        dueOffset: 1,
        feature: "Customers can pay with MobilePay on every device",
        bug: true,
      },
      {
        title: "Newsletter sign-up in the footer",
        column: "doing",
        estimate: 2,
        dueOffset: 4,
        area: "Front page",
      },
      {
        title: "Faster images on product pages",
        column: "doing",
        estimate: 5,
        blocked: "Waiting for new photos from the photographer",
        area: "Catalogue",
      },
      {
        title: "Sort by price in categories",
        column: "doing",
        estimate: 3,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Gift cards can be redeemed in checkout",
        column: "todo",
        estimate: 8,
        priority: "high",
        feature: "Customers can pay with gift cards",
      },
      {
        title: "Update the terms of sale",
        column: "todo",
        estimate: 1,
        dueOffset: -2,
        area: "Front page",
      },
      {
        title: "Blue/green setup of the web servers",
        column: "todo",
        estimate: 5,
        feature: "Deployment happens automatically from main",
        enabler: "infrastructure",
      },
      {
        title: "Seasonal banner on the front page",
        column: "todo",
        estimate: 2,
        area: "Front page",
      },
      {
        title: "Return form customers fill in themselves",
        column: "backlog",
        estimate: 5,
        area: "Delivery",
      },
      {
        title: "Filter by size and colour",
        column: "backlog",
        estimate: 5,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Write a review after a purchase",
        column: "backlog",
        estimate: 8,
        feature: "Customers can read and write reviews",
      },
      { title: "Wish list", column: "backlog", area: "Catalogue" },
      {
        title: "Gift cards can be bought as a gift",
        column: "backlog",
        estimate: 5,
        feature: "Customers can pay with gift cards",
      },
      { title: "Delivery to parcel shops", column: "done", estimate: 5, area: "Delivery" },
      { title: "Discount codes", column: "done", estimate: 3, area: "Payments" },
      { title: "Search that tolerates typos", column: "done", estimate: 5, area: "Catalogue" },
      {
        title: "A cookie banner that is not annoying",
        column: "done",
        estimate: 2,
        area: "Front page",
      },
      { title: "Order confirmation by mail", column: "done", estimate: 3, area: "Payments" },
    ],
    comment: "I can reproduce this on my own phone. Looking at it today.",
  },
  scrum: {
    name: "Member app",
    key: "APP",
    description:
      "The association's app for its members. Two-week sprints, demo every other Friday.",
    structure: {
      areas: ["Account", "Events", "Payment", "Messages"],
      themes: [
        { name: "Self-service", color: "moss" },
        { name: "Retention", color: "clay" },
        { name: "Regulatory", color: "rust" },
      ],
      epics: [
        {
          title: "Members can log in and see their membership",
          doneWhen: "90 % of members have logged in and seen their fee",
          area: "Account",
          themes: ["Self-service"],
          closed: true,
          features: [
            {
              title: "Members can log in with MitID",
              doneWhen: "Login works on iOS and Android and the fee is shown",
              closed: true,
            },
          ],
        },
        {
          title: "Members can sign up for events in the app",
          doneWhen: "Half of all sign-ups come from the app",
          area: "Events",
          themes: ["Retention"],
          quarterOffset: 0,
          features: [
            {
              title: "Members can sign up and cancel",
              doneWhen: "Sign-up, cancellation, reminder and waiting list all work",
            },
          ],
        },
        {
          title: "Members can pay their fee in the app",
          doneWhen: "80 % of fee payments happen in the app",
          area: "Payment",
          themes: ["Self-service", "Regulatory"],
          quarterOffset: 1,
          features: [
            {
              title: "Members can pay by card",
              doneWhen: "A card payment completes and is receipted within a minute",
            },
            {
              title: "Members can see their payments",
              doneWhen: "Every payment from the last three years can be seen in the app",
            },
          ],
        },
        {
          title: "Members keep up to date through the app",
          doneWhen: "Push notifications are opened by at least a third of recipients",
          area: "Messages",
          themes: ["Retention"],
          quarterOffset: 2,
          features: [
            {
              title: "Members get push notifications",
              doneWhen: "Messages can be sent to everyone or to an event's participants",
            },
          ],
        },
      ],
    },
    pastSprints: [
      {
        name: "Sprint 1",
        goal: "Members can log in and see their membership fee",
        cards: [
          {
            title: "Login with MitID",
            estimate: 8,
            done: true,
            feature: "Members can log in with MitID",
          },
          {
            title: "Fee overview",
            estimate: 5,
            done: true,
            feature: "Members can log in with MitID",
          },
          {
            title: "Change password",
            estimate: 2,
            done: true,
            feature: "Members can log in with MitID",
          },
          { title: "Profile picture", estimate: 3, done: false, area: "Account" },
        ],
      },
      {
        name: "Sprint 2",
        goal: "Signing up for events",
        cards: [
          {
            title: "List of upcoming events",
            estimate: 5,
            done: true,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Sign up and cancel",
            estimate: 8,
            done: true,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Reminder the day before",
            estimate: 3,
            done: true,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Waiting list",
            estimate: 5,
            done: false,
            feature: "Members can sign up and cancel",
          },
          { title: "Profile picture", estimate: 3, done: true, area: "Account" },
        ],
      },
    ],
    activeSprint: {
      name: "Sprint 3",
      goal: "Paying the membership fee in the app",
      cards: [
        {
          title: "Choose a payment method",
          estimate: 3,
          state: "done",
          mine: true,
          feature: "Members can pay by card",
        },
        {
          title: "Pay by card",
          estimate: 8,
          state: "doing",
          priority: "high",
          mine: true,
          feature: "Members can pay by card",
        },
        {
          title: "Receipt by mail",
          estimate: 2,
          state: "done",
          feature: "Members can pay by card",
        },
        {
          title: "Payment history",
          estimate: 5,
          state: "doing",
          feature: "Members can see their payments",
        },
        {
          title: "Waiting list",
          estimate: 5,
          state: "todo",
          feature: "Members can sign up and cancel",
        },
        {
          title: "Error messages when a payment is declined",
          estimate: 3,
          state: "todo",
          feature: "Members can pay by card",
          bug: true,
        },
      ],
    },
    backlog: [
      { title: "Push notifications", estimate: 8, feature: "Members get push notifications" },
      { title: "Share an event", estimate: 2, area: "Events" },
      { title: "Dark theme", estimate: 3, area: "Account" },
      { title: "Family membership", estimate: 13, area: "Account" },
      {
        title: "Automated tests of the login flow",
        estimate: 5,
        area: "Account",
        enabler: "architecture",
      },
      { title: "English language version", estimate: null, area: "Account" },
    ],
    plannedSprint: { name: "Sprint 4", goal: "Messages to members" },
  },
};
