import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to calculate 48-hour deadline excluding blackout weekend hours (Sat 4 PM to Mon 7:30 AM)
const calculateBiddingDeadline = (startDate = new Date()) => {
  const deadline = new Date(startDate.getTime() + 48 * 60 * 60 * 1000); // Base 48 hours
  const dayOfWeek = startDate.getDay(); // 0 = Sun, 6 = Sat
  const hour = startDate.getHours();
  const BLACKOUT_MS = 39.5 * 60 * 60 * 1000; // 39.5 hours from Sat 4 PM to Mon 7:30 AM

  if (
    (dayOfWeek === 5 && hour >= 16) || // Friday after 4 PM
    dayOfWeek === 6 ||                  // Saturday
    dayOfWeek === 0 ||                  // Sunday
    (dayOfWeek === 1 && hour < 7)       // Monday before 7:30 AM
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
  { id: '1', name: 'Trenton Bauer', category: 3, pin: '1234', phone: '4173964312', contact: 'nalctrent@gmail.com', round1Choice: [], round2Choice: [], seniority_order: 1, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'active' },
  { id: '2', name: 'Jessica', category: 2, pin: '5678', phone: '4173565260', contact: 'Jessica.branch366@gmail.com', round1Choice: [], round2Choice: [], seniority_order: 2, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'pending' },
  { id: '3', name: 'John Doe', category: 1, pin: '0000', phone: '', contact: '', round1Choice: [], round2Choice: [], seniority_order: 3, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'pending' }
];

export default function App() {
  const [carriers, setCarriers] = useState(() => {
    const saved = localStorage.getItem('nalc_carriers');
    return saved ? JSON.parse(saved) : DEFAULT_ROSTER;
  });
  const [currentCarrier, setCurrentCarrier] = useState(null);
  
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  
  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState({});
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCategory, setNewCarrierCategory] = useState(1);
  const [newCarrierPin, setNewCarrierPin] = useState('0000');
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierContact, setNewCarrierContact] = useState('');
  const [newCarrierRank, setNewCarrierRank] = useState('');

  const [stewardPinInput, setStewardPinInput] = useState('');
  const [isStewardUnlocked, setIsStewardUnlocked] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStewardView, setIsStewardView] = useState(false);

  useEffect(() => {
    fetchCarriersFromSupabase();
  }, []);

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
      console.warn('Using local storage fallback due to network restriction:', err);
    }
  };

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);
  const currentRound = allRound1Complete ? 2 : 1;

  const activeBiddingCarrier = currentRound === 1
    ? sortedCarriers.find(c => (!c.round1Choice || c.round1Choice.length === 0) && c.status !== 'bypassed')
    : sortedCarriers.find(c => (!c.round2Choice || c.round2Choice.length === 0) && c.status !== 'bypassed');

  // AUTO-LOGIN VIA PERSONALIZED URL PARAMETER (?carrierId=xyz)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('carrierId');

    if (targetId && carriers.length > 0 && !currentCarrier) {
      const found = carriers.find(c => String(c.id) === String(targetId));
      if (found) {
        if (activeBiddingCarrier && activeBiddingCarrier.id !== found.id) {
          alert(`Turn Lock Active: It is currently rank #${activeBiddingCarrier.seniority_order} (${activeBiddingCarrier.name})'s turn to bid in Round ${currentRound}. You cannot bid out of order.`);
          return;
        }

        const hasFinishedCurrentRound = currentRound === 1 
          ? (found.round1Choice && found.round1Choice.length > 0)
          : (found.round2Choice && found.round2Choice.length > 0);

        if (hasFinishedCurrentRound) {
          alert(`You have already completed Round ${currentRound}. Please wait for the next round.`);
          return;
        }

        setCurrentCarrier(found);
        setSelectedWeeks([]);
      }
    }
  }, [carriers, activeBiddingCarrier, currentRound, currentCarrier]);

  const getSlotsForWeek = (weekObj) => {
    if (customSlots[weekObj.weekNum] !== undefined) {
      return customSlots[weekObj.weekNum];
    }
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
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  const handleUnlockSteward = () => {
    if (stewardPinInput === '366366' || stewardPinInput === '1234' || stewardPinInput === '5678') {
      setIsStewardUnlocked(true);
      setIsStewardView(true);
      setStewardPinInput('');
    } else {
      alert('Unauthorized access. Invalid Officer PIN.');
    }
  };

  const handleCarrierLogin = (e) => {
    e.preventDefault();
    if (!selectedCarrierId) {
      alert('Please select your name.');
      return;
    }
    const found = carriers.find(c => String(c.id) === String(selectedCarrierId));
    if (!found) {
      alert('Carrier not found.');
      return;
    }

    if (activeBiddingCarrier && activeBiddingCarrier.id !== found.id) {
      alert(`Turn Lock Active: It is currently rank #${activeBiddingCarrier.seniority_order} (${activeBiddingCarrier.name})'s turn to bid in Round ${currentRound}. You cannot bid out of order.`);
      return;
    }

    const hasFinishedCurrentRound = currentRound === 1 
      ? (found.round1Choice && found.round1Choice.length > 0)
      : (found.round2Choice && found.round2Choice.length > 0);

    if (hasFinishedCurrentRound) {
      alert(`You have already completed Round ${currentRound}. Please wait.`);
      return;
    }

    setCurrentCarrier(found);
    setSelectedWeeks([]);
  };

  // Steward Action: Send link, start 48-hour clock, and pass carrierId token
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

    // Generates personalized URL bypassing login screen
    const portalLink = `${window.location.origin}${window.location.pathname}?carrierId=${carrier.id}`;
    const deadlineFormatted = deadline.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const msg = encodeURIComponent(`Hi ${carrier.name}, it is your turn to bid for Round ${currentRound}! You have until ${deadlineFormatted} to submit your picks: ${portalLink}`);
    
    window.location.href = `sms:${carrier.phone || ''}?body=${msg}`;
  };

  // Steward Action: Bypass overdue carrier and activate next in line
  const handleBypassCarrier = async (carrierToBypass) => {
    if (!confirm(`Are you sure you want to bypass ${carrierToBypass.name} for failing to respond within 48 hours?`)) return;

    const updatedCarriers = carriers.map(c => {
      if (c.id === carrierToBypass.id) return { ...c, status: 'bypassed' };
      return c;
    });

    saveCarriersState(updatedCarriers);
    try {
      await supabase.from('carriers').update({ status: 'bypassed' }).eq('id', carrierToBypass.id);
    } catch (err) {}

    alert(`${carrierToBypass.name} has been bypassed. The next carrier can now be notified.`);
  };

  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName.trim()) {
      alert('Please enter a valid Carrier Name.');
      return;
    }

    const newCarrier = {
      id: Date.now().toString(),
      name: newCarrierName.trim(),
      category: Number(newCarrierCategory),
      pin: '0000',
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

    try {
      await supabase.from('carriers').insert([newCarrier]);
    } catch (err) {}

    setNewCarrierName('');
    setNewCarrierPhone('');
    setNewCarrierContact('');
    setNewCarrierRank('');
    alert(`Added ${newCarrier.name} to the roster!`);
  };

  const handleUpdateRank = async (id, newRank) => {
    const updated = carriers.map(c => c.id === id ? { ...c, seniority_order: Number(newRank) } : c);
    saveCarriersState(updated);
    try {
      await supabase.from('carriers').update({ seniority_order: Number(newRank) }).eq('id', id);
    } catch (err) {}
  };

  const handleRemoveCarrier = async (id) => {
    if (confirm('Are you sure you want to remove this carrier?')) {
      const updated = carriers.filter(c => c.id !== id);
      saveCarriersState(updated);
      try {
        await supabase.from('carriers').delete().eq('id', id);
      } catch (err) {}
    }
  };

  const togglePS3971Status = async (carrierId, currentStatus) => {
    const updated = carriers.map(c => c.id === carrierId ? { ...c, ps3971_submitted: !currentStatus } : c);
    saveCarriersState(updated);
    try {
      await supabase.from('carriers').update({ ps3971_submitted: !currentStatus }).eq('id', carrierId);
    } catch (err) {}
  };

  const handleWeekClick = (weekNum) => {
    if (!currentCarrier) return;

    if (selectedWeeks.includes(weekNum)) {
      setSelectedWeeks(selectedWeeks.filter((w) => w !== weekNum));
      return;
    }

    const maxWeeksAllowed = currentRound === 1 
      ? (currentCarrier.category === 1 ? 2 : 3) 
      : 1;

    if (selectedWeeks.length >= maxWeeksAllowed) {
      alert(`Category ${currentCarrier.category} carriers are limited to a maximum of ${maxWeeksAllowed} selection(s) in Round ${currentRound}.`);
      return;
    }

    const weekObj = CALENDAR_WEEKS.find(w => w.weekNum === weekNum);
    const maxSlots = getSlotsForWeek(weekObj);
    const booked = getBookedCount(weekNum);
    if (booked >= maxSlots) {
      alert('This week has reached its maximum allowable quota slots.');
      return;
    }

    setSelectedWeeks([...selectedWeeks, weekNum].sort((a, b) => a - b));
  };

  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0) {
      alert('Please select at least one week before submitting.');
      return;
    }

    if (currentRound === 1 && selectedWeeks.length === 3) {
      const [w1, w2, w3] = selectedWeeks;
      const isAllConsecutive = (w2 === w1 + 1 && w3 === w2 + 1);
      const isTwoConsecutivePlusOne = (w2 === w1 + 1) || (w3 === w2 + 1);

      if (!isAllConsecutive && !isTwoConsecutivePlusOne) {
        alert('LMOU Rule Violation: When picking 3 weeks in Round 1, they must either be 3 consecutive weeks OR a 2-week consecutive block plus 1 separate week.');
        return;
      }
    }

    const deadlineStr = currentCarrier.deadline_at 
      ? new Date(currentCarrier.deadline_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'N/A';

    const updatedCarriers = carriers.map(c => {
      if (c.id === currentCarrier.id) {
        return currentRound === 1 ? { ...c, round1Choice: selectedWeeks } : { ...c, round2Choice: selectedWeeks };
      }
      return c;
    });

    saveCarriersState(updatedCarriers);

    const updatePayload = currentRound === 1 ? { round1Choice: selectedWeeks } : { round2Choice: selectedWeeks };
    try {
      await supabase.from('carriers').update(updatePayload).eq('id', currentCarrier.id);
    } catch (err) {}

    await triggerOfficerAlert(currentCarrier.name, currentRound, selectedWeeks, deadlineStr);

    alert('Bid successfully submitted and locked!');
    setSelectedWeeks([]);
    setCurrentCarrier(null);
    setPinInput('');
    setSelectedCarrierId('');
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
    let html = `
      <html>
        <head>
          <title>NALC Branch 366 Master Vacation Roster</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { text-align: center; color: #003366; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { padding: 8px; border: 1px solid #333; text-align: left; }
            th { background: #003366; color: #fff; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h2>NALC Branch 366 — Master Vacation Roster & PS 3971 Tracking</h2>
          <table>
            <thead>
              <tr>
                <th class="center">Seniority Priority</th>
                <th>Carrier Name</th>
                <th class="center">Cat</th>
                <th>Round 1 Selected Dates</th>
                <th>Round 2 Selected Dates</th>
                <th class="center">PS 3971 Submitted</th>
              </tr>
            </thead>
            <tbody>
    `;

    sortedCarriers.forEach((c) => {
      const r1Formatted = formatWeeksWithDates(c.round1Choice);
      const r2Formatted = formatWeeksWithDates(c.round2Choice);

      html += `
        <tr>
          <td class="center"><b>Priority #${c.seniority_order || '—'}</b></td>
          <td><b>${c.name}</b></td>
          <td class="center">Cat ${c.category}</td>
          <td>${r1Formatted}</td>
          <td>${r2Formatted}</td>
          <td class="center">${c.ps3971_submitted ? '☑ Yes' : '☐ No'}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <header className="no-print" style={{ background: '#003366', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>NALC Branch 366 Vacation Bidding Portal</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Active Global Round: <strong>Round {currentRound}</strong> | Up Next in Queue: <strong style={{ color: '#ffcc00' }}>{activeBiddingCarrier ? `${activeBiddingCarrier.name} (Priority #${activeBiddingCarrier.seniority_order})` : 'None'}</strong>
        </p>
      </header>

      <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {!isStewardUnlocked ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="password" 
              maxLength={6} 
              placeholder="Officer PIN" 
              value={stewardPinInput}
              onChange={(e) => setStewardPinInput(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '90px', fontSize: '12px' }}
            />
            <button 
              onClick={handleUnlockSteward}
              style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              🔒 Steward Access
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setIsStewardView(!isStewardView)} 
              style={{ background: '#003366', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {isStewardView ? '📋 Back to Bidding' : '🛡️ Steward Board'}
            </button>
            <button 
              onClick={() => setIsAdminOpen(!isAdminOpen)} 
              style={{ background: '#555', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}
            >
              {isAdminOpen ? 'Close Roster Admin' : '⚙️ Roster & Quota Settings'}
            </button>
          </div>
        )}
      </div>

      {isStewardUnlocked && isStewardView ? (
        <div style={{ background: '#eef2f7', padding: '20px', borderRadius: '8px', border: '1px solid #b0c4de', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, color: '#003366' }}>🛡️ Steward & Officer Master Board</h2>
            <button 
              onClick={handlePrintMasterList} 
              style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🖨️ Print Clean Master List
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#003366', color: '#fff', textAlign: 'left', fontSize: '13px' }}>
                <th style={{ padding: '10px' }}>Priority #</th>
                <th style={{ padding: '10px' }}>Carrier Name</th>
                <th style={{ padding: '10px' }}>Status / Deadline</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>PS 3971 Submitted</th>
                <th style={{ padding: '10px' }}>Steward Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map((c) => {
                const isCurrentTurn = activeBiddingCarrier && activeBiddingCarrier.id === c.id;
                const isBypassed = c.status === 'bypassed';
                const hasFinished = currentRound === 1 ? (c.round1Choice?.length > 0) : (c.round2Choice?.length > 0);
                
                let deadlinePassed = false;
                if (c.deadline_at && !hasFinished && !isBypassed) {
                  deadlinePassed = new Date() > new Date(c.deadline_at);
                }

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #ddd', fontSize: '13px', background: isCurrentTurn ? '#fff9e6' : isBypassed ? '#f8d7da' : '#fff' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#003366' }}>Priority #{c.seniority_order || '—'}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                      {c.name} {isCurrentTurn && <span style={{ color: '#d9534f', fontSize: '11px' }}>(Up Now)</span>}
                      {isBypassed && <span style={{ color: '#dc3545', fontSize: '11px' }}> [Bypassed]</span>}
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px' }}>
                      {hasFinished ? (
                        <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Completed</span>
                      ) : c.deadline_at ? (
                        <div>
                          <span>Due: {new Date(c.deadline_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {deadlinePassed && <div style={{ color: '#dc3545', fontWeight: 'bold' }}>⚠️ 48hr Overdue!</div>}
                        </div>
                      ) : (
                        <span style={{ color: '#666' }}>Link not sent</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={!!c.ps3971_submitted} 
                        onChange={() => togglePS3971Status(c.id, c.ps3971_submitted)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleSendLinkAndStartTimer(c)}
                        style={{ background: '#28a745', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        💬 Send Link
                      </button>
                      {deadlinePassed && !hasFinished && (
                        <button
                          onClick={() => handleBypassCarrier(c)}
                          style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        >
                          ⚠️ Bypass
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {isStewardUnlocked && isAdminOpen && (
        <div className="no-print" style={{ background: '#f4f4f4', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ccc' }}>
          <h3>Staffing & Leave Quota Settings</h3>
          
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Total Office Carriers (for 11%/14% calculations):</label>
            <input 
              type="number" 
              value={totalEmployees} 
              onChange={(e) => setTotalEmployees(Number(e.target.value))}
              style={{ padding: '4px 8px', width: '60px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <form onSubmit={handleAddCarrier} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Carrier Name" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} style={{ padding: '6px', flex: 1 }} />
            <select value={newCarrierCategory} onChange={(e) => setNewCarrierCategory(Number(e.target.value))} style={{ padding: '6px' }}>
              <option value={1}>Cat 1 (2 Weeks)</option>
              <option value={2}>Cat 2 (3 Weeks)</option>
              <option value={3}>Cat 3 (3 Weeks)</option>
            </select>
            <input type="tel" placeholder="Phone" value={newCarrierPhone} onChange={(e) => setNewCarrierPhone(e.target.value)} style={{ padding: '6px', width: '120px' }} />
            <input type="number" placeholder="Priority #" value={newCarrierRank} onChange={(e) => setNewCarrierRank(e.target.value)} style={{ padding: '6px', width: '80px' }} />
            <button type="submit" style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Add Carrier</button>
          </form>

          <h4>Carrier Priority Roster Sequence</h4>
          <ul>
            {sortedCarriers.map((c) => (
              <li key={c.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ minWidth: '120px' }}>{c.name}</strong>
                <span>Priority Rank:</span>
                <input 
                  type="number" 
                  value={c.seniority_order || 1} 
                  onChange={(e) => handleUpdateRank(c.id, e.target.value)}
                  style={{ width: '50px', textAlign: 'center' }}
                />
                <button onClick={() => handleRemoveCarrier(c.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CARRIER LOGIN SCREEN (FALLBACK IF DIRECT LINK IS NOT USED) */}
      {!currentCarrier ? (
        <div className="no-print" style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '500px', margin: '40px auto' }}>
          <h2 style={{ color: '#003366', marginTop: 0 }}>Carrier Portal Login</h2>
          <p style={{ fontSize: '14px', color: '#555' }}>
            Current Bidding Turn: <strong style={{ color: '#d9534f' }}>{activeBiddingCarrier ? `${activeBiddingCarrier.name} (Priority #${activeBiddingCarrier.seniority_order})` : 'None'}</strong>
          </p>
          
          <form onSubmit={handleCarrierLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Select Name:</label>
              <select 
                value={selectedCarrierId} 
                onChange={(e) => setSelectedCarrierId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
              >
                <option value="">-- Choose Carrier --</option>
                {sortedCarriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Priority #{c.seniority_order || '?'})</option>
                ))}
              </select>
            </div>

            <button 
              type="submit"
              style={{ width: '100%', background: '#003366', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
            >
              View Calendar
            </button>
          </form>
        </div>
      ) : (
        /* BIDDING CALENDAR VIEW */
        <div className="no-print">
          <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #c3e6cb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#155724' }}>🔓 Authenticated as {currentCarrier.name} (Priority #{currentCarrier.seniority_order})</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                Category {currentCarrier.category} — Selected Weeks: {selectedWeeks.join(', ') || 'None'}
              </p>
            </div>
            <button 
              onClick={() => { setCurrentCarrier(null); setSelectedWeeks([]); }}
              style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              Exit Bidding
            </button>
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
                    color: isSelected ? '#ffffff' : isFull ? '#cc0000' : '#000000',
                    textAlign: 'center',
                    cursor: (isFull && !isSelected) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Week {week.weekNum}</div>
                  <div style={{ fontSize: '11px', color: isSelected ? '#e0e0e0' : '#555', margin: '2px 0' }}>{week.dateString}</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: isSelected ? '#ffcc00' : (week.isPrimeTime ? '#b8860b' : '#666') }}>
                    {week.isPrimeTime ? '☀️ Prime (June-Aug)' : 'Standard'}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '2px', color: isSelected ? '#ffffff' : '#333' }}>
                    Slots: {booked}/{maxSlots}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSubmitBid}
            style={{
              width: '100%',
              padding: '14px',
              background: '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Submit Round {currentRound} Selections
          </button>
        </div>
      )}
    </div>
  );
}
