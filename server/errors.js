// Error codes shared with the browser. They match the codes the page already knows how to show.
export class ApiError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    Object.assign(this, extra); // e.g. text: the part of an answer that arrived before a failure
  }
}

export const bad = (msg) => new ApiError("bad_request", 400, { detail: msg });
