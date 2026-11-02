# Design: flow and navigation

For people facing an eviction case without a lawyer, most often because they cannot afford one. They are stressed, short on time, often reading on a phone, and some read slowly or in a second language. The product should never be the thing that makes the day harder.

## What the research says (and what we took from it)

| Finding | Source | What we did |
|---|---|---|
| Lower-literacy readers go word by word and cannot skim; they miss things outside the main column and skip dense text. Advice: one column, a simple linear menu, nothing that moves, main point first, about 6th-grade reading level on key pages and 8th elsewhere. (One 2005 study of one sponsored site; the direction is widely repeated, the numbers are old.) | [Nielsen Norman Group, “Lower-Literacy Users”](https://www.nngroup.com/articles/writing-for-lower-literacy-users/) | One column everywhere. Four-item menu. No animation. Short sentences; the page says what a screen is for in its first line. |
| Make each step clear (done, current, next), let people go back, keep critical paths short, don’t make people remember or calculate, make human help easy to find, tell people what they need before a task, give reminders. | [W3C, Making Content Usable for People with Cognitive and Learning Disabilities](https://www.w3.org/TR/coga-usable/) (patterns 4.2.4, 4.5.2, 4.6.2, 4.6.4, 4.7.5, 4.8.1, 4.8.5, 4.8.7) | “My papers” is four numbered steps with Back and Continue. Dates and deadlines are worked out for the person. “Help” is one tap away on every screen. A next-date strip follows the person around. |
| Litigants struggle to find the right form, to understand how a court site is organised, and with jargon. A triage step that sorts people toward the right help works better than a menu of documents. Guided pathways reduce, but do not remove, the burden. | IAALS / Stanford Legal Design Lab work with courts (e.g. [Redesigning Divorce](https://iaals.du.edu/sites/default/files/documents/publications/redesigning_divorce.pdf), the LA Superior Court report); University of Ottawa 2024 study of guided pathways | Home asks “What do you need help with?” and offers the four situations people actually arrive in, in their words, not our tool names. |
| Plain-language court forms measurably improve comprehension. | Mindlin 2012 readability study (summarised by the [Self-Represented Litigation Network](https://www.srln.org/taxonomy/term/351)) | Every screen is written in plain words; legal terms get a one-line meaning where they first appear. |
| 28% of households under $30,000 reach the internet only through a smartphone. | [Pew Research Center, 2024](https://www.pewresearch.org/internet/2024/01/31/americans-use-of-mobile-technology-and-home-broadband/markdown) | Phone first: the menu is a bar at the bottom in reach of a thumb, large touch targets (44 px or more, above the WCAG 2.2 minimum of 24 px), no account, nothing heavy to download, no horizontal scroll at 375 px wide. |

Gaps: we found no study that tests *tenants’* comprehension of eviction forms specifically, and none of this replaces testing with the people we are building for (below).

## Principles

1. **Start from the person’s situation, not our tools.** “I got court papers”, not “Document validator”.
2. **One question and one big next action per screen.**
3. **Always show where you are, what is done, and what is next.** Page title, heading, step count and the lit-up menu item all agree. Focus moves to the new heading on every change, so a screen reader announces it.
4. **Back always works.** Every screen has a visible way back, and every address is a normal link, so the phone’s Back button does what people expect.
5. **Don’t make people remember or calculate.** Dates are found, computed (business days, court holidays) and shown in a strip on every screen.
6. **Say what will happen to their information before they give it.** Home says: free, no account, nothing saved.
7. **Real people are never more than one tap away.** Help is in the menu; the support phone number is in the footer and on the Help screen.
8. **Information, never advice.** Unchanged and protected: see the rules in the README.
9. **Calm.** Nothing moves, nothing times out, no pop-ups, one accent colour, one warning style.

## The map

Four places in the menu, the same on every screen (bottom bar on phones, top bar on wide screens):

```
Home ── What do you need help with?
 ├─ I got court papers ───────────► My papers  (4 steps)
 ├─ I want to check a form ───────► Check my form
 ├─ The clerk sent my filing back ► Check my form (clerk notice)
 └─ I just have a question ───────► Help

My papers   1 Add your paper → 2 What it says → 3 Your dates → 4 What’s next
My dates    your hearing, other dates, reminders, calendar links
Help        talk to a real person · common questions · privacy
            (Privacy sits under Help, at #help/privacy; Home links to it too)
```

“Check my form” is not in the menu because it is something people do from a situation (Home) or after their papers (step 4), not a place they come back to. Every screen that is not in the menu lights up its parent: Check my form → Home, Privacy → Help.

### The “I got court papers” path

| Step | The person sees | The one thing to do |
|---|---|---|
| 1 Add your paper | Upload a PDF, try the sample, or paste text. Short line on what to have ready. | Choose, then **Continue** (disabled until a paper is added; focus moves to it). |
| 2 What it says | A plain-words explanation, with a note that it explains and cannot advise. Laws and cases mentioned are folded away (optional). | **Explain this paper**, then **Continue**. |
| 3 Your dates | The dates found, each to check against the paper. The hearing date is added to My dates automatically. Reminder choices, calendar links and the calendar file are right here, so nobody has to leave the path. | Choose reminders if wanted, then **Continue**. |
| 4 What’s next | Ask about your paper; or see my dates, check a form, get free help. | Pick one. |

Steps 1 to 3 never link out of the path (a test enforces it); only step 4, the end, offers other places. **My dates** stays a separate page, reachable from the menu, for people who come back to it.

Steps 2 to 4 need a paper. If someone arrives without one (a reload, or Back after clearing), they are sent to step 1 instead of seeing an empty screen.

## Writing rules

- Short sentences, everyday words, the main point first. Buttons are verbs (“Continue”, “Explain this paper”).
- No “should”, “must”, “need to” about the person’s own case, in our text or in the AI’s (the existing reply flag stays). A test enforces it for page text.
- Say a legal word once, with its meaning: *default judgment (the judge decides without hearing from you)*.
- Dates always spelled out: “Tuesday, November 24, 2026”.
- Don’t promise what we can’t do: there is no photo upload or OCR yet, so the screen says “PDF or paste”, not “take a photo”.

## What we built

- `shared/screen-map.js`: the map above as code (pure, tested).
- `app/shared/layout/router.js`: screens, steps, focus, titles. `app/shared/layout/next-date.js`: the next-date card and strip.
- Phone layout: bottom menu, compact top, **Hide this page** stays on screen in the corner.
- `tests/app/ui-structure.test.js`: every id, link and line of text the page needs exists in English and Spanish; one heading per screen; a way back on every screen; no advice words in page text.
- `npm run demo`: the whole product with clearly labelled sample answers and no API key, for reviews and user testing. The “safety test paper” button now only shows with `?tester` in the address, because it is for the team.

## Test it with people before trusting it

Everything above is informed by research, not yet by our users. Before launch, with 5 to 8 people who have faced (or could face) an eviction and no lawyer, on their own phones:

1. Start from a blank phone screen and the link. Ask them to say what they think this is, in their own words (5-second test on Home).
2. Tasks, no help given: “You got this paper. Find out when you have to be in court.” “Find a free person to talk to.” “The clerk sent your filing back. Find the last day to fix it.” “Change the language.”
3. Watch for: hesitation on Home, wrong first taps, where they look for Back, whether they notice the step count, whether they understand “Continue”, whether they trust “nothing is saved”.
4. Measure: task success without help, time, and the number of times someone says “I don’t know what that means”. Fix, then repeat with new people.
5. Include people who read slowly, who use larger text, who use a screen reader, and who speak Spanish first. Have a person fluent in each language review the translations (see README, translation review).

## Open questions for the court and the team

- Should the support phone number be in the header on every screen, not only the footer and Help?
- Should “Hide this page” also reset to a neutral page (for example a search engine)? Today it clears the screen and shows a blank cover.
- How should the product say “nothing is saved” and also help someone who closes the tab by accident? (Today: the “Save my dates” text file and the calendar `.ics` file.)
- Which languages come first for human review?
