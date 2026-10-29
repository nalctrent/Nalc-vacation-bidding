import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

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

export default function App() {
  const [carriers, setCarriers] = useState([]);
  const [currentCarrier, setCurrentCarrier] = useState(null);
  
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  
  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState({});
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCategory, setNewCarrierCategory] = useState(1);
  const [newCarrierPin, setNewCarrierPin] = useState('');
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierContact, setNewCarrierContact] = useState('');
  const [newCarrierRank, setNewCarrierRank] = useState('');

  const [stewardPinInput, setStewardPinInput] = useState('');
  const [isStewardUnlocked, setIsStewardUnlocked] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStewardView, setIsStewardView] = useState(false);

  useEffect(() => {
    fetchCarriersFromSupabase();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carriers' }, () => {
        fetchCarriersFromSupabase();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCarriersFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('carriers').select('*').order('seniority_order', { ascending: true });
      if (error) {
        console.error('Supabase fetch error:', error.message);
        return;
      }
      if (data && data.length > 0) {
        setCarriers(data);
        // Keep active session matched if already logged in
        if (currentCarrier) {
          const updatedCurrent = data.find(c => c.id === currentCarrier.id);
          if (updatedCurrent) setCurrentCarrier(updatedCurrent);
        }
      }
    } catch (err) {
      console.error('Network error fetching carriers:', err);
    }
  };

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);
  const currentRound = allRound1Complete ? 2 : 1;

  const activeBiddingCarrier = currentRound === 1
    ? sortedCarriers.find(c => !c.round1Choice || c.round1Choice.length === 0)
    : sortedCarriers.find(c => !c.round2Choice || c.round2Choice.length === 0);

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

  const triggerOfficerAlert = async (carrierName, roundNumber, weeks) => {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierName,
          roundNumber,
          selectedWeeks: weeks,
          nextCarrierName: activeBiddingCarrier ? activeBiddingCarrier.name : 'All Bidding Completed',
          nextCarrierContact: 'nalctrent@gmail.com',
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

    if (String(found.pin).trim() !== String(pinInput).trim()) {
      alert('Incorrect 4-digit PIN.');
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

  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName.trim() || newCarrierPin.length !== 4) {
      alert('Please enter a valid Carrier Name and a 4-digit PIN.');
      return;
    }

    const newCarrier = {
      id: Date.now().toString(),
      name: newCarrierName.trim(),
      category: Number(newCarrierCategory),
      pin: newCarrierPin.trim(),
      phone: newCarrierPhone.trim(),
      contact: newCarrierContact.trim(),
      round1Choice: [],
      round2Choice: [],
      ps3971_submitted: false,
      seniority_order: newCarrierRank ? Number(newCarrierRank) : carriers.length + 1
    };

    const { error } = await supabase.from('carriers').insert([newCarrier]);
    if (error) {
      alert('Database error adding carrier: ' + error.message);
      return;
    }

    await fetchCarriersFromSupabase();
    setNewCarrierName('');
    setNewCarrierPin('');
    setNewCarrierPhone('');
    setNewCarrierContact('');
    setNewCarrierRank('');
    alert(`Added ${newCarrier.name} to the roster!`);
  };

  const handleUpdateRank = async (id, newRank) => {
    const updated = carriers.map(c => c.id === id ? { ...c, seniority_order: Number(newRank) } : c);
    setCarriers(updated);
    await supabase.from('carriers').update({ seniority_order: Number(newRank) }).eq('id', id);
  };

  const handleRemoveCarrier = async (id) => {
    if (confirm('Are you sure you want to remove this carrier?')) {
      setCarriers(carriers.filter(c => c.id !== id));
      await supabase.from('carriers').delete().eq('id', id);
    }
  };

  const togglePS3971Status = async (carrierId, currentStatus) => {
    const updated = carriers.map(c => c.id === carrierId ? { ...c, ps3971_submitted: !currentStatus } : c);
    setCarriers(updated);
    await supabase.from('carriers').update({ ps3971_submitted: !currentStatus }).eq('id', carrierId);
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

    const updatePayload = currentRound === 1 ? { round1Choice: selectedWeeks } : { round2Choice: selectedWeeks };

    const { error } = await supabase.from('carriers').update(updatePayload).eq('id', currentCarrier.id);
    if (error) {
      alert('Database error saving bid: ' + error.message);
      return;
    }

    await triggerOfficerAlert(currentCarrier.name, currentRound, selectedWeeks);
    await fetchCarriersFromSupabase();

    alert('Bid successfully submitted and locked to cloud database!');
    setSelectedWeeks([]);
    setCurrentCarrier(null);
    setPinInput('');
    setSelectedCarrierId('');
  };

  const textCarrierDirectly = (carrier) => {
    const link = window.location.origin + window.location.pathname;
    const msg = encodeURIComponent(`Hi ${carrier.name}, it is your turn to bid for Round ${currentRound}! Submit your vacation picks here: ${link}`);
    window.location.href = `sms:${carrier.phone || ''}?body=${msg}`;
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
                <th style={{ padding: '10px' }}>Category</th>
                <th style={{ padding: '10px' }}>Round 1 Selections</th>
                <th style={{ padding: '10px' }}>Round 2 Selections</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>PS 3971 Submitted</th>
                <th style={{ padding: '10px' }}>Dispatch</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map((c) => {
                const isCurrentTurn = activeBiddingCarrier && activeBiddingCarrier.id === c.id;
                const r1Formatted = formatWeeksWithDates(c.round1Choice);
                const r2Formatted = formatWeeksWithDates(c.round2Choice);

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #ddd', fontSize: '13px', background: isCurrentTurn ? '#fff9e6' : '#fff' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#003366' }}>Priority #{c.seniority_order || '—'}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                      {c.name} {isCurrentTurn && <span style={{ color: '#d9534f', fontSize: '11px' }}>(Up Now)</span>}
                    </td>
                    <td style={{ padding: '10px' }}>Cat {c.category}</td>
                    <td style={{ padding: '10px' }}>{r1Formatted}</td>
                    <td style={{ padding: '10px' }}>{r2Formatted}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={!!c.ps3971_submitted} 
                        onChange={() => togglePS3971Status(c.id, c.ps3971_submitted)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => textCarrierDirectly(c)}
                        style={{ background: '#28a745', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        💬 Text Link
                      </button>
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

          <div style={{ marginBottom: '20px', background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #ddd' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#003366' }}>Manual Slot Quota Adjustments Per Week</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {CALENDAR_WEEKS.map(w => (
                <div key={w.weekNum} style={{ background: '#f9f9f9', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold' }}>Wk {w.weekNum} ({w.dateString.slice(0,6)})</div>
                  <input 
                    type="number" 
                    value={customSlots[w.weekNum] !== undefined ? customSlots[w.weekNum] : getSlotsForWeek(w)}
                    onChange={(e) => setCustomSlots({ ...customSlots, [w.weekNum]: Number(e.target.value) })}
                    style={{ width: '50px', textAlign: 'center', marginTop: '4px' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddCarrier} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Carrier Name" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} style={{ padding: '6px', flex: 1 }} />
            <select value={newCarrierCategory} onChange={(e) => setNewCarrierCategory(Number(e.target.value))} style={{ padding: '6px' }}>
              <option value={1}>Cat 1 (2 Weeks)</option>
              <option value={2}>Cat 2 (3 Weeks)</option>
              <option value={3}>Cat 3 (3 Weeks)</option>
            </select>
            <input type="text" placeholder="PIN" maxLength={4} value={newCarrierPin} onChange={(e) => setNewCarrierPin(e.target.value)} style={{ padding: '6px', width: '60px' }} />
            <input type="tel" placeholder="Phone" value={newCarrierPhone} onChange={(e) => setNewCarrierPhone(e.target.value)} style={{ padding: '6px', width: '100px' }} />
            <input type="number" placeholder="Priority #" value={newCarrierRank} onChange={(e) => setNewCarrierRank(e.target.value)} style={{ padding: '6px', width: '80px' }} />
            <button type="submit" style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Add Carrier</button>
          </form>

          <h4>Carrier Priority Roster Sequence</h4>
          <ul>
            {sortedCarriers.map((c) => (
              <li key={c.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ minWidth: '120px' }}>{c.name}</strong>
                <span>Bid Priority Rank:</span>
                <input 
                  type="number" 
                  value={c.seniority_order || 1} 
                  onChange={(e) => handleUpdateRank(c.id, e.target.value)}
                  style={{ width: '50px', textAlign: 'center' }}
                />
                <span>PIN: <code>{c.pin}</code></span>
                <button onClick={() => handleRemoveCarrier(c.id)} style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CARRIER LOGIN SCREEN */}
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>4-Digit PIN:</label>
              <input 
                type="password" 
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter PIN"
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <button 
              type="submit"
              style={{ width: '100%', background: '#003366', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
            >
              Log In & View Calendar
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
              Log Out
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
