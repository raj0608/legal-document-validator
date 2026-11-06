// Where the person is in the product. Pure functions: the browser, the tests and the docs all use the same map.
//
//   #home          what do you need help with?
//   #papers/1..4   "I got court papers", as four steps (#papers is step 1)
//   #check         check a form I filled in      #check/clerk   my filing came back      #check/cites   look up the cases I name
//   #court         court staff: check the case citations in a filing (not in the menu; the footer links to it)
//   #court/return  court staff: the message for a filing returned for correction (a page under #court)
//   #dates         my dates and reminders
//   #help          free help from people, and common questions
//   #help/privacy  how private details are handled (a page under Help)
//
// Every address is a normal link, so the phone's Back button always does what the person expects.

export const VIEWS = ["home", "papers", "check", "dates", "help", "privacy", "court", "return"];
export const PAPER_STEPS = 4;

// The four places in the menu, the same on every screen. A screen that is not one of them lights up its parent.
export const MENU = [
  { view: "home", key: "nav_home" },
  { view: "papers", key: "nav_papers" },
  { view: "dates", key: "nav_dates" },
  { view: "help", key: "nav_help" }
];
const PARENT = { check: "home", privacy: "help", court: "home", return: "court" };
// The menu item a screen lights up: its nearest ancestor that is in the menu (Return a filing is under court staff, which is under Home).
export function menuItemFor(view) { let v = view; while (PARENT[v]) v = PARENT[v]; return v; }

const ALIASES = { questions: "help" }; // older links

export function parseRoute(hash) {
  const parts = String(hash || "").replace(/^#\/?/, "").split("/");
  // A page under another page has its address under that page's address, like its folder in app/: #help/privacy.
  let view = parts[1] && PARENT[parts[1]] === parts[0] ? parts[1] : ALIASES[parts[0]] || parts[0];
  if (!VIEWS.includes(view)) view = "home";
  const route = { view };
  if (view === "papers") {
    const n = parseInt(parts[1], 10);
    route.step = Number.isInteger(n) ? Math.min(PAPER_STEPS, Math.max(1, n)) : 1;
  }
  if (view === "check") route.mode = parts[1] === "clerk" ? "clerk" : parts[1] === "cites" ? "cites" : "form";
  return route;
}

export function hashFor(route) {
  if (route.view === "papers") return route.step > 1 ? "#papers/" + route.step : "#papers";
  if (route.view === "check") return route.mode === "clerk" ? "#check/clerk" : route.mode === "cites" ? "#check/cites" : "#check";
  const parent = PARENT[route.view];
  return parent && parent !== "home" ? "#" + parent + "/" + route.view : "#" + route.view; // Home's pages stay at the top
}

// Steps 2 to 4 need a paper. Without one (after a reload, or Back after clearing) the person is sent to step 1.
export function guard(route, hasPaper) {
  return route.view === "papers" && route.step > 1 && !hasPaper ? { view: "papers", step: 1 } : route;
}
