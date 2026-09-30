/**
 * RenderFout — een fout die de render-API als application/problem+json
 * (RFC 9457) teruggeeft: { type, title, status, detail, element?, pad?, … }.
 */
export class RenderFout extends Error {
  /**
   * @param {number} status  400 | 404 | 422
   * @param {string} code    korte slug, wordt `type: urn:omnium:render:<code>`
   * @param {string} title   vaste titel per soort fout
   * @param {string} detail  leesbare melding voor de redacteur
   * @param {object} [extra] bv. { element, pad, diagrammen, domeinen }
   */
  constructor(status, code, title, detail, extra = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.extra = extra;
  }

  toProblem() {
    return {
      type: `urn:omnium:render:${this.code}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      ...this.extra,
    };
  }
}

export const ongeldigModel = (detail, element, pad, extra = {}) =>
  new RenderFout(422, "ongeldig-model", "Het model is ongeldig", detail, { element, pad, ...extra });

export const ongeldigeParameter = (detail, extra) =>
  new RenderFout(400, "ongeldige-parameter", "Ongeldige parameter", detail, extra);

export const nietGevonden = (detail, extra) =>
  new RenderFout(404, "niet-gevonden", "Niet gevonden", detail, extra);
