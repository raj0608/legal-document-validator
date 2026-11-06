// How many text messages (parts) a text takes. A phone splits a long text into parts and charges for each.
// Plain letters fit 160 to a part (153 once it is split); a text with a character outside the basic set, such as á or a curly
// apostrophe, switches to a wider encoding with 70 to a part (67 once split).
const BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const EXTENDED = "^{}\\[~]|€"; // each takes two places

export function smsParts(text) {
  let places = 0, basic = true;
  for (const ch of text) {
    if (BASIC.includes(ch)) places += 1;
    else if (EXTENDED.includes(ch)) places += 2;
    else { basic = false; break; }
  }
  if (basic) return places <= 160 ? 1 : Math.ceil(places / 153);
  const units = [...text].reduce((n, ch) => n + (ch.codePointAt(0) > 0xffff ? 2 : 1), 0);
  return units <= 70 ? 1 : Math.ceil(units / 67);
}
