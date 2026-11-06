// Reading an email address or a phone number a clerk typed. Strict on purpose: one plain address or one US number,
// nothing that could carry a second recipient, a header line or a link. What does not fit is refused, never repaired.
import { ApiError } from "../errors.js";

const refuse = () => new ApiError("invalid_contact", 400);
const LOCAL = /^[A-Za-z0-9!#$%&*+/=?^_{|}~-]+(?:\.[A-Za-z0-9!#$%&*+/=?^_{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

// Returns the address in a standard form: the part after @ in lower case.
export function parseEmail(value) {
  if (typeof value !== "string") throw refuse();
  const s = value.trim();
  if (s.length < 6 || s.length > 254) throw refuse();
  const parts = s.split("@");
  if (parts.length !== 2) throw refuse();
  const [local, domain] = parts;
  if (!local || local.length > 64 || !LOCAL.test(local)) throw refuse(); // ASCII only: no spaces, commas, quotes, angle brackets or line breaks
  const labels = domain.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !/^[A-Za-z]{2,24}$/.test(labels.at(-1))) throw refuse();
  return local + "@" + domain.toLowerCase();
}

// Numbers that are not for a person: toll-free and premium area codes.
const NOT_PERSONAL = new Set(["800", "833", "844", "855", "866", "877", "888", "900"]);

// Returns +1XXXXXXXXXX. A US or Canadian number with its area code; spaces, dashes, dots and brackets are allowed.
export function parsePhone(value) {
  if (typeof value !== "string" || value.length > 30) throw refuse();
  if (!/^\+?[\d ().-]+$/.test(value.trim())) throw refuse(); // spaces only: no tabs or line breaks
  let digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+") && !digits.startsWith("1")) throw refuse();
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) throw refuse();
  const area = digits.slice(0, 3), exchange = digits.slice(3, 6);
  if (!/^[2-9]/.test(area) || !/^[2-9]/.test(exchange)) throw refuse();
  if (area.slice(1) === "11" || exchange.slice(1) === "11" || NOT_PERSONAL.has(area)) throw refuse();
  return "+1" + digits;
}
