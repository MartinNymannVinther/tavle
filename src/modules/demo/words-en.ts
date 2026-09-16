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
          description:
            "Half the abandoned purchases happen on the payment page because the customer's preferred method is missing. Gift cards are sold in the physical shop and have to work online on the same terms.",
          doneWhen: "MobilePay, cards and gift cards work in checkout on every device",
          area: "Payments",
          themes: ["Conversion", "Self-service"],
          quarterOffset: 1,
          features: [
            {
              title: "Customers can pay with MobilePay on every device",
              description:
                "MobilePay went live on desktop first; on a phone the customer leaves for the app and comes back, and that is where the basket is emptied. The jump has to hold even when the customer stays in the app for a couple of minutes.",
              doneWhen: "The payment completes on iPhone and Android without emptying the basket",
            },
            {
              title: "Customers can pay with gift cards",
              description:
                "The gift cards live in the shop's till system, so the balance has to be looked up there on every purchase. The card numbers are short, so they need protecting against someone guessing one.",
              doneWhen: "A gift card can be redeemed in full or in part in checkout",
            },
          ],
        },
        {
          title: "Customers find the product without searching",
          description:
            "The catalogue has grown past 2,000 items, and customers browse instead of finding what they came for. Most of the traffic comes from mobile, so it has to work on a small screen first.",
          doneWhen: "Search and sorting are used in 40 % of sessions and the return rate drops",
          area: "Catalogue",
          themes: ["Conversion"],
          quarterOffset: 2,
          agedDays: 200,
          features: [
            {
              title: "Customers can sort and filter the categories",
              description:
                "The filters have to combine and sit in the address, so a filtered list can be shared and opened again. Items with no data in a field must not drop out of the list.",
              doneWhen: "Price, popularity and newness can be chosen on every category page",
            },
            {
              title: "Customers can read and write reviews",
              description:
                "Only customers with a purchase behind them can write one, and everything passes customer service before it is shown. A review that gets reported comes down again until somebody has looked at it.",
              doneWhen: "Reviews show on the product page and can be written after a purchase",
            },
          ],
        },
        {
          title: "We can deploy without downtime",
          description:
            "Deployments are done by hand in the evening today, with the shop closed while they run. That keeps the team from fixing small things during the day.",
          doneWhen: "Three deployments in a row with no downtime and no manual steps",
          area: "Platform",
          themes: ["Stable operations"],
          enabler: "infrastructure",
          features: [
            {
              title: "Deployment happens automatically from main",
              description:
                "The pipeline has to run migrations, switch between two sets of servers and roll back again. Everything that sits in a written runbook today has to move into it.",
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
        description:
          "Only an email address and a consent box. The sign-up is passed on to the newsletter system, which sends the confirmation mail itself.",
        column: "doing",
        estimate: 2,
        dueOffset: 4,
        area: "Front page",
      },
      {
        title: "Faster images on product pages",
        description:
          "Images are served at full resolution today, whatever the screen. They need to be scaled and converted to webp before they are sent.",
        column: "doing",
        estimate: 5,
        blocked: "Waiting for new photos from the photographer",
        area: "Catalogue",
      },
      {
        title: "Sort by price in categories",
        description:
          "The sorting has to happen in the database, not in the browser — the big categories hold too many items to fetch them all.",
        column: "doing",
        estimate: 3,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Gift cards can be redeemed in checkout",
        description:
          "The balance must not be drawn until the rest of the payment is approved. Otherwise the customer loses money on a card that never became an order.",
        column: "todo",
        estimate: 8,
        priority: "high",
        feature: "Customers can pay with gift cards",
      },
      {
        title: "Update the terms of sale",
        description:
          "Our lawyer has sent new wording on the right of withdrawal and on returns. The date at the bottom of the page has to be changed too.",
        column: "todo",
        estimate: 1,
        dueOffset: -2,
        area: "Front page",
      },
      {
        title: "Blue/green setup of the web servers",
        description:
          "Two identical environments side by side, so traffic can be switched over once the new one is up. The database is shared, so a change has to tolerate both versions running.",
        column: "todo",
        estimate: 5,
        feature: "Deployment happens automatically from main",
        enabler: "infrastructure",
      },
      {
        title: "Seasonal banner on the front page",
        description:
          "Marketing must be able to set the start and end dates themselves, so we do not have to deploy to change an image.",
        column: "todo",
        estimate: 2,
        area: "Front page",
      },
      {
        title: "Return form customers fill in themselves",
        description:
          "Today the customer rings customer service, who type the return in by hand. The form has to find the order from the order number and the email address.",
        column: "backlog",
        estimate: 5,
        area: "Delivery",
      },
      {
        title: "Filter by size and colour",
        description:
          "Size and colour are free text on the variants, where XL, xl and X-large are the same size. The values have to be cleaned up before they can be filtered on.",
        column: "backlog",
        estimate: 5,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Write a review after a purchase",
        description:
          "Only customers with a delivered order for the item may write one. Customer service approves the review before it shows.",
        column: "backlog",
        estimate: 8,
        feature: "Customers can read and write reviews",
      },
      {
        title: "Wish list",
        description:
          "It has to work without a login, so the list lives on the session and has to move across when the customer signs up.",
        column: "backlog",
        area: "Catalogue",
      },
      {
        title: "Gift cards can be bought as a gift",
        description:
          "The buyer picks an amount and a recipient, and the code is mailed on a chosen date. The card must not work before that date.",
        column: "backlog",
        estimate: 5,
        feature: "Customers can pay with gift cards",
      },
      {
        title: "Delivery to parcel shops",
        description:
          "The customer picks a pick-up point from a map in checkout. The list comes from the carrier's own lookup on the postcode.",
        column: "done",
        estimate: 5,
        area: "Delivery",
      },
      {
        title: "Discount codes",
        description:
          "One code per order, and a code cannot be stacked on top of sale prices. Both are enforced in the basket.",
        column: "done",
        estimate: 3,
        area: "Payments",
      },
      {
        title: "Search that tolerates typos",
        description:
          "Search uses trigrams in Postgres instead of exact matching, so a single wrong letter still returns hits.",
        column: "done",
        estimate: 5,
        area: "Catalogue",
      },
      {
        title: "A cookie banner that is not annoying",
        description:
          "The choice is remembered for a year, and no analytics load until the customer has said yes.",
        column: "done",
        estimate: 2,
        area: "Front page",
      },
      {
        title: "Order confirmation by mail",
        description:
          "The mail is sent from a queue, so a failure at the mail provider does not bring down the order itself.",
        column: "done",
        estimate: 3,
        area: "Payments",
      },
      {
        title: "Build pipeline on every commit",
        description:
          "The first step towards automatic deployment. The tests now run in one shared place instead of only on each person's machine.",
        column: "done",
        estimate: 5,
        feature: "Deployment happens automatically from main",
      },
      {
        title: "Upgrade the Node version",
        description:
          "The old version no longer got security fixes. The upgrade took two libraries with it that did not work on the new one.",
        column: "done",
        estimate: 3,
        area: "Platform",
        enabler: "infrastructure",
      },
      {
        title: "MobilePay as a payment method",
        column: "done",
        estimate: 8,
        description: "First version in checkout, desktop only.",
        feature: "Customers can pay with MobilePay on every device",
      },
      {
        title: "MobilePay logo in checkout",
        description:
          "The logo is not loaded from MobilePay's own site; it sits with us, in the sizes their guidelines allow.",
        column: "done",
        estimate: 1,
        feature: "Customers can pay with MobilePay on every device",
      },
      {
        title: "Receipt after a MobilePay payment",
        description:
          "The receipt shows both the order number and the payment reference from MobilePay, so customer service can look the payment up.",
        column: "done",
        estimate: 2,
        feature: "Customers can pay with MobilePay on every device",
      },
      {
        title: "Timeout when MobilePay does not respond",
        column: "done",
        estimate: 3,
        description: "Checkout hung for two minutes when the app did not respond.",
        feature: "Customers can pay with MobilePay on every device",
        bug: true,
      },
      {
        title: "Migrations run automatically",
        description:
          "Runs as a step before the new version starts, and stops the deployment if a migration fails. A lock makes sure only one server runs them when both start at once.",
        column: "done",
        estimate: 3,
        feature: "Deployment happens automatically from main",
      },
      {
        title: "Logging gathered in one place",
        column: "done",
        estimate: 5,
        description: "We searched three systems every time something went wrong.",
        area: "Platform",
        enabler: "infrastructure",
      },
      {
        title: "Shipping prices by weight",
        description:
          "The weight is worked out from the items' own weight plus packaging. The brackets can be edited in the admin without a deployment.",
        column: "done",
        estimate: 5,
        area: "Delivery",
      },
      {
        title: "Tracking link in the order confirmation",
        description:
          "The carrier only reports the tracking number back once the parcel is packed. Until then the mail says the link will follow.",
        column: "done",
        estimate: 2,
        area: "Delivery",
      },
      {
        title: "Sort by popularity",
        description:
          "Popularity is the number of sales in the last 30 days, worked out once a day. Computed on every request it got too heavy in the big categories.",
        column: "done",
        estimate: 3,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Number of items next to each filter",
        description:
          "The counts are taken with the other chosen filters applied. Otherwise they promise results that are not there.",
        column: "done",
        estimate: 2,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Filter by brand",
        description:
          "The brand sat inside the product name rather than in a field of its own. It had to be pulled out on every item first.",
        column: "done",
        estimate: 5,
        feature: "Customers can sort and filter the categories",
      },
      {
        title: "Filters are remembered when going back",
        column: "done",
        estimate: 3,
        description:
          "The chosen filters disappeared when the customer went back from a product page.",
        feature: "Customers can sort and filter the categories",
        bug: true,
      },
      {
        title: "Orders were charged twice",
        column: "done",
        estimate: 3,
        description: "A double click on the pay button created two orders.",
        area: "Payments",
        bug: true,
      },
      {
        title: "Invoice as a payment method",
        description:
          "Business customers with a company registration number and an approved credit limit only. The invoice itself is sent by the finance system, not by the shop.",
        column: "done",
        estimate: 5,
        area: "Payments",
      },
      {
        title: "Reviews show on the product page",
        column: "done",
        estimate: 5,
        description: "Display only; reviews are still written in the old system.",
        feature: "Customers can read and write reviews",
      },
      {
        title: "Average rating in the category",
        description:
          "Shown only once an item has at least three reviews. Below that the average says nothing.",
        column: "done",
        estimate: 3,
        feature: "Customers can read and write reviews",
      },
      {
        title: "Report a review",
        description:
          "A reported review is not hidden by itself; it lands in a list customer service goes through.",
        column: "done",
        estimate: 2,
        feature: "Customers can read and write reviews",
      },
      {
        title: "Data model for gift cards",
        description:
          "The balance is not a field but the sum of entries, so every draw on the card can be traced back.",
        column: "done",
        estimate: 5,
        feature: "Customers can pay with gift cards",
      },
      {
        title: "Gift card balance can be looked up",
        column: "done",
        estimate: 3,
        description: "Customer service needs to see what is left on a card.",
        feature: "Customers can pay with gift cards",
      },
      {
        title: "Expiry date on gift cards",
        description:
          "Three years from the day it is issued. The date shows on the card and in checkout, so the customer does not find out too late.",
        column: "done",
        estimate: 2,
        feature: "Customers can pay with gift cards",
      },
      {
        title: "Roll back with one click",
        column: "done",
        estimate: 5,
        description: "The previous version can be put back into service without manual steps.",
        feature: "Deployment happens automatically from main",
      },
      {
        title: "Image handling out of the monolith",
        description:
          "Image processing ate memory from the rest of the shop on every upload. It now runs as a service of its own.",
        column: "done",
        estimate: 8,
        area: "Platform",
        enabler: "architecture",
      },
      {
        title: "Sold-out items at the bottom of the list",
        description:
          "They stay in the list, so the customer can see the item exists and ask to be told when it is back in stock.",
        column: "done",
        estimate: 2,
        area: "Catalogue",
      },
      {
        title: "New front page for the autumn campaign",
        column: "done",
        estimate: 5,
        description: "New images and a new layout before the autumn campaign.",
        area: "Front page",
      },
      {
        title: "The menu could not be opened on mobile",
        description:
          "An invisible layer from the cookie banner stayed on top of the button after the banner was closed.",
        column: "done",
        estimate: 2,
        area: "Front page",
        bug: true,
      },
    ],
    comment: "I can reproduce this on my own phone. Looking at it today.",
    releases: [
      { name: "Spring: payment and catalogue", dayOffset: -70 },
      { name: "Summer: reviews and operations", dayOffset: -28 },
      { name: "Black Friday ready", dayOffset: 21 },
    ],
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
          description:
            "Members ring the office today to hear whether their fee has been paid. The answer is in the member register, and that is what the app has to show, not a copy alongside it.",
          doneWhen: "90 % of members have logged in and seen their fee",
          area: "Account",
          themes: ["Self-service"],
          closed: true,
          features: [
            {
              title: "Members can log in with MitID",
              description:
                "MitID ties the member to the right record in the member register without anyone typing a membership number. Members without MitID must still be able to get help from the office.",
              doneWhen: "Login works on iOS and Android and the fee is shown",
              closed: true,
            },
          ],
        },
        {
          title: "Members can sign up for events in the app",
          description:
            "Sign-ups arrive by mail today and are typed into a spreadsheet by hand. The organisers need to see their participants without asking the office.",
          doneWhen: "Half of all sign-ups come from the app",
          area: "Events",
          themes: ["Retention"],
          quarterOffset: 0,
          features: [
            {
              title: "Members can sign up and cancel",
              description:
                "Places are limited, so two members pressing at the same moment must not both get the last one. A cancellation has to move the next person on the waiting list up straight away, even in the middle of the night.",
              doneWhen: "Sign-up, cancellation, reminder and waiting list all work",
            },
            {
              title: "Members can see an event's programme",
              description:
                "The organiser edits the programme right up to the day before, so the page must not show a saved copy. If a speaker drops out, the rest of the times have to stay where they are.",
              doneWhen: "Time, place, programme and practical information are on the event's page",
              closed: true,
            },
          ],
        },
        {
          title: "Members can pay their fee in the app",
          description:
            "The fee is collected by giro today, and the reminders cost the office a week every quarter. Card details must not sit with the association, so the payment runs through the provider.",
          doneWhen: "80 % of fee payments happen in the app",
          area: "Payment",
          themes: ["Self-service", "Regulatory"],
          quarterOffset: 1,
          features: [
            {
              title: "Members can pay by card",
              description:
                "A response from the provider can go missing on the way, so the same payment must not be booked twice. A declined payment has to say why, so the member knows whether it is the card or the amount.",
              doneWhen: "A card payment completes and is receipted within a minute",
            },
            {
              title: "Members can see their payments",
              description:
                "The numbers come from the association's bookkeeping, not from the app's own receipts. Members regularly ask for documentation for their employer.",
              doneWhen: "Every payment from the last three years can be seen in the app",
            },
          ],
        },
        {
          title: "Members keep up to date through the app",
          description:
            "The newsletter by mail is read by under a tenth of the members. Messages in the app have to be targetable, so nobody gets something that does not concern them.",
          doneWhen: "Push notifications are opened by at least a third of recipients",
          area: "Messages",
          themes: ["Retention"],
          quarterOffset: 2,
          features: [
            {
              title: "Members get push notifications",
              description:
                "A member has to be able to say no to notifications and still use the rest of the app. The sender needs to see who a message reaches before it goes out.",
              doneWhen: "Messages can be sent to everyone or to an event's participants",
            },
          ],
        },
        {
          title: "Members can look after their own membership",
          description:
            "The office spends most of its time today on address changes and forgotten membership cards. Everything a member changes has to reach the member register the rest of the association works from.",
          doneWhen:
            "Details are updated by the member, and the membership card is shown in the app",
          area: "Account",
          themes: ["Self-service", "Retention"],
          quarterOffset: 0,
          closed: true,
          features: [
            {
              title: "Members can edit their contact details",
              description:
                "A new mail address has to be confirmed before it is used, otherwise a member can lock themselves out. Changes also have to reach the newsletter, which runs in another system.",
              doneWhen:
                "Address, mail and phone can be edited in the app and reach the member register",
              closed: true,
            },
            {
              title: "Members can show their membership card",
              description:
                "The scanners in the hall read the barcode the association already uses on the plastic card. The card has to update itself when the membership is renewed and stop working when it ends.",
              doneWhen:
                "The membership card can be shown without a connection and scanned at the door",
              closed: true,
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
            description:
              "Login goes through NemLog-in. The session lasts 30 days, so a member does not have to go through MitID on every visit.",
            estimate: 8,
            done: true,
            feature: "Members can log in with MitID",
          },
          {
            title: "Fee overview",
            description:
              "The numbers are fetched from the member register overnight, so a payment is first visible the day after. Arrears are at the top.",
            estimate: 5,
            done: true,
            feature: "Members can log in with MitID",
          },
          {
            title: "Change password",
            description:
              "Only for the members who still log in with mail and password instead of MitID.",
            estimate: 2,
            done: true,
            feature: "Members can log in with MitID",
          },
          {
            title: "Profile picture",
            description:
              "The picture is cropped and scaled on the phone before it is sent, so photos straight from the camera do not fill up the server.",
            estimate: 3,
            done: false,
            area: "Account",
          },
        ],
      },
      {
        name: "Sprint 2",
        goal: "Signing up for events",
        cards: [
          {
            title: "List of upcoming events",
            description:
              "Sorted by date, and an event drops off the list at midnight the same day. The number of free places is on each row.",
            estimate: 5,
            done: true,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Sign up and cancel",
            description:
              "A sign-up takes a place straight away. Cancelling is possible until the deadline the organiser has set.",
            estimate: 8,
            done: true,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Reminder the day before",
            description:
              "Sent as mail at 16:00 the day before, since push notifications do not exist yet.",
            estimate: 3,
            done: true,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Waiting list",
            description:
              "The first in the queue gets the place and a mail about it as soon as someone cancels. The organiser does not assign places manually.",
            estimate: 5,
            done: false,
            feature: "Members can sign up and cancel",
          },
          {
            title: "Profile picture",
            description:
              "The picture is cropped and scaled on the phone before it is sent, so photos straight from the camera do not fill up the server.",
            estimate: 3,
            done: true,
            area: "Account",
          },
        ],
      },
      {
        name: "Sprint 3",
        goal: "Members update their own details",
        cards: [
          {
            title: "Edit address and phone number",
            description:
              "The address is looked up in the Danish address register, so it is written the same way for every member.",
            estimate: 5,
            done: true,
            feature: "Members can edit their contact details",
          },
          {
            title: "Confirm a new mail address",
            description:
              "The link is valid for 24 hours, and the old address stays in use until the new one is confirmed.",
            estimate: 3,
            done: true,
            feature: "Members can edit their contact details",
          },
          {
            title: "Changes are sent to the member register",
            description:
              "The register's interface is only up during the day, so changes are queued and sent again until they get through.",
            estimate: 5,
            done: true,
            feature: "Members can edit their contact details",
          },
          {
            title: "The address is not saved on Android",
            description:
              "The keyboard closed the form before the field was saved. Only on Android 13 and later.",
            estimate: 2,
            done: true,
            feature: "Members can edit their contact details",
            bug: true,
          },
          {
            title: "Delete my account",
            description:
              "Bookkeeping law requires payments to be kept for five years, so the member is anonymised instead of deleted.",
            estimate: 5,
            done: false,
            area: "Account",
          },
        ],
      },
      {
        name: "Sprint 4",
        goal: "The membership card is in the phone",
        cards: [
          {
            title: "Membership card with a barcode",
            description:
              "The barcode is Code 128 with the membership number, because that is what the scanners at the door can read.",
            estimate: 8,
            done: true,
            feature: "Members can show their membership card",
          },
          {
            title: "The membership card works offline",
            description:
              "The card is stored signed on the phone and expires after seven days, so a cancelled membership cannot keep working.",
            estimate: 5,
            done: true,
            feature: "Members can show their membership card",
          },
          {
            title: "Scanning at the door",
            description:
              "Volunteers scan with the association's handheld scanners. The screen shows the name and green or red, so the queue does not stall.",
            estimate: 3,
            done: true,
            feature: "Members can show their membership card",
          },
          {
            title: "Membership card in Apple Wallet",
            description:
              "The card is issued as a pkpass file signed with the association's certificate and updates itself when the fee has been paid.",
            estimate: 5,
            done: true,
            feature: "Members can show their membership card",
          },
          {
            title: "Automated tests of the membership card",
            description:
              "The tests run in an emulator without a connection and check both the barcode and the seven-day expiry. They sit in the pipeline, so nobody has to remember to run them.",
            estimate: 3,
            done: false,
            area: "Account",
            enabler: "architecture",
          },
        ],
      },
      {
        name: "Sprint 5",
        goal: "An event's programme in the app",
        cards: [
          {
            title: "A page for an event",
            description:
              "Time, place and a sign-up button at the top, the rest of the text below. The page opens straight from the link in the reminder mail.",
            estimate: 5,
            done: true,
            feature: "Members can see an event's programme",
          },
          {
            title: "Programme with times and speakers",
            description:
              "The items are in time order, and two tracks running at the same time are shown side by side.",
            estimate: 8,
            done: true,
            feature: "Members can see an event's programme",
          },
          {
            title: "Practical information on the event page",
            description:
              "Parking, catering and what to bring yourself. The organiser writes the text and can edit it until the event starts.",
            estimate: 3,
            done: true,
            feature: "Members can see an event's programme",
          },
          {
            title: "Automated tests of the membership card",
            description:
              "The tests run in an emulator without a connection and check both the barcode and the seven-day expiry. They sit in the pipeline, so nobody has to remember to run them.",
            estimate: 3,
            done: true,
            area: "Account",
            enabler: "architecture",
          },
          {
            title: "Map and directions to the venue",
            description:
              "A static map on the page and a button that opens the phone's own map app, so we avoid a key to a map service.",
            estimate: 5,
            done: false,
            area: "Events",
          },
        ],
      },
      {
        name: "Sprint 6",
        goal: "Events are easy to find and plan",
        cards: [
          {
            title: "Map and directions to the venue",
            description:
              "A static map on the page and a button that opens the phone's own map app, so we avoid a key to a map service.",
            estimate: 5,
            done: true,
            area: "Events",
          },
          {
            title: "Search and filter the events",
            description:
              "Free text on title and description plus filters on date and place. The search runs in the database, so there is no search engine to operate.",
            estimate: 8,
            done: true,
            area: "Events",
          },
          {
            title: "Add an event to the calendar",
            description:
              "The app makes an ics file. It does not update afterwards, so a moved date is still announced by mail.",
            estimate: 5,
            done: true,
            area: "Events",
          },
          {
            title: "Images in the programme are turned the wrong way",
            description:
              "Scaling threw away the image's exif orientation, so phone photos lay on their side. Fixed in the step that makes the thumbnails.",
            estimate: 2,
            done: true,
            feature: "Members can see an event's programme",
            bug: true,
          },
          {
            title: "Test environment at the payment provider",
            description:
              "An account, test cards and keys in the provider's sandbox, so payments can be tried out without real money.",
            estimate: 3,
            done: true,
            feature: "Members can pay by card",
            enabler: "infrastructure",
          },
          {
            title: "Participant list for the organiser",
            description:
              "Only the organiser can see the list, and it can be downloaded as a spreadsheet for ticking off at the door.",
            estimate: 3,
            done: false,
            area: "Events",
          },
        ],
      },
    ],
    activeSprint: {
      name: "Sprint 7",
      goal: "Paying the membership fee in the app",
      cards: [
        {
          title: "Choose a payment method",
          description:
            "Card only to begin with, but the screen is built so MobilePay can be added without reworking the flow. The choice is remembered for the next payment.",
          estimate: 3,
          state: "done",
          mine: true,
          feature: "Members can pay by card",
        },
        {
          title: "Pay by card",
          description:
            "The payment happens in the provider's window with 3D Secure, so we never handle card numbers ourselves. The hard part is getting the member back into the app afterwards, even when the bank app takes a minute.",
          estimate: 8,
          state: "doing",
          priority: "high",
          mine: true,
          feature: "Members can pay by card",
        },
        {
          title: "Receipt by mail",
          description:
            "The receipt has to work as an accounting document, so the association's registration number and the amount are on it. It goes out when the provider confirms the payment, not when the app thinks it went through.",
          estimate: 2,
          state: "done",
          feature: "Members can pay by card",
        },
        {
          title: "Payment history",
          description:
            "The oldest payments exist only in the member register, so the list has to read from two sources and show them as one. The receipt can be fetched again from each line.",
          estimate: 5,
          state: "doing",
          feature: "Members can see their payments",
        },
        {
          title: "Waiting list",
          description:
            "The first in the queue gets the place and a mail about it as soon as someone cancels. The organiser does not assign places manually.",
          estimate: 5,
          state: "todo",
          feature: "Members can sign up and cancel",
        },
        {
          title: "Error messages when a payment is declined",
          description:
            "The provider's error codes are shown raw today. They have to become something the member can act on, without giving away more about the card than the bank does.",
          estimate: 3,
          state: "todo",
          feature: "Members can pay by card",
          bug: true,
        },
      ],
    },
    backlog: [
      {
        title: "Push notifications",
        description:
          "Needs permission from the member on both iOS and Android and a key per phone, which has to be cleaned up when a phone is replaced. The sending itself happens from the administration, not from the app.",
        estimate: 8,
        feature: "Members get push notifications",
      },
      {
        title: "Share an event",
        description:
          "The phone's own share sheet with a link to the event's page. The page has to open without a login, otherwise there is little point in sharing it.",
        estimate: 2,
        area: "Events",
      },
      {
        title: "Dark theme",
        description:
          "Follows the phone's setting, with the option of locking it to light or dark. The membership card's barcode has to stay readable for the scanner at the door.",
        estimate: 3,
        area: "Account",
      },
      {
        title: "Family membership",
        description:
          "Several people on one fee means a membership card and a sign-up per person, but only one payer. The work touches both the member register and the payment, and the thirteen points are a guess until it is split up.",
        estimate: 13,
        area: "Account",
      },
      {
        title: "Automated tests of the login flow",
        description:
          "A real MitID login cannot run in a test, so the flow has to run against the provider's test environment. Today we go through the same login by hand before every release.",
        estimate: 5,
        area: "Account",
        enabler: "architecture",
      },
      {
        title: "English language version",
        description:
          "The strings have to come out of the code first, and then there is the content from the administration — events and messages are only written in Danish today. That is why it has no points yet.",
        estimate: null,
        area: "Account",
      },
    ],
    plannedSprint: { name: "Sprint 8", goal: "Messages to members" },
    releases: [
      { name: "1.0 Login and fees", dayOffset: -84 },
      { name: "1.1 My page", dayOffset: -56 },
      { name: "1.2 Events", dayOffset: -28 },
      { name: "1.3 Paying in the app", dayOffset: 14 },
    ],
  },
};
