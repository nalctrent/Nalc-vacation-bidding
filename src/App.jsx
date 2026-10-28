import React, { useState, useEffect } from 'react';

const INITIAL_CARRIERS = [
  { id: '1', name: 'Trenton Bauer', category: 3, pin: '1234', phone: '4173964312', contact: '4173964312@tmomail.net', round1Choice: [], round2Choice: [], completed: false },
  { id: '2', name: 'Jessica', category: 2, pin: '5678', phone: '4173565260', contact: '4173565260@txt.att.net', round1Choice: [], round2Choice: [], completed: false },
  { id: '3', name: 'John Doe', category: 1, pin: '0000', phone: '', contact: '', round1Choice: [], round2Choice: [], completed: false },
  { id: '4', name: 'Jane Smith', category: 3, pin: '9999', phone: '', contact: '', round1Choice: [], round2Choice: [], completed: false },
];

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
  const [carriers, setCarriers] = useState(INITIAL_CARRIERS);
  const [currentCarrierIndex, setCurrentCarrierIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  
  // Roster Management State
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCategory, setNewCarrierCategory] = useState(1);
  const [newCarrierPin, setNewCarrierPin] = useState('');
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierContact, setNewCarrierContact] = useState('');

  // Manual Override & Event Block State
  const [overrideCarrierId, setOverrideCarrierId] = useState('');
  const [overrideRound, setOverrideRound] = useState(1);
  const [overrideWeeksInput, setOverrideWeeksInput] = useState('');
  const [blockedEventSlots, setBlockedEventSlots] = useState({}); // { weekNum: blockedCount }

  // Security & Authentication
  const [enteredPin, setEnteredPin] = useState('');
  const [isPinAuthenticated, setIsPinAuthenticated] = useState(false);
  const [stewardPinInput, setStewardPinInput] = useState('');
  const [isStewardUnlocked, setIsStewardUnlocked] = useState(false);

  // View States
  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState({});
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStewardView, setIsStewardView] = useState(false);
  const [activeCarrierParam, setActiveCarrierParam] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cId = params.get('carrierId');
    if (cId) {
      setActiveCarrierParam(cId);
    }
  }, []);

  const currentCarrier = carriers[currentCarrierIndex];
  const isTurnForUrlUser = activeCarrierParam 
    ? currentCarrier && currentCarrier.id === activeCarrierParam
    : true;

  const getSlotsForWeek = (weekObj) => {
    if (customSlots[weekObj.weekNum] !== undefined) {
      return customSlots[weekObj.weekNum];
    }
    const rate = weekObj.isPrimeTime ? 0.14 : 0.11;
    return Math.max(1, Math.round(totalEmployees * rate));
  };

  const getBookedCount = (weekNum) => {
    const carrierBooked = carriers.reduce((count, c) => {
      const r1 = c.round1Choice.includes(weekNum) ? 1 : 0;
      const r2 = c.round2Choice.includes(weekNum) ? 1 : 0;
      return count + r1 + r2;
    }, 0);
    const blocked = blockedEventSlots[weekNum] || 0;
    return carrierBooked + blocked;
  };

  const generateCarrierLink = (carrierId) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?carrierId=${carrierId}`;
  };

  const triggerOfficerAlert = async (carrierName, roundNumber, weeks, nextCarrier) => {
    const nextCarrierLink = nextCarrier ? generateCarrierLink(nextCarrier.id) : null;
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierName,
          roundNumber,
          selectedWeeks: weeks,
          nextCarrierName: nextCarrier ? nextCarrier.name : 'End of Round',
          nextCarrierLink: nextCarrierLink,
          nextCarrierContact: nextCarrier ? nextCarrier.contact : '',
        }),
      });
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  const handleUnlockSteward = () => {
    if (stewardPinInput === '1234' || stewardPinInput === '5678') {
      setIsStewardUnlocked(true);
      setIsStewardView(true);
      setStewardPinInput('');
    } else {
      alert('Unauthorized access. Invalid Officer PIN.');
    }
  };

  const handleAddCarrier = (e) => {
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
      completed: false,
    };

    setCarriers([...carriers, newCarrier]);
    setNewCarrierName('');
    setNewCarrierPin('');
    setNewCarrierPhone('');
    setNewCarrierContact('');
    alert(`Added ${newCarrier.name} to the roster!`);
  };

  const handleRemoveCarrier = (id) => {
    if (confirm('Are you sure you want to remove this carrier?')) {
      setCarriers(carriers.filter(c => c.id !== id));
    }
  };

  const handleManualOverrideSubmit = (e) => {
    e.preventDefault();
    if (!overrideCarrierId || !overrideWeeksInput.trim()) {
      alert('Please select a carrier and enter week numbers (e.g. 5, 6, 7).');
      return;
    }

    const weeksArray = overrideWeeksInput
      .split(',')
      .map((w) => Number(w.trim()))
      .filter((w) => !isNaN(w) && w >= 1 && w <= 52);

    if (weeksArray.length === 0) {
      alert('Please enter valid week numbers between 1 and 52.');
      return;
    }

    setCarriers(carriers.map((c) => {
      if (c.id === overrideCarrierId) {
        if (Number(overrideRound) === 1) {
          return { ...c, round1Choice: weeksArray };
        } else {
          return { ...c, round2Choice: weeksArray };
        }
      }
      return c;
    }));

    setOverrideWeeksInput('');
    alert('Manual bid successfully assigned!');
  };

  const handleVerifyPin = () => {
    if (enteredPin === currentCarrier.pin) {
      setIsPinAuthenticated(true);
    } else {
      alert('Incorrect 4-digit PIN. Please try again.');
    }
  };

  const handleWeekClick = (weekNum) => {
    if (!isTurnForUrlUser || !isPinAuthenticated) return;

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

    setSelectedWeeks([...selectedWeeks, weekNum].sort((a, b) => a - b));
  };

  const handleSubmitBid = async () => {
    if (!isPinAuthenticated) {
      alert('You must authenticate with your PIN before submitting.');
      return;
    }

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

    const updatedCarriers = [...carriers];
    if (currentRound === 1) {
      updatedCarriers[currentCarrierIndex].round1Choice = selectedWeeks;
    } else {
      updatedCarriers[currentCarrierIndex].round2Choice = selectedWeeks;
    }

    const nextIndex = currentCarrierIndex + 1;
    const isEndOfRound = nextIndex >= carriers.length;
    const nextCarrier = isEndOfRound ? null : carriers[nextIndex];

    await triggerOfficerAlert(currentCarrier.name, currentRound, selectedWeeks, nextCarrier);

    setCarriers(updatedCarriers);
    setSelectedWeeks([]);
    setIsPinAuthenticated(false);
    setEnteredPin('');

    if (!isEndOfRound) {
      setCurrentCarrierIndex(nextIndex);
    } else if (currentRound === 1) {
      alert('Round 1 complete! Starting Round 2.');
      setCurrentRound(2);
      setCurrentCarrierIndex(0);
    } else {
      alert('Vacation bidding complete for all rounds!');
    }
  };

  const textCarrierDirectly = (carrier) => {
    const link = generateCarrierLink(carrier.id);
    const msg = encodeURIComponent(
      `Hi ${carrier.name}, it is your turn to bid for Round ${currentRound}! Submit your vacation picks here: ${link}`
    );
    window.location.href = `sms:${carrier.phone || ''}?body=${msg}`;
  };

  const copyIndividualLink = (carrier) => {
    const link = generateCarrierLink(carrier.id);
    const msg = `Hi ${carrier.name}, it is your turn to bid for Round ${currentRound}! Submit your vacation picks here: ${link}`;
    navigator.clipboard.writeText(msg);
    alert(`Personalized link copied for ${carrier.name}!`);
  };

  const handlePrintMasterList = () => {
    window.print();
  };

  return (
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>NALC Branch 366 Vacation Bidding Portal</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Active Round: <strong>Round {currentRound}</strong> | Current Turn: <strong>{currentCarrier ? currentCarrier.name : 'Completed'}</strong> (Category {currentCarrier?.category})
        </p>
      </header>

      {/* Footer Navigation Bar for Officer Controls */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', justifyContent: 'flex-end' }}>
        {!isStewardUnlocked ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="password" 
              maxLength={4} 
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              {isAdminOpen ? 'Close Roster & Slots' : '⚙️ Roster & Slot Admin'}
            </button>
            <button 
              onClick={handlePrintMasterList} 
              style={{ background: '#17a2b8', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🖨️ Print Master List
            </button>
          </div>
        )}
      </div>

      {/* Steward Master View */}
      {isStewardUnlocked && isStewardView ? (
        <div style={{ background: '#eef2f7', padding: '20px', borderRadius: '8px', border: '1px solid #b0c4de', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#003366' }}>🛡️ Steward & Officer Master Board</h2>
          
          {/* Manual Bid Entry */}
          <div style={{ background: '#fff', padding: '14px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #ccd9e8' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#003366' }}>✏️ Manual Bid Override Entry</h4>
            <form onSubmit={handleManualOverrideSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select 
                value={overrideCarrierId} 
                onChange={(e) => setOverrideCarrierId(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
              >
                <option value="">-- Select Carrier --</option>
                {carriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Cat {c.category})</option>
                ))}
              </select>
              <select 
                value={overrideRound} 
                onChange={(e) => setOverrideRound(Number(e.target.value))}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value={1}>Round 1</option>
                <option value={2}>Round 2</option>
              </select>
              <input 
                type="text" 
                placeholder="Weeks (e.g. 5, 6, 7)" 
                value={overrideWeeksInput}
                onChange={(e) => setOverrideWeeksInput(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '130px' }}
              />
              <button type="submit" style={{ background: '#003366', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Assign Bid
              </button>
            </form>
          </div>

          {/* Block NALC Event Slots */}
          <div style={{ background: '#fff', padding: '14px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #ccd9e8' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#d9534f' }}>🏛️ Block Out NALC Union Event Slots</h4>
            <p style={{ fontSize: '12px', color: '#555', margin: '0 0 8px 0' }}>Reserve slots for state/national conventions or union events so carriers cannot bid them:</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', maxHeight: '130px', overflowY: 'auto' }}>
              {CALENDAR_WEEKS.map((w) => (
                <div key={w.weekNum} style={{ fontSize: '12px' }}>
                  Wk {w.weekNum}: 
                  <input 
                    type="number" 
                    min={0}
                    value={blockedEventSlots[w.weekNum] || 0} 
                    onChange={(e) => setBlockedEventSlots({ ...blockedEventSlots, [w.weekNum]: Number(e.target.value) })}
                    style={{ width: '35px', marginLeft: '4px' }}
                  /> blocked
                </div>
              ))}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '6px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#003366', color: '#fff', textAlign: 'left', fontSize: '13px' }}>
                <th style={{ padding: '10px' }}>Carrier Name</th>
                <th style={{ padding: '10px' }}>Category</th>
                <th style={{ padding: '10px' }}>PIN</th>
                <th style={{ padding: '10px' }}>Round 1</th>
                <th style={{ padding: '10px' }}>Round 2</th>
                <th style={{ padding: '10px' }}>Dispatch Options</th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((c) => {
                const isCurrentTurn = currentCarrier && currentCarrier.id === c.id;
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #ddd', fontSize: '13px', background: isCurrentTurn ? '#fff9e6' : '#fff' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                      {c.name} {isCurrentTurn && <span style={{ color: '#d9534f', fontSize: '11px' }}>(Up Now)</span>}
                    </td>
                    <td style={{ padding: '10px' }}>Cat {c.category}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace' }}>{c.pin}</td>
                    <td style={{ padding: '10px' }}>{c.round1Choice.length > 0 ? c.round1Choice.join(', ') : <span style={{ color: '#888' }}>Pending</span>}</td>
                    <td style={{ padding: '10px' }}>{c.round2Choice.length > 0 ? c.round2Choice.join(', ') : <span style={{ color: '#888' }}>Pending</span>}</td>
                    <td style={{ padding: '10px', display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => textCarrierDirectly(c)}
                        style={{ background: '#28a745', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        💬 Text Link
                      </button>
                      <button
                        onClick={() => copyIndividualLink(c)}
                        style={{ background: '#0275d8', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        🔗 Copy
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Admin Section */}
      {isStewardUnlocked && isAdminOpen && (
        <div style={{ background: '#f4f4f4', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ccc' }}>
          <h3>Staffing & Roster Admin</h3>
          <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>
            Total Craft Employees (Base for 11% / 14% Prime calculation):
            <input 
              type="number" 
              value={totalEmployees} 
              onChange={(e) => setTotalEmployees(Number(e.target.value))} 
              style={{ marginLeft: '8px', padding: '4px', width: '60px' }}
            />
          </label>

          <form onSubmit={handleAddCarrier} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Carrier Full Name" 
              value={newCarrierName} 
              onChange={(e) => setNewCarrierName(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
            />
            <select 
              value={newCarrierCategory} 
              onChange={(e) => setNewCarrierCategory(Number(e.target.value))}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value={1}>Category 1 (10 Days)</option>
              <option value={2}>Category 2 (15 Days)</option>
              <option value={3}>Category 3 (15 Days)</option>
            </select>
            <input 
              type="text" 
              placeholder="4-Digit PIN" 
              maxLength={4}
              value={newCarrierPin} 
              onChange={(e) => setNewCarrierPin(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '80px' }}
            />
            <input 
              type="tel" 
              placeholder="Cell Phone #" 
              value={newCarrierPhone} 
              onChange={(e) => setNewCarrierPhone(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', width: '120px' }}
            />
            <input 
              type="text" 
              placeholder="SMS Gateway / Email (Optional)" 
              value={newCarrierContact} 
              onChange={(e) => setNewCarrierContact(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', flex: 1 }}
            />
            <button type="submit" style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Add Carrier
            </button>
          </form>

          <h4>Existing Carrier Roster & Categories</h4>
          <ul style={{ marginBottom: '20px' }}>
            {carriers.map((c, idx) => (
              <li key={c.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <strong style={{ minWidth: '120px' }}>{c.name}</strong>
                <span>Cat:</span>
                <select 
                  value={c.category} 
                  onChange={(e) => {
                    const copy = [...carriers];
                    copy[idx].category = Number(e.target.value);
                    setCarriers(copy);
                  }}
                >
                  <option value={1}>Cat 1</option>
                  <option value={2}>Cat 2</option>
                  <option value={3}>Cat 3</option>
                </select>
                <span>PIN: <code>{c.pin}</code></span>
                <button 
                  onClick={() => handleRemoveCarrier(c.id)}
                  style={{ background: '#dc3545', color: '#fff', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <h4 style={{ borderTop: '1px solid #ccc', paddingTop: '12px' }}>Manual Slot Capacity Overrides per Week</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
            {CALENDAR_WEEKS.map((w) => (
              <div key={w.weekNum} style={{ fontSize: '12px' }}>
                Wk {w.weekNum}: 
                <input 
                  type="number" 
                  value={getSlotsForWeek(w)} 
                  onChange={(e) => setCustomSlots({...customSlots, [w.weekNum]: Number(e.target.value)})}
                  style={{ width: '35px', marginLeft: '4px' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bidding View */}
      {(!isStewardView || !isStewardUnlocked) && currentCarrier && (
        <div>
          {!isTurnForUrlUser ? (
            <div style={{ background: '#f8d7da', color: '#721c24', padding: '14px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #f5c6cb' }}>
              <strong>⚠️ Turn Lock Active:</strong> It is currently <strong>{currentCarrier.name}'s</strong> turn to bid. Please wait for your personal bidding link.
            </div>
          ) : !isPinAuthenticated ? (
            <div style={{ background: '#fff3cd', color: '#856404', padding: '16px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #ffeeba' }}>
              <h3 style={{ margin: '0 0 8px 0' }}>🔒 Carrier Identity Verification</h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
                Hello <strong>{currentCarrier.name}</strong>! Enter your 4-digit PIN to unlock bidding for Round {currentRound}:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="password" 
                  maxLength={4} 
                  placeholder="4-Digit PIN"
                  value={enteredPin} 
                  onChange={(e) => setEnteredPin(e.target.value)}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px', width: '120px', textAlign: 'center' }}
                />
                <button 
                  onClick={handleVerifyPin}
                  style={{ background: '#003366', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Unlock Bidding
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #c3e6cb' }}>
              <h3 style={{ margin: 0, color: '#155724' }}>🔓 Authenticated as {currentCarrier.name}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                Category {currentCarrier.category} — Selected Weeks: {selectedWeeks.join(', ') || 'None'}
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px', marginBottom: '20px' }}>
            {CALENDAR_WEEKS.map((week) => {
              const maxSlots = getSlotsForWeek(week);
              const booked = getBookedCount(week.weekNum);
              const isFull = booked >= maxSlots;
              const isSelected = selectedWeeks.includes(week.weekNum);
              const blockedCount = blockedEventSlots[week.weekNum] || 0;

              return (
                <button
                  key={week.weekNum}
                  disabled={!isTurnForUrlUser || !isPinAuthenticated || (isFull && !isSelected)}
                  onClick={() => handleWeekClick(week.weekNum)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid #001f3f' : '1px solid #ccc',
                    background: isSelected ? '#003366' : isFull ? '#ffe6e6' : week.isPrimeTime ? '#fff8dc' : '#fff',
                    color: isSelected ? '#ffffff' : isFull ? '#cc0000' : '#000000',
                    textAlign: 'center',
                    opacity: (!isTurnForUrlUser || !isPinAuthenticated) ? 0.6 : 1,
                    cursor: (!isTurnForUrlUser || !isPinAuthenticated || (isFull && !isSelected)) ? 'not-allowed' : 'pointer',
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
                  {blockedCount > 0 && (
                    <div style={{ fontSize: '10px', color: isSelected ? '#ffcccc' : '#d9534f', fontWeight: 'bold', marginTop: '2px' }}>
                      🏛️ {blockedCount} Union Slot(s) Blocked
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {isTurnForUrlUser && isPinAuthenticated && (
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
          )}
        </div>
      )}
    </div>
  );
}
