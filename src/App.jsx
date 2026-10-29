import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

const calculateBiddingDeadline = (startDate = new Date()) => {
  const deadline = new Date(startDate.getTime() + 48 * 60 * 60 * 1000);
  const dayOfWeek = startDate.getDay();
  const hour = startDate.getHours();
  const BLACKOUT_MS = 39.5 * 60 * 60 * 1000;

  if (
    (dayOfWeek === 5 && hour >= 16) ||
    dayOfWeek === 6 ||
    dayOfWeek === 0 ||
    (dayOfWeek === 1 && hour < 7)
  ) {
    deadline.setTime(deadline.getTime() + BLACKOUT_MS);
  }
  return deadline;
};

const generateYearWeeks = () => {
  const weeks = [];
  const startDate = new Date(new Date().getFullYear(), 0, 5); 
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
  startDate.setDate(diff);

  for (let i = 0; i < 52; i++) {
    const start = new Date(startDate);
    start.setDate(startDate.getDate() + (i * 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateString = `${monthNames[start.getMonth()]} ${String(start.getDate()).padStart(2, '0')} - ${monthNames[end.getMonth()]} ${String(end.getDate()).padStart(2, '0')}`;
    const isPrimeTime = start.getMonth() >= 5 && start.getMonth() <= 7;

    weeks.push({ weekNum: i + 1, dateString, isPrimeTime });
  }
  return weeks;
};

const CALENDAR_WEEKS = generateYearWeeks();

const DEFAULT_ROSTER = [
  { id: '1', name: 'Trenton Bauer', category: 3, phone: '4173964312', contact: 'nalctrent@gmail.com', round1Choice: [], round2Choice: [], seniority_order: 1, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'active' },
  { id: '2', name: 'Jessica', category: 2, phone: '4173565260', contact: 'Jessica.branch366@gmail.com', round1Choice: [], round2Choice: [], seniority_order: 2, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'pending' },
  { id: '3', name: 'John Doe', category: 1, phone: '', contact: '', round1Choice: [], round2Choice: [], seniority_order: 3, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'pending' }
];

export default function App() {
  const [carriers, setCarriers] = useState(() => {
    const saved = localStorage.getItem('nalc_carriers');
    return saved ? JSON.parse(saved) : DEFAULT_ROSTER;
  });

  const [currentCarrier, setCurrentCarrier] = useState(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [turnError, setTurnError] = useState('');

  const [totalEmployees, setTotalEmployees] = useState(30);
  const [stewardPinInput, setStewardPinInput] = useState('');
  const [isStewardUnlocked, setIsStewardUnlocked] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStewardView, setIsStewardView] = useState(false);

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);
  const currentRound = allRound1Complete ? 2 : 1;

  const activeBiddingCarrier = currentRound === 1
    ? sortedCarriers.find(c => (!c.round1Choice || c.round1Choice.length === 0) && c.status !== 'bypassed')
    : sortedCarriers.find(c => (!c.round2Choice || c.round2Choice.length === 0) && c.status !== 'bypassed');

  // FETCH SUPABASE DATA FIRST BEFORE EVALUATING TURNS
  useEffect(() => {
    const initPortal = async () => {
      setIsLoading(true);
      await fetchCarriersFromSupabase();
      setIsLoading(false);
    };
    initPortal();
  }, []);

  // EVALUATE URL PARAMETER AFTER SUPABASE DATA IS LOADED
  useEffect(() => {
    if (isLoading) return;

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('carrierId');

    if (targetId && carriers.length > 0) {
      const found = carriers.find(c => String(c.id) === String(targetId));
      if (found) {
        // Enforce turn lock strictly
        if (!isStewardUnlocked && activeBiddingCarrier && String(activeBiddingCarrier.id) !== String(found.id)) {
          setTurnError(`It is currently Rank #${activeBiddingCarrier.seniority_order} (${activeBiddingCarrier.name})'s turn to bid. You cannot bid out of turn.`);
          return;
        }

        const hasFinishedRound = currentRound === 1 
          ? (found.round1Choice && found.round1Choice.length > 0)
          : (found.round2Choice && found.round2Choice.length > 0);

        if (hasFinishedRound) {
          setTurnError(`You have already submitted your selections for Round ${currentRound}.`);
          return;
        }

        // Auto-login successful
        setTurnError('');
        setCurrentCarrier(found);
        setSelectedWeeks([]);
      }
    }
  }, [isLoading, carriers, activeBiddingCarrier, currentRound, isStewardUnlocked]);

  const saveCarriersState = (newCarriers) => {
    setCarriers(newCarriers);
    localStorage.setItem('nalc_carriers', JSON.stringify(newCarriers));
  };

  const fetchCarriersFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('carriers').select('*').order('seniority_order', { ascending: true });
      if (!error && data && data.length > 0) {
        saveCarriersState(data);
      }
    } catch (err) {
      console.warn('Using local storage fallback:', err);
    }
  };

  const getSlotsForWeek = (weekObj) => {
    const rate = weekObj.isPrimeTime ? 0.14 : 0.11;
    return Math.max(1, Math.round(totalEmployees * rate));
  };

  const getBookedCount = (weekNum) => {
    return carriers.reduce((count, c) => {
      const r1 = c.round1Choice?.includes(weekNum) ? 1 : 0;
      const r2 = c.round2Choice?.includes(weekNum) ? 1 : 0;
      return count + r1 + r2;
    }, 0);
  };

  const handleUnlockSteward = () => {
    if (stewardPinInput === '366366' || stewardPinInput === '1234' || stewardPinInput === '5678') {
      setIsStewardUnlocked(true);
      setIsStewardView(true);
      setStewardPinInput('');
      setTurnError('');
    } else {
      alert('Unauthorized access.');
    }
  };

  const handleCarrierDropdownLogin = (e) => {
    e.preventDefault();
    if (!selectedCarrierId) return;

    const found = carriers.find(c => String(c.id) === String(selectedCarrierId));
    if (!found) return;

    // PREVENT ACCESS TO OTHER CARRIERS' TURNS FROM DROPDOWN
    if (!isStewardUnlocked && activeBiddingCarrier && String(activeBiddingCarrier.id) !== String(found.id)) {
      alert(`Turn Lock Active: It is currently ${activeBiddingCarrier.name}'s turn. You cannot log in as ${found.name}.`);
      return;
    }

    window.location.search = `?carrierId=${selectedCarrierId}`;
  };

  const handleManualBidStart = (carrier) => {
    window.location.search = `?carrierId=${carrier.id}`;
  };

  const handleSendLinkAndStartTimer = async (carrier) => {
    const now = new Date();
    const deadline = calculateBiddingDeadline(now);

    const updated = carriers.map(c => c.id === carrier.id ? {
      ...c,
      link_sent_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      status: 'active'
    } : c);

    saveCarriersState(updated);
    try {
      await supabase.from('carriers').update({
        link_sent_at: now.toISOString(),
        deadline_at: deadline.toISOString(),
        status: 'active'
      }).eq('id', carrier.id);
    } catch (err) {}

    const portalLink = `${window.location.origin}${window.location.pathname}?carrierId=${carrier.id}`;
    const deadlineFormatted = deadline.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const msg = encodeURIComponent(`Hi ${carrier.name}, it is your turn to bid for Round ${currentRound}! You have until ${deadlineFormatted} to submit your picks: ${portalLink}`);
    
    window.location.href = `sms:${carrier.phone || ''}?body=${msg}`;
  };

  const handleWeekClick = (weekNum) => {
    if (!currentCarrier) return;

    if (selectedWeeks.includes(weekNum)) {
      setSelectedWeeks(selectedWeeks.filter((w) => w !== weekNum));
      return;
    }

    const carrierHasCompletedRound1 = currentCarrier.round1Choice && currentCarrier.round1Choice.length > 0;
    const maxWeeksAllowed = carrierHasCompletedRound1 ? 1 : (currentCarrier.category === 1 ? 2 : 3);

    if (selectedWeeks.length >= maxWeeksAllowed) {
      alert(carrierHasCompletedRound1 ? 'Round 2 is limited to 1 week.' : `Category ${currentCarrier.category} is limited to ${maxWeeksAllowed} weeks in Round 1.`);
      return;
    }

    const weekObj = CALENDAR_WEEKS.find(w => w.weekNum === weekNum);
    if (getBookedCount(weekNum) >= getSlotsForWeek(weekObj)) {
      alert('This week is full.');
      return;
    }

    setSelectedWeeks([...selectedWeeks, weekNum].sort((a, b) => a - b));
  };

  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0 || !currentCarrier) return;

    const carrierHasCompletedRound1 = currentCarrier.round1Choice && currentCarrier.round1Choice.length > 0;
    const activeRoundForCarrier = carrierHasCompletedRound1 ? 2 : 1;

    const updatedCarriers = carriers.map(c => {
      if (c.id === currentCarrier.id) {
        return activeRoundForCarrier === 1 ? { ...c, round1Choice: selectedWeeks } : { ...c, round2Choice: selectedWeeks };
      }
      return c;
    });

    // Save locally
    saveCarriersState(updatedCarriers);

    // Hard sync to Supabase before navigating away
    try {
      await supabase.from('carriers').update(
        activeRoundForCarrier === 1 ? { round1Choice: selectedWeeks } : { round2Choice: selectedWeeks }
      ).eq('id', currentCarrier.id);
    } catch (err) {}

    alert(`Bid submitted and locked for ${currentCarrier.name}!`);
    
    // Hard reset URL to clear session cleanly
    window.location.href = window.location.pathname;
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Arial' }}>
        <h2>Loading NALC Branch 366 Portal...</h2>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>NALC Branch 366 Vacation Bidding</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Round {currentRound} | Active Turn: <strong style={{ color: '#ffcc00' }}>{activeBiddingCarrier ? `${activeBiddingCarrier.name} (Priority #${activeBiddingCarrier.seniority_order})` : 'All Completed'}</strong>
        </p>
      </header>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', justifyContent: 'flex-end' }}>
        {!isStewardUnlocked ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="password" 
              maxLength={6} 
              placeholder="Officer PIN" 
              value={stewardPinInput}
              onChange={(e) => setStewardPinInput(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '90px' }}
            />
            <button onClick={handleUnlockSteward} style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px' }}>
              🔒 Steward
            </button>
          </div>
        ) : (
          <button onClick={() => setIsStewardView(!isStewardView)} style={{ background: '#003366', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px' }}>
            {isStewardView ? '📋 Bidding View' : '🛡️ Steward Board'}
          </button>
        )}
      </div>

      {isStewardUnlocked && isStewardView ? (
        <div style={{ background: '#eef2f7', padding: '20px', borderRadius: '8px', border: '1px solid #b0c4de', marginBottom: '20px' }}>
          <h2>🛡️ Steward Master Board</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#003366', color: '#fff', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Rank</th>
                <th style={{ padding: '8px' }}>Name</th>
                <th style={{ padding: '8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px' }}>#{c.seniority_order}</td>
                  <td style={{ padding: '8px' }}>{c.name}</td>
                  <td style={{ padding: '8px', display: 'flex', gap: '6px' }}>
                    <button onClick={() => handleSendLinkAndStartTimer(c)} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>💬 Link</button>
                    <button onClick={() => handleManualBidStart(c)} style={{ background: '#ffc107', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>✏️ Bid</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* TURN ERROR ALERT */}
      {turnError && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '16px', borderRadius: '8px', border: '1px solid #f5c6cb', marginBottom: '20px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px 0' }}>⚠️ Bidding Notice</h3>
          <p style={{ margin: 0 }}>{turnError}</p>
        </div>
      )}

      {!currentCarrier ? (
        /* FALLBACK LOGIN DROPDOWN WITH STRICT TURN LOCK */
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '500px', margin: '40px auto' }}>
          <h2>Carrier Portal Login</h2>
          <p style={{ color: '#555', fontSize: '14px' }}>
            Current Bidding Turn: <strong>{activeBiddingCarrier ? `${activeBiddingCarrier.name} (Priority #${activeBiddingCarrier.seniority_order})` : 'None'}</strong>
          </p>
          <form onSubmit={handleCarrierDropdownLogin}>
            <select value={selectedCarrierId} onChange={(e) => setSelectedCarrierId(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '12px' }}>
              <option value="">-- Select Your Name --</option>
              {sortedCarriers.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Priority #{c.seniority_order})</option>
              ))}
            </select>
            <button type="submit" style={{ width: '100%', background: '#003366', color: '#fff', padding: '12px', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
              Enter Portal
            </button>
          </form>
        </div>
      ) : (
        /* CALENDAR VIEW */
        <div>
          <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Authenticated as: {currentCarrier.name} (Priority #{currentCarrier.seniority_order})</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Category {currentCarrier.category} — Selected: {selectedWeeks.join(', ') || 'None'}</p>
            </div>
            <button onClick={() => { window.location.href = window.location.pathname; }} style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px' }}>
              Exit
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px', marginBottom: '20px' }}>
            {CALENDAR_WEEKS.map((week) => {
              const maxSlots = getSlotsForWeek(week);
              const booked = getBookedCount(week.weekNum);
              const isFull = booked >= maxSlots;
              const isSelected = selectedWeeks.includes(week.weekNum);

              return (
                <button
                  key={week.weekNum}
                  disabled={isFull && !isSelected}
                  onClick={() => handleWeekClick(week.weekNum)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid #001f3f' : '1px solid #ccc',
                    background: isSelected ? '#003366' : isFull ? '#ffe6e6' : week.isPrimeTime ? '#fff8dc' : '#fff',
                    color: isSelected ? '#fff' : isFull ? '#cc0000' : '#000',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>Week {week.weekNum}</div>
                  <div style={{ fontSize: '11px' }}>{week.dateString}</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Slots: {booked}/{maxSlots}</div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSubmitBid}
            disabled={selectedWeeks.length === 0}
            style={{
              width: '100%',
              padding: '14px',
              background: selectedWeeks.length === 0 ? '#ccc' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
            }}
          >
            Submit Selections ({selectedWeeks.length} selected)
          </button>
        </div>
      )}
    </div>
  );
}
