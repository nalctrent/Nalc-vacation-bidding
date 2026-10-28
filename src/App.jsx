import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  UserCheck,
  ShieldAlert,
  Send,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Lock,
  RefreshCw,
  Eye,
  Settings,
  Users,
  Award,
  Phone,
  Mail,
  HelpCircle,
  ChevronRight,
  Printer,
  Copy,
  Pause,
  Play,
  RotateCcw
} from "lucide-react";

// Initial Station LMOU Defaults
const DEFAULT_LMOU = {
  maxCarriersPerWeek: 2,
  turnTimerHours: 24,
  choicePeriodStart: "2027-05-17",
  choicePeriodEnd: "2027-10-10",
  round1MaxDays: 15,
  clockStartTrigger: "on_open", // "on_send" or "on_open"
};

// Default Seniority Roster
const DEFAULT_ROSTER = [
  {
    id: "1",
    name: "J. Miller",
    seniorityRank: 1,
    accrualTier: 26,
    phone: "4175550101",
    email: "jmiller@example.com",
    pin: "1234",
    status: "Completed",
    token: "tok_jm11",
    round1Selections: ["W03", "W04", "W05"],
    noticeSentAt: "2027-01-10T08:00:00Z",
    linkOpenedAt: "2027-01-10T08:15:00Z",
    bidSubmittedAt: "2027-01-10T09:30:00Z",
  },
  {
    id: "2",
    name: "R. Davis",
    seniorityRank: 2,
    accrualTier: 20,
    phone: "4175550102",
    email: "rdavis@example.com",
    pin: "5678",
    status: "Completed",
    token: "tok_rd22",
    round1Selections: ["W08", "W09"],
    noticeSentAt: "2027-01-10T09:31:00Z",
    linkOpenedAt: "2027-01-10T09:40:00Z",
    bidSubmittedAt: "2027-01-10T11:10:00Z",
  },
  {
    id: "3",
    name: "T. Bauer",
    seniorityRank: 3,
    accrualTier: 20,
    phone: "4175550103",
    email: "tbauer@example.com",
    pin: "9988",
    status: "In Turn",
    token: "tok_tb33",
    round1Selections: [],
    noticeSentAt: "2027-01-10T11:15:00Z",
    linkOpenedAt: null,
    bidSubmittedAt: null,
  },
  {
    id: "4",
    name: "M. Jenkins",
    seniorityRank: 4,
    accrualTier: 13,
    phone: "4175550104",
    email: "mjenkins@example.com",
    pin: "4321",
    status: "Waiting",
    token: "tok_mj44",
    round1Selections: [],
    noticeSentAt: null,
    linkOpenedAt: null,
    bidSubmittedAt: null,
  },
  {
    id: "5",
    name: "S. Martinez",
    seniorityRank: 5,
    accrualTier: 13,
    phone: "4175550105",
    email: "smartinez@example.com",
    pin: "8765",
    status: "Waiting",
    token: "tok_sm55",
    round1Selections: [],
    noticeSentAt: null,
    linkOpenedAt: null,
    bidSubmittedAt: null,
  },
];

// Generate Choice Weeks Array (20 Weeks)
const generateWeeks = () => {
  const weeks = [];
  let startDate = new Date("2027-05-17");
  for (let i = 1; i <= 20; i++) {
    const id = `W${i.toString().padStart(2, "0")}`;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    
    const formatStr = (d) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
    weeks.push({
      id,
      weekNumber: i,
      label: `Week ${i}`,
      dates: `${formatStr(startDate)} - ${formatStr(endDate)}`,
    });
    
    startDate.setDate(startDate.getDate() + 7);
  }
  return weeks;
};

