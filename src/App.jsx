import { useState, useRef } from "react";
import { Factory, ArrowRight, Play, Settings, RotateCcw } from "lucide-react";

import { DEFAULT_DNA } from "./data/dna.js";
import { rollEvent } from "./data/events.js";
import { generateWorkers, generateMachines, clamp, makeRng } from "./engine/generate.js";
import { simulateDay } from "./engine/simulate.js";

import DNASetupScreen from "./components/DNASetupScreen.jsx";
import CalendarBar from "./components/CalendarBar.jsx";
import EventCard from "./components/EventCard.jsx";
import FactoryFloor from "./components/FactoryFloor.jsx";
import WorkerPanel from "./components/WorkerPanel.jsx";
import ImprovementShop from "./components/ImprovementShop.jsx";
import ResultsModal from "./components/ResultsModal.jsx";
import HistoryStrip from "./components/HistoryStrip.jsx";

// Phases: setup -> morning -> planning -> simulating -> results -> (loop to morning)
export default function App() {
  const [phase, setPhase] = useState("setup");
  const [dna, setDna] = useState(DEFAULT_DNA);
  const [day, setDay] = useState(1);
  const [workers, setWorkers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [event, setEvent] = useState(null);
  const [earnedBank, setEarnedBank] = useState(0);
  const [purchased, setPurchased] = useState({});
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState(null);

  const rngRef = useRef(makeRng());

  function startGame() {
    const rng = rngRef.current;
    const w = generateWorkers(dna, rng);
    const m = generateMachines(dna, rng);
    m.forEach((mach, i) => {
      if (w[i]) {
        w[i].assignedMachine = mach.id;
        mach.assignedWorkerId = w[i].id;
      }
    });
    setWorkers(w);
    setMachines(m);
    setEvent(rollEvent(rng));
    setDay(1);
    setEarnedBank(0);
    setPurchased({});
    setHistory([]);
    setPhase("morning");
  }

  function assignWorker(workerId, machineId) {
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id === workerId) return { ...w, assignedMachine: machineId };
        if (w.assignedMachine === machineId) return { ...w, assignedMachine: null };
        return w;
      })
    );
  }

  function buyImprovement(key, cost) {
    if (earnedBank < cost) return;
    setEarnedBank((b) => b - cost);
    setPurchased((p) => ({ ...p, [key]: (p[key] || 0) + 1 }));
  }

  function runSimulation() {
    setPhase("simulating");
    setTimeout(() => {
      const sim = simulateDay({ workers, machines, dna, event, improvements: purchased });

      setMachines((prev) => prev.map((m) => sim.machineResults.find((r) => r.id === m.id) || m));
      setWorkers((prev) =>
        prev.map((w) => {
          const r = sim.workerResults.find((wr) => wr.id === w.id);
          if (!r) return { ...w, fatigue: clamp(w.fatigue - 15) };
          return {
            ...w,
            fatigue: clamp(w.fatigue + r.fatigueDelta - (day % 7 === 0 ? 30 : 0)),
            morale: clamp(w.morale + r.moraleDelta),
          };
        })
      );
      setEarnedBank((b) => b + sim.earnedHours);
      setHistory((h) => [...h, { day, productivity: sim.productivity, earnedHours: sim.earnedHours }]);
      setResults(sim);
      setPhase("results");
    }, 1400);
  }

  function nextDay() {
    setResults(null);
    setDay((d) => d + 1);
    setEvent(rollEvent(rngRef.current));
    setPhase("morning");
  }

  if (phase === "setup") {
    return <DNASetupScreen dna={dna} setDna={setDna} onStart={startGame} />;
  }

  const week = Math.ceil(day / 7);
  const month = Math.ceil(day / 30);
  const quarter = Math.ceil(month / 3);

  return (
    <div className="min-h-screen bg-amber-50 pb-10">
      <header className="max-w-5xl mx-auto px-4 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-orange-400 flex items-center justify-center shadow shadow-orange-200 -rotate-3">
            <Factory className="text-white" size={20} />
          </div>
          <h1 className="text-2xl font-black text-stone-700 tracking-tight">Factory DNA</h1>
        </div>
        <button
          onClick={() => setPhase("setup")}
          className="text-xs font-bold text-stone-400 hover:text-orange-500 flex items-center gap-1"
        >
          <RotateCcw size={14} /> New Factory
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 space-y-4">
        <CalendarBar day={day} week={week} month={month} quarter={quarter} />

        {phase === "morning" && (
          <>
            <EventCard event={event} />
            <FactoryFloor machines={machines} workers={workers} />
            <div className="grid sm:grid-cols-2 gap-4">
              <WorkerPanel workers={workers} machines={machines} onAssign={assignWorker} />
              <ImprovementShop earnedBank={earnedBank} purchased={purchased} onBuy={buyImprovement} />
            </div>
            <button
              onClick={() => setPhase("planning")}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2"
            >
              Continue to Planning <ArrowRight size={18} />
            </button>
          </>
        )}

        {phase === "planning" && (
          <>
            <div className="bg-white rounded-3xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2 text-stone-600 font-bold">
                <Settings size={18} className="text-orange-400" /> Final Assignments
              </div>
              <p className="text-sm text-stone-400 mb-3">Confirm who's running what before the shift starts.</p>
            </div>
            <FactoryFloor machines={machines} workers={workers} />
            <div className="grid sm:grid-cols-2 gap-4">
              <WorkerPanel workers={workers} machines={machines} onAssign={assignWorker} />
              <ImprovementShop earnedBank={earnedBank} purchased={purchased} onBuy={buyImprovement} />
            </div>
            <button
              onClick={runSimulation}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2"
            >
              <Play size={18} /> Run the Shift
            </button>
          </>
        )}

        {phase === "simulating" && (
          <div className="py-16 flex flex-col items-center gap-4">
            <FactoryFloor machines={machines.map((m) => ({ ...m, status: "running", progress: 60 }))} workers={workers} />
            <p className="text-stone-500 font-bold animate-pulse">The floor is running today's shift…</p>
          </div>
        )}

        {phase === "results" && (
          <>
            <FactoryFloor machines={machines} workers={workers} />
            <HistoryStrip history={history} />
          </>
        )}
      </main>

      {phase === "results" && <ResultsModal results={results} onNext={nextDay} />}
    </div>
  );
}
