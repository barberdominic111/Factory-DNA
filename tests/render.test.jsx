import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import App from "../src/ui/App.jsx";
import IsoMap from "../src/ui/IsoMap.jsx";
import { Ops, Reports } from "../src/ui/Screens2.jsx";
import { Orders, Standards, Improve, Results } from "../src/ui/Screens.jsx";
import { newCampaign, stepDay } from "../src/engine/sim.js";
import { TeamPlus, Projects, Campaign, ChallengeResult } from "../src/ui/Screens3.jsx";
import { newEnterprise, stepEnterprise, expand } from "../src/engine/enterprise.js";
import { startScenario } from "../src/engine/scenarios.js";

// Server-render smoke tests: every screen renders from a mid-game and a finished state without throwing. (Not a substitute for browser testing.)
describe("screens render", () => {
  let s = newCampaign(3, 1e12); for (let i = 0; i < 12; i++) s = stepDay(s);
  const done = (() => { let x = newCampaign(3, 1e12); for (let i = 0; i < 60; i++) x = stepDay(x); return x; })();
  const noop = () => {};
  it("App", () => { expect(renderToString(<App />)).toContain("Factory DNA"); });
  it("map, with and without labels shown by default", () => { expect(renderToString(<IsoMap s={s} sel={null} setSel={noop} />)).toContain("Each Pick"); });
  it("Ops, Reports, Orders, Standards, Team, Improve", () => {
    for (const st of [s, done]) for (const el of [<Ops s={st} act={noop} msg="" />, <Reports s={st} />, <Orders s={st} onOffer={noop} />, <Standards s={st} />, <TeamPlus s={st} act={noop} />, <Projects s={st} act={noop} msg="" />, <Improve s={st} onBuy={noop} onImport={noop} msg="" />]) expect(renderToString(el).length).toBeGreaterThan(100);
  });
  it("Results at quarter end", () => { expect(renderToString(<Results s={done} onRestart={noop} onClose={noop} />)).toContain("Quarter complete"); });
  it("Campaign, enterprise and challenge views render", () => {
    let e = newEnterprise(3, 1e12); for (let i = 0; i < 5; i++) e = stepEnterprise(e); e = { ...e, corp: { cash: 40000, open: 40000 } }; e = expand(e, "east").ent;
    const h = { msg: "", act: noop, ent: noop, next: noop, startChallenge: noop, newGame: noop, load: noop, del: noop, exp: () => "", imp: noop };
    expect(renderToString(<Campaign ent={e} siteId="east" setSiteId={noop} slots={[{ id: "a", name: "A", mode: "campaign", day: 1 }]} slotId="a" h={h} />)).toContain("Enterprise");
    const c = startScenario("steady", 1e12); expect(renderToString(<Campaign ent={c} siteId="main" setSiteId={noop} slots={[]} slotId="a" h={h} />)).toContain("Steady Hands");
    let f = startScenario("flow", 1e12); for (let i = 0; i < 31; i++) f = stepEnterprise(f); expect(renderToString(<ChallengeResult ent={f} onRestart={noop} onClose={noop} />)).toContain("Flow Crunch");
  });
});
