// Where the person is in the product. Pure functions: the browser, the tests and the docs all use the same map.
//
//   #home          what do you need help with?
//   #papers/1..4   "I got court papers", as four steps (#papers is step 1)
//   #check         check a form I filled in      #check/clerk   my filing came back
//   #dates         my dates and reminders
//   #help          free help from people, and common questions
//   #privacy       how private details are handled
//
// Every address is a normal link, so the phone's Back button always does what the person expects.

export const VIEWS = ["home", "papers", "check", "dates", "help", "privacy"];
export const PAPER_STEPS = 4;

// The four places in the menu, the same on every screen. A screen that is not one of them lights up its parent.
export const MENU = [
  { view: "home", key: "nav_home" },
  { view: "papers", key: "nav_papers" },
  { view: "dates", key: "nav_dates" },
  { view: "help", key: "nav_help" }
];
const PARENT = { check: "home", privacy: "help" };
export const menuItemFor = (view) => PARENT[view] || view;

const ALIASES = { questions: "help" }; // older links

export function parseRoute(hash) {
  const parts = String(hash || "").replace(/^#\/?/, "").split("/");
  let view = ALIASES[parts[0]] || parts[0];
  if (!VIEWS.includes(view)) view = "home";
  const route = { view };
  if (view === "papers") {
    const n = parseInt(parts[1], 10);
    route.step = Number.isInteger(n) ? Math.min(PAPER_STEPS, Math.max(1, n)) : 1;
  }
  if (view === "check") route.mode = parts[1] === "clerk" ? "clerk" : "form";
  return route;
}

export function hashFor(route) {
  if (route.view === "papers") return route.step > 1 ? "#papers/" + route.step : "#papers";
  if (route.view === "check") return route.mode === "clerk" ? "#check/clerk" : "#check";
  return "#" + route.view;
}

// Steps 2 to 4 need a paper. Without one (after a reload, or Back after clearing) the person is sent to step 1.
export function guard(route, hasPaper) {
  return route.view === "papers" && route.step > 1 && !hasPaper ? { view: "papers", step: 1 } : route;
}
