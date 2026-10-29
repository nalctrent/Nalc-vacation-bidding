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
    const month = start.getMonth();
    const isPrimeTime = month === 5 || month === 6 || month === 7;

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
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [portalMessage, setPortalMessage] = useState('');

  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState({});
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCategory, setNewCarrierCategory] = useState(1);
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierContact, setNewCarrierContact] = useState('');
  const [newCarrierRank, setNewCarrierRank] = useState('');

  const [stewardPinInput, setStewardPinInput] = useState('');
  const [isStewardUnlocked, setIsStewardUnlocked] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStewardView, setIsStewardView] = useState(false);

  // FETCH FRESH DATA FROM SUPABASE ON MOUNT
  useEffect(() => {
    const syncData = async () => {
      try {
        const { data, error } = await supabase.from('carriers').select('*').order('seniority_order', { ascending: true });
        if (!error && data && data.length > 0) {
          setCarriers(data);
          localStorage.setItem('nalc_carriers', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Network sync failed, using local fallback');
      } finally {
        setIsDataLoaded(true);
      }
    };
    syncData();
  }, []);

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);
  const currentRound = allRound1Complete ? 2 : 1;

  const activeBiddingCarrier = currentRound === 1
    ? sortedCarriers.find(c => (!c.round1Choice || c.round1Choice.length === 0) && c.status !== 'bypassed')
    : sortedCarriers.find(c => (!c.round2Choice || c.round2Choice.length === 0) && c.status !== 'bypassed');

  // RESOLVE URL PARAMETER SECURELY AFTER DATA LOADS
  useEffect(() => {
    if (!isDataLoaded) return;

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('carrierId');

    if (targetId) {
      const found = carriers.find(c => String(c.id) === String(targetId));
      if (found) {
        const hasFinishedRound = currentRound === 1 
          ? (found.round1Choice && found.round1Choice.length > 0)
          : (found.round2Choice && found.round2Choice.length > 0);

        if (hasFinishedRound && !isStewardUnlocked) {
          setPortalMessage(`${found.name}, you have already completed your selections for Round ${currentRound}. Thank you!`);
          setCurrentCarrier(null);
          return;
        }

        setPortalMessage('');
        setCurrentCarrier(found);
        setSelectedWeeks([]);
      } else {
        setPortalMessage('Invalid carrier link token.');
      }
    }
  }, [isDataLoaded, carriers, currentRound, isStewardUnlocked]);

  const saveCarriersState = (newCarriers) => {
    setCarriers(newCarriers);
    localStorage.setItem('nalc_carriers', JSON.stringify(newCarriers));
  };

  const getSlotsForWeek = (weekObj) => {
    if (customSlots[weekObj.weekNum] !== undefined) return customSlots[weekObj.weekNum];
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

  const triggerOfficerAlert = async (carrierName, roundNumber, weeks, deadlineStr) => {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierName,
          round: `Round ${roundNumber}`,
          selectedWeeks: weeks.join(', '),
          nextCarrier: activeBiddingCarrier ? activeBiddingCarrier.name : 'All Bidding Completed',
          deadline: deadlineStr
        }),
      });
    } catch (err) {}
  };

  const handleUnlockSteward = () => {
    if (['366366', '1234', '5678'].includes(stewardPinInput)) {
      setIsStewardUnlocked(true);
      setIsStewardView(true);
      setStewardPinInput('');
      setPortalMessage('');
    } else {
      alert('Invalid Officer PIN.');
    }
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

  const handleBypassCarrier = async (carrierToBypass) => {
    if (!confirm(`Bypass ${carrierToBypass.name}?`)) return;
    const updated = carriers.map(c => c.id === carrierToBypass.id ? { ...c, status: 'bypassed' } : c);
    saveCarriersState(updated);
    try { await supabase.from('carriers').update({ status: 'bypassed' }).eq('id', carrierToBypass.id); } catch (err) {}
  };

  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName.trim()) return;
    const newCarrier = {
      id: Date.now().toString(),
      name: newCarrierName.trim(),
      category: Number(newCarrierCategory),
      phone: newCarrierPhone.trim(),
      contact: newCarrierContact.trim(),
      round1Choice: [],
      round2Choice: [],
      ps3971_submitted: false,
      seniority_order: newCarrierRank ? Number(newCarrierRank) : carriers.length + 1,
      link_sent_at: null,
      deadline_at: null,
      status: 'pending'
    };
    const updated = [...carriers, newCarrier];
    saveCarriersState(updated);
    try { await supabase.from('carriers').insert([newCarrier]); } catch (err) {}
    setNewCarrierName(''); setNewCarrierPhone(''); setNewCarrierContact(''); setNewCarrierRank('');
  };

  const handleUpdateRank = async (id, newRank) => {
    const updated = carriers.map(c => c.id === id ? { ...c, seniority_order: Number(newRank) } : c);
    saveCarriersState(updated);
    try { await supabase.from('carriers').update({ seniority_order: Number(newRank) }).eq('id', id); } catch (err) {}
  };

  const handleRemoveCarrier = async (id) => {
    if (confirm('Remove carrier?')) {
      const updated = carriers.filter(c => c.id !== id);
      saveCarriersState(updated);
      try { await supabase.from('carriers').delete().eq('id', id); } catch (err) {}
    }
  };

  const togglePS3971Status = async (carrierId, currentStatus) => {
    const updated = carriers.map(c => c.id === carrierId ? { ...c, ps3971_submitted: !currentStatus } : c);
    saveCarriersState(updated);
    try { await supabase.from('carriers').update({ ps3971_submitted: !currentStatus }).eq('id', carrierId); } catch (err) {}
  };

  const handleWeekClick = (weekNum) => {
    if (!currentCarrier) return;
    if (selectedWeeks.includes(weekNum)) {
      setSelectedWeeks(selectedWeeks.filter(w => w !== weekNum));
      return;
    }
    const hasCompletedR1 = currentCarrier.round1Choice && currentCarrier.round1Choice.length > 0;
    const maxAllowed = hasCompletedR1 ? 1 : (currentCarrier.category === 1 ? 2 : 3);

    if (selectedWeeks.length >= maxAllowed) {
      alert(hasCompletedR1 ? 'Round 2 is limited to 1 week.' : `Category ${currentCarrier.category} is limited to ${maxAllowed} weeks.`);
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

    const hasCompletedR1 = currentCarrier.round1Choice && currentCarrier.round1Choice.length > 0;
    const activeRound = hasCompletedR1 ? 2 : 1;

    const updated = carriers.map(c => {
      if (c.id === currentCarrier.id) {
        return activeRound === 1 ? { ...c, round1Choice: selectedWeeks } : { ...c, round2Choice: selectedWeeks };
      }
      return c;
    });

    saveCarriersState(updated);
    try {
      await supabase.from('carriers').update(
        activeRound === 1 ? { round1Choice: selectedWeeks } : { round2Choice: selectedWeeks }
      ).eq('id', currentCarrier.id);
    } catch (err) {}

    alert(`Round ${activeRound} selections successfully submitted for ${currentCarrier.name}!`);
    
    // HARD PURGE URL & SESSION STATE
    window.location.href = window.location.pathname;
  };

  const formatWeeksWithDates = (weekNums) => {
    if (!weekNums || weekNums.length === 0) return 'Pending';
    return weekNums.map(num => {
      const w = CALENDAR_WEEKS.find(wk => wk.weekNum === Number(num));
      return w ? `Wk ${num} (${w.dateString})` : `Wk ${num}`;
    }).join(', ');
  };

  const handlePrintMasterList = () => {
    const printWindow = window.open('', '_blank');
    let html = `<html><head><title>Master Roster</title><style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px;}th,td{padding:8px;border:1px solid #333;}th{background:#003366;color:#fff;}.center{text-align:center;}</style></head><body><h2>NALC Branch 366 Master Roster</h2><table><thead><tr><th>Priority</th><th>Name</th><th>Cat</th><th>Round 1</th><th>Round 2</th><th>PS 3971</th></tr></thead><tbody>`;
    sortedCarriers.forEach(c => {
      html += `<tr><td class="center">#${c.seniority_order}</td><td><b>${c.name}</b></td><td class="center">${c.category}</td><td>${formatWeeksWithDates(c.round1Choice)}</td><td>${formatWeeksWithDates(c.round2Choice)}</td><td class="center">${c.ps3971_submitted ? 'Yes' : 'No'}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  if (!isDataLoaded) {
    return <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'Arial' }}><h2>Loading NALC Branch 366 Portal...</h2></div>;
  }

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <header className="no-print" style={{ background: '#003366', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>NALC Branch 366 Vacation Bidding Portal</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Active Global Round: <strong>Round {currentRound}</strong> | Up Next: <strong style={{ color: '#ffcc00' }}>{activeBiddingCarrier ? `${activeBiddingCarrier.name} (Priority #${activeBiddingCarrier.seniority_order})` : 'All Completed'}</strong>
        </p>
      </header>

      <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {!isStewardUnlocked ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input type="password" maxLength={6} placeholder="Officer PIN" value={stewardPinInput} onChange={(e) => setStewardPinInput(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '90px', fontSize: '12px' }} />
            <button onClick={handleUnlockSteward} style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🔒 Steward Access</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsStewardView(!isStewardView)} style={{ background: '#003366', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{isStewardView ? '📋 Back to Bidding' : '🛡️ Steward Board'}</button>
            <button onClick={() => setIsAdminOpen(!isAdminOpen)} style={{ background: '#555', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>{isAdminOpen ? 'Close Admin' : '⚙️ Settings'}</button>
          </div>
        )}
      </div>

      {isStewardUnlocked && isStewardView ? (
        <div style={{ background: '#eef2f7', padding: '20px', borderRadius: '8px', border: '1px solid #b0c4de', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, color: '#003366' }}>🛡️ Steward & Officer Master Board</h2>
            <button onClick={handlePrintMasterList} style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ Print Master List</button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#003366', color: '#fff', textAlign: 'left', fontSize: '13px' }}>
                <th style={{ padding: '10px' }}>Priority #</th>
                <th style={{ padding: '10px' }}>Carrier Name</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>PS 3971</th>
                <th style={{ padding: '10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map((c) => {
                const isCurrentTurn = activeBiddingCarrier && activeBiddingCarrier.id === c.id;
                const hasFinished = currentRound === 1 ? (c.round1Choice?.length > 0) : (c.round2Choice?.length > 0);
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #ddd', fontSize: '13px', background: isCurrentTurn ? '#fff9e6' : '#fff' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>#{c.seniority_order}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{c.name} {isCurrentTurn && '(Up Now)'}</td>
                    <td style={{ padding: '10px' }}>{hasFinished ? '✓ Completed' : 'Pending'}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}><input type="checkbox" checked={!!c.ps3971_submitted} onChange={() => togglePS3971Status(c.id, c.ps3971_submitted)} /></td>
                    <td style={{ padding: '10px', display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleSendLinkAndStartTimer(c)} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>💬 Send Link</button>
                      <button onClick={() => handleManualBidStart(c)} style={{ background: '#ffc107', color: '#000', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️ Bid</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {portalMessage && (
        <div style={{ background: '#e2f0fb', color: '#003366', padding: '20px', borderRadius: '8px', border: '1px solid #b0c4de', marginBottom: '20px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px 0' }}>NALC Branch 366 Portal</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>{portalMessage}</p>
        </div>
      )}

      {/* SECURE LANDING (NO CARRIER DROPDOWN BOXES ALLOWED) */}
      {!currentCarrier && !isStewardUnlocked && !portalMessage ? (
        <div className="no-print" style={{ background: '#fff', padding: '30px', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
          <h2 style={{ color: '#003366', marginTop: 0 }}>Secure Bidding Portal</h2>
          <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.5' }}>
            Please use your personalized SMS text message link sent by your shop steward to access your vacation bidding calendar.
          </p>
          <div style={{ marginTop: '20px', padding: '12px', background: '#f8f9fa', borderRadius: '6px', fontSize: '13px', color: '#666' }}>
            Current Bidding Turn: <strong style={{ color: '#d9534f' }}>{activeBiddingCarrier ? `${activeBiddingCarrier.name} (Priority #${activeBiddingCarrier.seniority_order})` : 'All Completed'}</strong>
          </div>
        </div>
      ) : null}

      {/* BIDDING CALENDAR VIEW */}
      {currentCarrier ? (
        <div className="no-print">
          <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#155724' }}>Authenticated as: {currentCarrier.name} (Priority #{currentCarrier.seniority_order})</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Category {currentCarrier.category} — Selected: {selectedWeeks.join(', ') || 'None'}</p>
            </div>
            <button onClick={() => { window.location.href = window.location.pathname; }} style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Exit</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', marginBottom: '20px' }}>
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
                    cursor: (isFull && !isSelected) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Week {week.weekNum}</div>
                  <div style={{ fontSize: '11px', color: isSelected ? '#e0e0e0' : '#555' }}>{week.dateString}</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: isSelected ? '#ffcc00' : (week.isPrimeTime ? '#b8860b' : '#666') }}>{week.isPrimeTime ? '☀️ Prime' : 'Standard'}</div>
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>Slots: {booked}/{maxSlots}</div>
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
              background: selectedWeeks.length === 0 ? '#cccccc' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: selectedWeeks.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {selectedWeeks.length === 0 ? 'Select at least 1 week to submit' : `Submit Selections (${selectedWeeks.length} selected)`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