export default function NalcVacationApp() {
  const [lmou, setLmou] = useState(DEFAULT_LMOU);
  const [roster, setRoster] = useState(DEFAULT_ROSTER);
  const [weeks] = useState(generateWeeks());
  const [activeTab, setActiveTab] = useState("bidding"); // bidding, steward, roster, lmou, ps3971, audit
  const [auditLogs, setAuditLogs] = useState([
    { timestamp: "2027-01-10 08:00:00", text: "Round 1 Bidding Opened by Shop Steward." },
    { timestamp: "2027-01-10 08:00:01", text: "SMS Notice sent to J. Miller (Rank #1)." },
    { timestamp: "2027-01-10 08:15:10", text: "J. Miller opened personalized link (Token: tok_jm11)." },
    { timestamp: "2027-01-10 09:30:45", text: "J. Miller submitted picks: Week 3, Week 4, Week 5." },
    { timestamp: "2027-01-10 09:31:00", text: "SMS Notice sent to R. Davis (Rank #2)." },
    { timestamp: "2027-01-10 11:10:12", text: "R. Davis submitted picks: Week 8, Week 9." },
    { timestamp: "2027-01-10 11:15:00", text: "Turn advanced to T. Bauer (Rank #3). SMS Notice sent." },
  ]);

  // Active Carrier Session state (Simulating personalized token access)
  const [selectedCarrierId, setSelectedCarrierId] = useState("3");
  const [enteredPin, setEnteredPin] = useState("");
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);
  const [tempSelectedWeeks, setTempSelectedWeeks] = useState([]);
  const [pinError, setPinError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const activeCarrier = useMemo(
    () => roster.find((c) => c.id === selectedCarrierId) || roster[0],
    [roster, selectedCarrierId]
  );

  const currentTurnCarrier = useMemo(
    () => roster.find((c) => c.status === "In Turn") || roster[0],
    [roster]
  );

  // Calculate claimed counts per week
  const weekClaimCounts = useMemo(() => {
    const counts = {};
    weeks.forEach((w) => (counts[w.id] = 0));
    roster.forEach((c) => {
      c.round1Selections.forEach((wId) => {
        if (counts[wId] !== undefined) counts[wId]++;
      });
    });
    return counts;
  }, [roster, weeks]);

  // Handle Token / Link simulation when switching selected carrier
  useEffect(() => {
    setIsPinAuthenticated(false);
    setEnteredPin("");
    setPinError("");
    setTempSelectedWeeks(activeCarrier.round1Selections || []);

    // Simulate clicking unique token link: Record "Link Opened" timestamp if not already set
    if (activeCarrier.status === "In Turn" && !activeCarrier.linkOpenedAt) {
      const now = new Date().toISOString();
      setRoster((prev) =>
        prev.map((c) => (c.id === activeCarrier.id ? { ...c, linkOpenedAt: now } : c))
      );
      addAuditLog(`Carrier ${activeCarrier.name} opened personalized link (Token: ${activeCarrier.token}). 24-Hr Clock Active.`);
    }
  }, [selectedCarrierId]);

  const addAuditLog = (text) => {
    const now = new Date().toLocaleString("en-US", { hour12: false });
    setAuditLogs((prev) => [{ timestamp: now, text }, ...prev]);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (enteredPin === activeCarrier.pin) {
      setIsPinAuthenticated(true);
      setPinError("");
      addAuditLog(`Carrier ${activeCarrier.name} authenticated successfully with 4-digit PIN.`);
    } else {
      setPinError("Invalid 4-Digit PIN. Please check your roster entry or contact Steward.");
    }
  };

  const toggleWeekSelection = (weekId) => {
    if (activeCarrier.status !== "In Turn" && activeCarrier.status !== "Bypassed") return;

    if (tempSelectedWeeks.includes(weekId)) {
      setTempSelectedWeeks(tempSelectedWeeks.filter((id) => id !== weekId));
    } else {
      // Enforce max days/weeks based on accrual
      const maxAllowedWeeks = activeCarrier.accrualTier === 13 ? 2 : 3;
      if (tempSelectedWeeks.length >= maxAllowedWeeks) {
        alert(`Your accrual tier (${activeCarrier.accrualTier} days/yr) allows a maximum of ${maxAllowedWeeks} weeks (${maxAllowedWeeks * 5} days) in Round 1.`);
        return;
      }
      // Enforce LMOU Cap per week
      if ((weekClaimCounts[weekId] || 0) >= lmou.maxCarriersPerWeek) {
        alert(`Week ${weekId} has reached the maximum LMOU cap of ${lmou.maxCarriersPerWeek} carriers off.`);
        return;
      }
      setTempSelectedWeeks([...tempSelectedWeeks, weekId]);
    }
  };

  const handleFinalBidSubmit = () => {
    if (tempSelectedWeeks.length === 0) {
      if (!confirm("Are you sure you want to pass/submit 0 weeks for Round 1?")) return;
    }

    const now = new Date().toISOString();
    const updatedRoster = roster.map((c) => {
      if (c.id === activeCarrier.id) {
        return {
          ...c,
          status: "Completed",
          round1Selections: tempSelectedWeeks,
          bidSubmittedAt: now,
        };
      }
      return c;
    });

    // Find next carrier in seniority line
    const currentIdx = roster.findIndex((c) => c.id === activeCarrier.id);
    let nextIdx = currentIdx + 1;
    while (nextIdx < roster.length && updatedRoster[nextIdx].status === "Completed") {
      nextIdx++;
    }

    if (nextIdx < roster.length) {
      updatedRoster[nextIdx] = {
        ...updatedRoster[nextIdx],
        status: "In Turn",
        noticeSentAt: now,
      };
      addAuditLog(`Bid Submitted by ${activeCarrier.name} (${tempSelectedWeeks.join(", ") || "PASS"}). Turn advanced to ${updatedRoster[nextIdx].name}.`);
      setSelectedCarrierId(updatedRoster[nextIdx].id);
    } else {
      addAuditLog(`Bid Submitted by ${activeCarrier.name}. Round 1 Bidding Complete!`);
    }

    setRoster(updatedRoster);
    setIsPinAuthenticated(false);
  };

  const handleManualBypass = (carrierId) => {
    const updated = roster.map((c) =>
      c.id === carrierId ? { ...c, status: "Bypassed" } : c
    );
    // Find next waiting
    const next = updated.find((c) => c.status === "Waiting");
    if (next) {
      next.status = "In Turn";
      next.noticeSentAt = new Date().toISOString();
      addAuditLog(`Shop Steward manually bypassed Carrier ID #${carrierId}. Turn advanced to ${next.name}.`);
    }
    setRoster(updated);
  };

  const generateSmsLink = (carrier) => {
    const appUrl = `${window.location.origin}${window.location.pathname}?carrierId=${carrier.id}&token=${carrier.token}`;
    const msg = encodeURIComponent(
      `NALC Alert: Hi ${carrier.name}, it's your turn to pick your Prime Time vacation weeks! Access your portal here: ${appUrl}`
    );
    return `sms:${carrier.phone}?body=${msg}`;
  };

  const copyCarrierLink = (carrier) => {
    const appUrl = `${window.location.origin}${window.location.pathname}?carrierId=${carrier.id}&token=${carrier.token}`;
    navigator.clipboard.writeText(appUrl);
    setCopyStatus(`Copied link for ${carrier.name}!`);
    setTimeout(() => setCopyStatus(""), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">
                NALC Prime Time Vacation Bidding
              </h1>
              <p className="text-xs text-slate-400">
                USPS City Delivery • Article 10 & LMOU Engine
              </p>
            </div>
          </div>

          {/* Quick Carrier Switcher Simulation */}
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Simulate Carrier:</span>
            <select
              value={selectedCarrierId}
              onChange={(e) => setSelectedCarrierId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {roster.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-800 text-white">
                  #{c.seniorityRank} {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto text-xs font-medium border-t border-slate-700/50 pt-1">
          <button
            onClick={() => setActiveTab("bidding")}
            className={`px-4 py-2 rounded-t-md flex items-center gap-2 transition ${
              activeTab === "bidding"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" /> Bidding Portal
          </button>
          <button
            onClick={() => setActiveTab("steward")}
            className={`px-4 py-2 rounded-t-md flex items-center gap-2 transition ${
              activeTab === "steward"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="w-4 h-4" /> Steward Dashboard
          </button>
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-4 py-2 rounded-t-md flex items-center gap-2 transition ${
              activeTab === "roster"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Seniority Roster
          </button>
          <button
            onClick={() => setActiveTab("lmou")}
            className={`px-4 py-2 rounded-t-md flex items-center gap-2 transition ${
              activeTab === "lmou"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" /> LMOU Rules
          </button>
          <button
            onClick={() => setActiveTab("ps3971")}
            className={`px-4 py-2 rounded-t-md flex items-center gap-2 transition ${
              activeTab === "ps3971"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Printer className="w-4 h-4" /> PS Form 3971 Slips
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-t-md flex items-center gap-2 transition ${
              activeTab === "audit"
                ? "bg-slate-900 text-blue-400 border-t-2 border-blue-500 font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Clock className="w-4 h-4" /> Audit Log
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {copyStatus && (
          <div className="mb-4 bg-emerald-900/80 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 animate-bounce">
            <CheckCircle className="w-4 h-4" /> {copyStatus}
          </div>
        )}

        {/* TAB 1: BIDDING PORTAL */}
        {activeTab === "bidding" && (
          <div className="space-y-6">
            {/* Active Turn Status Banner */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <Clock className="w-4 h-4 animate-spin text-blue-400" /> Live Turn Status
                </div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Active Bidding Turn: <span className="text-emerald-400">#{currentTurnCarrier.seniorityRank} {currentTurnCarrier.name}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Turn started: {currentTurnCarrier.noticeSentAt ? new Date(currentTurnCarrier.noticeSentAt).toLocaleTimeString() : "Pending"} • 
                  Read Receipt: {currentTurnCarrier.linkOpenedAt ? new Date(currentTurnCarrier.linkOpenedAt).toLocaleTimeString() : "Unopened"}
                </p>
              </div>

              <div className="bg-slate-900 px-4 py-2.5 rounded-lg border border-slate-700 flex items-center gap-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">24-Hour Countdown Clock</p>
                  <p className="text-lg font-mono font-bold text-amber-400">22 hrs 14 mins remaining</p>
                </div>
              </div>
            </div>

            {/* Carrier Portal Access Box */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600/30 text-blue-300 border border-blue-500 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      Personalized Portal Access
                    </span>
                    <span className="text-xs text-slate-400">Token: <code className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">{activeCarrier.token}</code></span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    Welcome, {activeCarrier.name} (Seniority Rank #{activeCarrier.seniorityRank})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Accrual Tier: <strong className="text-slate-200">{activeCarrier.accrualTier} Days/Yr</strong> • Allowed Round 1 Choice: <strong className="text-emerald-400">{activeCarrier.accrualTier === 13 ? "Up to 10 Days (2 Weeks)" : "Up to 15 Days (3 Weeks)"}</strong>
                  </p>
                </div>

                {/* Status Badge */}
                <div>
                  {activeCarrier.status === "In Turn" && (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Your Turn Is Active
                    </span>
                  )}
                  {activeCarrier.status === "Completed" && (
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500 px-3 py-1 rounded-full text-xs font-bold">
                      Round 1 Selection Submitted
                    </span>
                  )}
                  {activeCarrier.status === "Waiting" && (
                    <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                      Waiting in Seniority Queue
                    </span>
                  )}
                  {activeCarrier.status === "Bypassed" && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500 px-3 py-1 rounded-full text-xs font-bold">
                      Bypassed - Catch-Up Eligible
                    </span>
                  )}
                </div>
              </div>

              {/* Security PIN Authentication */}
              {!isPinAuthenticated ? (
                <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-5 max-w-md mx-auto my-4 text-center space-y-3">
                  <Lock className="w-8 h-8 text-blue-400 mx-auto" />
                  <h4 className="text-md font-bold text-white">Enter Security PIN to Unlock Bidding</h4>
                  <p className="text-xs text-slate-400">
                    To prevent unauthorized selections, please enter your 4-digit security PIN.
                  </p>
                  <form onSubmit={handlePinSubmit} className="flex flex-col gap-2">
                    <input
                      type="password"
                      maxLength={4}
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      placeholder="4-Digit PIN"
                      className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-center text-lg font-mono tracking-widest text-white focus:outline-none focus:border-blue-500"
                    />
                    {pinError && <p className="text-xs text-rose-400 font-semibold">{pinError}</p>}
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-lg transition"
                    >
                      Verify PIN & Unlock Calendar
                    </button>
                  </form>
                  <p className="text-[11px] text-slate-500">
                    Default demo PIN for {activeCarrier.name} is <code className="text-slate-300">{activeCarrier.pin}</code>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-900/60 px-4 py-2 rounded-lg border border-slate-700">
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> PIN Verified • Session Secured
                    </span>
                    <button
                      onClick={() => setIsPinAuthenticated(false)}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      Lock Session
                    </button>
                  </div>

                  {/* Interactive Calendar Selection Grid */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 mb-2">
                      Select Choice Vacation Weeks (LMOU Cap: Max {lmou.maxCarriersPerWeek} Carriers/Week)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {weeks.map((w) => {
                        const claimedCount = weekClaimCounts[w.id] || 0;
                        const isFull = claimedCount >= lmou.maxCarriersPerWeek;
                        const isSelectedByMe = tempSelectedWeeks.includes(w.id);
                        const canSelect =
                          (activeCarrier.status === "In Turn" || activeCarrier.status === "Bypassed") &&
                          (!isFull || isSelectedByMe);

                        return (
                          <div
                            key={w.id}
                            onClick={() => canSelect && toggleWeekSelection(w.id)}
                            className={`p-3 rounded-lg border text-left transition relative cursor-pointer ${
                              isSelectedByMe
                                ? "bg-blue-600/30 border-blue-400 text-white ring-2 ring-blue-500"
                                : isFull
                                ? "bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
                                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold uppercase tracking-wider">{w.label}</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  isFull
                                    ? "bg-rose-900/80 text-rose-300"
                                    : "bg-emerald-900/80 text-emerald-300"
                                }`}
                              >
                                {claimedCount}/{lmou.maxCarriersPerWeek} Slots
                              </span>
                            </div>
                            <p className="text-sm font-semibold mt-1">{w.dates}</p>
                            {isSelectedByMe && (
                              <p className="text-[11px] font-bold text-blue-300 mt-2 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Selected
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Bid Action Bar */}
                  {(activeCarrier.status === "In Turn" || activeCarrier.status === "Bypassed") && (
                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3 mt-4">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Selected {tempSelectedWeeks.length} of {activeCarrier.accrualTier === 13 ? "2" : "3"} Max Weeks
                        </p>
                        <p className="text-xs text-slate-400">
                          Weeks: {tempSelectedWeeks.join(", ") || "None"}
                        </p>
                      </div>
                      <button
                        onClick={handleFinalBidSubmit}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm shadow-lg transition flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" /> Submit Official Round 1 Bid
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: STEWARD DASHBOARD */}
        {activeTab === "steward" && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                <ShieldAlert className="w-5 h-5 text-blue-400" /> Shop Steward Command Console
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Manage turn timers, trigger automated SMS/Email notifications, override missed windows, and enforce LMOU compliance.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 uppercase font-bold border-b border-slate-700">
                      <th className="p-3">Rank</th>
                      <th className="p-3">Carrier Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Read Receipt</th>
                      <th className="p-3">Picks</th>
                      <th className="p-3 text-right">Steward Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {roster.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-700/30">
                        <td className="p-3 font-bold text-slate-300">#{c.seniorityRank}</td>
                        <td className="p-3 font-semibold text-white">
                          {c.name}
                          <div className="text-[10px] text-slate-400">{c.phone}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              c.status === "In Turn"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500"
                                : c.status === "Completed"
                                ? "bg-blue-500/20 text-blue-300"
                                : c.status === "Bypassed"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">
                          {c.linkOpenedAt ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Opened {new Date(c.linkOpenedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-slate-500">Unopened</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-300 font-mono">
                          {c.round1Selections.length > 0 ? c.round1Selections.join(", ") : "-"}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <a
                            href={generateSmsLink(c)}
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[11px] font-bold transition"
                          >
                            <Phone className="w-3 h-3" /> Text
                          </a>
                          <button
                            onClick={() => copyCarrierLink(c)}
                            className="inline-flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded text-[11px] font-bold transition"
                          >
                            <Copy className="w-3 h-3" /> Link
                          </button>
                          {c.status === "In Turn" && (
                            <button
                              onClick={() => handleManualBypass(c.id)}
                              className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded text-[11px] font-bold transition"
                            >
                              <Pause className="w-3 h-3" /> Bypass
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SENIORITY ROSTER */}
        {activeTab === "roster" && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Office Seniority Roster</h2>
                <p className="text-xs text-slate-400">City Letter Carriers, PTFs, and CCAs in order of relative standing.</p>
              </div>
              <button
                onClick={() => alert("Add Carrier modal can be configured here.")}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                + Add Carrier
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 uppercase font-bold border-b border-slate-700">
                    <th className="p-3">Rank</th>
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Accrual Category</th>
                    <th className="p-3">Round 1 Max</th>
                    <th className="p-3">Security PIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {roster.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-700/30">
                      <td className="p-3 font-bold text-slate-300">#{c.seniorityRank}</td>
                      <td className="p-3 font-bold text-white">{c.name}</td>
                      <td className="p-3 text-slate-400">{c.phone}</td>
                      <td className="p-3 text-slate-300">{c.accrualTier} Days/Year</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        {c.accrualTier === 13 ? "10 Days (2 Wks)" : "15 Days (3 Wks)"}
                      </td>
                      <td className="p-3 font-mono text-slate-400">{c.pin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LMOU RULES */}
        {activeTab === "lmou" && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-2xl mx-auto space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-400" /> Station LMOU Parameters
            </h2>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  LMOU Item 9 Cap: Max Carriers Off Per Week
                </label>
                <input
                  type="number"
                  value={lmou.maxCarriersPerWeek}
                  onChange={(e) => setLmou({ ...lmou, maxCarriersPerWeek: parseInt(e.target.value) || 1 })}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white w-full text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Selection Time Limit Per Carrier (Hours)
                </label>
                <input
                  type="number"
                  value={lmou.turnTimerHours}
                  onChange={(e) => setLmou({ ...lmou, turnTimerHours: parseInt(e.target.value) || 24 })}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white w-full text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  24-Hour Clock Start Trigger
                </label>
                <select
                  value={lmou.clockStartTrigger}
                  onChange={(e) => setLmou({ ...lmou, clockStartTrigger: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white w-full text-sm font-semibold"
                >
                  <option value="on_open">Starts When Carrier Opens Personalized Link (Read Receipt)</option>
                  <option value="on_send">Starts Immediately When SMS/Notice Is Sent</option>
                </select>
              </div>

              <button
                onClick={() => alert("LMOU Rules Saved Successfully!")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs"
              >
                Save Local Rules
              </button>
            </div>
          </div>
        )}

        {/* TAB 5: PS FORM 3971 SLIPS */}
        {activeTab === "ps3971" && (
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">PS Form 3971 Automated Generator</h2>
                <p className="text-xs text-slate-400">Pre-filled official leave request slips ready for carrier signature and management submission.</p>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Printer className="w-4 h-4" /> Print All Slips
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roster.filter((c) => c.round1Selections.length > 0).map((c) => (
                <div key={c.id} className="bg-white text-slate-900 p-4 rounded-xl shadow border border-slate-300 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-300 pb-2">
                    <div>
                      <h3 className="font-bold text-sm uppercase">PS Form 3971 - Prime Time Choice</h3>
                      <p className="text-[10px] text-slate-600">US Postal Service Application for Leave</p>
                    </div>
                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded">Rank #{c.seniorityRank}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Employee Name</span>
                      <span className="font-bold">{c.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Type of Leave</span>
                      <span className="font-bold">Annual Leave (Choice)</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-bold">Requested Vacation Weeks</span>
                    <span className="font-mono font-bold text-blue-700">{c.round1Selections.join(", ")}</span>
                  </div>

                  <div className="border-t border-slate-200 pt-3 mt-2 flex justify-between items-end">
                    <div>
                      <div className="border-b border-slate-400 w-32 h-6"></div>
                      <span className="text-[9px] text-slate-500 uppercase">Employee Signature</span>
                    </div>
                    <div>
                      <div className="border-b border-slate-400 w-32 h-6"></div>
                      <span className="text-[9px] text-slate-500 uppercase">Supervisor Signature</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: AUDIT LOG */}
        {activeTab === "audit" && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" /> Bidding Audit Trail
            </h2>
            <p className="text-xs text-slate-400">Timestamped record of all notifications, link opens, PIN verifications, and submitted picks.</p>

            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-2 max-h-96 overflow-y-auto border border-slate-700">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="flex gap-3 border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span className="text-slate-200">{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
