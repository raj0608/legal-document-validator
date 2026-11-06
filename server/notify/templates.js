// What the filer is told when a filing is returned for correction, in English and Spanish. The wording lives here, on the
// server, so the page cannot change it. Only the reasons, the last day and a reason in the clerk's own words are filled in:
// no names, no case numbers, and one fixed web address. Every message says it is a test, so it cannot pass for a court's own.
// Plain statements of fact, never "you should" or "you must": this is legal information, not legal advice.
export const HELP_SITE = "indianalegalhelp.org";

export const REASONS = {
  en: {
    not_signed: ["The document is not signed.", "not signed"],
    no_phone: ["A telephone number is missing.", "no phone number"],
    no_cause: ["The cause number is missing.", "no cause number"],
    no_caption: ["The court name or case name at the top is missing or wrong.", "heading wrong"],
    unreadable: ["Part of the file is hard to read or missing.", "file unclear"],
    wrong_form: ["A different form is needed.", "other form needed"]
  },
  es: {
    not_signed: ["El documento no está firmado.", "sin firma"],
    no_phone: ["Falta un número de teléfono.", "falta teléfono"],
    no_cause: ["Falta el número de causa.", "falta número de causa"],
    no_caption: ["Falta el nombre del tribunal o del caso arriba, o es incorrecto.", "encabezado incorrecto"],
    unreadable: ["Parte del archivo es difícil de leer o falta.", "archivo poco claro"],
    wrong_form: ["Se necesita otro formulario.", "se necesita otro formulario"]
  }
};

export const TEXT = {
  en: {
    tag: "[Test message from a student prototype. It is not from a court.]",
    subject: "[Test] Your court filing was returned for correction",
    intro: "The court clerk returned a filing so it can be corrected.",
    found: "What was found:",
    deadline: (date) => `The last day to fix it and send it again is ${date}. That is 3 business days after it was returned. Weekends and court holidays are not counted (Trial Rule 88). A filing fixed in time is treated as filed on the original date.`,
    details: "The clerk's notice has the details.",
    help: `Free help from real people: https://${HELP_SITE}`,
    notAdvice: "This is legal information, not legal advice.",
    sms: (reasons, date) => `[Test] Your court filing was returned: ${reasons}. Last day to fix and resend: ${date}. The clerk's notice has details. Help: ${HELP_SITE}`
  },
  es: {
    tag: "[Mensaje de prueba de un prototipo estudiantil. No es de un tribunal.]",
    subject: "[Prueba] Su escrito fue devuelto para corrección",
    intro: "La secretaría del tribunal devolvió un escrito para que se pueda corregir.",
    found: "Lo que se encontró:",
    deadline: (date) => `El último día para corregirlo y enviarlo de nuevo es ${date}. Son 3 días hábiles después de que se devolvió. No se cuentan los fines de semana ni los feriados del tribunal (Regla de Procedimiento 88). Un escrito corregido a tiempo se trata como presentado en la fecha original.`,
    details: "El aviso de la secretaría tiene los detalles.",
    help: `Ayuda gratis de personas reales: https://${HELP_SITE}`,
    notAdvice: "Esto es información legal, no asesoría legal.",
    sms: (reasons, date) => `[Prueba] Su escrito fue devuelto: ${reasons}. Último día para corregir y reenviar: ${date}. El aviso de la secretaría tiene los detalles. Ayuda: ${HELP_SITE}`
  }
};
