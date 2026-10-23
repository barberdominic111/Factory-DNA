import React from "react";
// One broken panel must never take the whole game down: show a recoverable message instead.
export default class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.error("Panel error:", err); } catch {} }
  render() {
    if (!this.state.err) return this.props.children;
    return <div role="alert" className="rounded-3xl bg-rose-50 text-rose-900 p-4 text-sm"><b>{this.props.label || "This panel"} hit a problem.</b> Your game and saves are safe.
      <div className="mt-2 flex gap-2 flex-wrap"><button className="bg-rose-700 text-white font-bold rounded-2xl px-4 min-h-[44px]" onClick={() => this.setState({ err: null })}>Try again</button>{this.props.onReset && <button className="bg-stone-600 text-white font-bold rounded-2xl px-4 min-h-[44px]" onClick={this.props.onReset}>Go to the Map</button>}</div></div>;
  }
}
