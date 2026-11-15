// The words for the board's stages, outcomes and talks, in the page's language. Functions, so a language change shows.
import { t } from "/app/shared/lib/page-text.js";

export const laneName = (lane) => ({
  waiting: t("lane_waiting"), here: t("lane_here"), talking: t("lane_talking"), ready: t("lane_ready"), hearing: t("lane_hearing"), done: t("lane_done")
})[lane];

export const withName = (w) => ({ lawyer: t("with_lawyer"), mediator: t("with_mediator"), legal_aid: t("with_legal_aid") })[w];

export const talkName = (w) => ({ lawyer: t("talk_lawyer"), mediator: t("talk_mediator"), legal_aid: t("talk_legal_aid") })[w];

export const outcomeName = (o) => ({
  agreement: t("out_agreement"), dismissed: t("out_dismissed"), judgment: t("out_judgment"),
  default: t("out_default"), continued: t("out_continued"), diversion: t("out_diversion")
})[o];

export const partyName = (p) => ({ tenant: t("who_tenant"), landlord: t("who_landlord") })[p];

export const names = (c) => c.landlord + " v. " + c.tenant;
