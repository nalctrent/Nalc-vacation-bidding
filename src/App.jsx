import React, { useState, useEffect } from 'react';

// Default Roster with Leave Categories (1, 2, or 3) based on MOU
const INITIAL_CARRIERS = [
  { id: '1', name: 'Trenton Bauer', category: 3, round1Choice: [], round2Choice: [], completed: false },
  { id: '2', name: 'Jessica', category: 2, round1Choice: [], round2Choice: [], completed: false },
  { id: '3', name: 'John Doe', category: 1, round1Choice: [], round2Choice: [], completed: false },
  { id: '4', name: 'Jane Smith', category: 3, round1Choice: [], round2Choice: [], completed: false },
];

// 52 Weeks calendar setup with Prime Time designations
const PRIME_TIME_WEEKS = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 47, 51, 52];

export default function App() {
  const [carriers, setCarriers] = useState(INITIAL_CARRIERS);
  const [currentCarrierIndex, setCurrentCarrierIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  
  // Staffing and Leave Slot Management
  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState({});
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const currentCarrier = carriers[currentCarrierIndex];

  // Calculate default slots per week based on percentage (14% prime time, 11% non-prime)
  const getSlotsForWeek = (weekNum) => {
    if (customSlots[weekNum] !== undefined) {
      return customSlots[weekNum];
    }
    const rate = PRIME_TIME_WEEKS.includes(weekNum) ? 0.14 : 0.11;
    return Math.max(1, Math.round(totalEmployees * rate));
  };

  // Get current booked slots count for a week
  const getBookedCount = (weekNum) => {
    return carriers.reduce((count, c) => {
      const r1 = c.round1Choice.includes(weekNum) ? 1 : 0;
      const r2 = c.round2Choice.includes(weekNum) ? 1 : 0;
      return count + r1 + r2;
    }, 0);
  };

  // Resend Officer Alert Trigger
  const triggerOfficerAlert = async (carrierName, roundNumber, weeks, nextCarrierName) => {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrierName,
          roundNumber,
          selectedWeeks: weeks,
          nextCarrierName,
        }),
      });
      console.log('Officer alert dispatched successfully.');
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  // Select / Deselect Week Logic
  const handleWeekClick = (weekNum) => {
    if (selectedWeeks.includes(weekNum)) {
      setSelectedWeeks(selectedWeeks.filter((w) => w !== weekNum));
      return;
    }

    const maxWeeksAllowed = currentRound === 1 
      ? (currentCarrier.category === 1 ? 2 : 3) 
      : 1;

    if (selectedWeeks.length >= maxWeeksAllowed) {
      alert(`Category ${currentCarrier.category} carriers are limited to a maximum of ${maxWeeksAllowed} week(s) in Round ${currentRound}.`);
      return;
    }

    setSelectedWeeks([...selectedWeeks, weekNum].sort((a, b) => a - b));
  };

  // Submit Bid with Validation Rules
  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0) {
      alert('Please select at least one week before submitting.');
      return;
    }

    // Consecutive week rule validation for Category 2 & 3 in Round 1 taking 3 weeks (15 days)
    if (currentRound === 1 && selectedWeeks.length === 3) {
      const [w1, w2, w3] = selectedWeeks;
      const isConsecutive = (w2 === w1 + 1 && w3 === w2 + 1) || (w2 === w1 + 1) || (w3 === w2 + 1);
      if (!isConsecutive) {
        alert('LMOU Rule Violation: Selecting 3 separate single weeks is not permitted. 15-day bids must include at least a 2-week consecutive block.');
        return;
      }
    }

    // Save choices to carrier record
    const updatedCarriers = [...carriers];
    if (currentRound === 1) {
      updatedCarriers[currentCarrierIndex].round1Choice = selectedWeeks;
    } else {
      updatedCarriers[currentCarrierIndex].round2Choice = selectedWeeks;
    }

    const nextIndex = currentCarrierIndex + 1;
    const isEndOfRound = nextIndex >= carriers.length;
    const nextCarrierName = isEndOfRound ? 'End of Round' : carriers[nextIndex].name;

    // Trigger Notification
    await triggerOfficerAlert(currentCarrier.name, currentRound, selectedWeeks, nextCarrierName);

    setCarriers(updatedCarriers);
    setSelectedWeeks([]);

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

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>NALC Branch 366 Vacation Bidding Portal</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Active Round: <strong>Round {currentRound}</strong> | Up Now: <strong>{currentCarrier ? currentCarrier.name : 'Completed'}</strong> (Category {currentCarrier?.category})
        </p>
      </header>

      {/* Admin Panel Toggle */}
      <div style={{ marginBottom: '16px' }}>
        <button 
          onClick={() => setIsAdminOpen(!isAdminOpen)} 
          style={{ background: '#555', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isAdminOpen ? 'Close Roster & Slot Admin' : '⚙️ Manage Roster & Weekly Slots'}
        </button>
      </div>

      {/* Admin Section */}
      {isAdminOpen && (
        <div style={{ background: '#f4f4f4', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ccc' }}>
          <h3>Staffing & Slot Capacity Settings</h3>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            Total Craft Employees (Base for 11% / 14% calculation):
            <input 
              type="number" 
              value={totalEmployees} 
              onChange={(e) => setTotalEmployees(Number(e.target.value))} 
              style={{ marginLeft: '8px', padding: '4px', width: '60px' }}
            />
          </label>

          <h4>Carrier Category List</h4>
          <ul>
            {carriers.map((c, idx) => (
              <li key={c.id} style={{ marginBottom: '6px' }}>
                <strong>{c.name}</strong> - Category: 
                <select 
                  value={c.category} 
                  onChange={(e) => {
                    const copy = [...carriers];
                    copy[idx].category = Number(e.target.value);
                    setCarriers(copy);
                  }}
                  style={{ marginLeft: '8px' }}
                >
                  <option value={1}>Category 1 (13 Days Earned)</option>
                  <option value={2}>Category 2 (20 Days Earned)</option>
                  <option value={3}>Category 3 (26 Days Earned)</option>
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bidding Grid */}
      {currentCarrier && (
        <div>
          <div style={{ background: '#e6f0fa', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#003366' }}>{currentCarrier.name}'s Selection</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              Category {currentCarrier.category} — Selected ({selectedWeeks.length} week[s]): {selectedWeeks.join(', ') || 'None'}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', marginBottom: '20px' }}>
            {Array.from({ length: 52 }, (_, i) => i + 1).map((weekNum) => {
              const maxSlots = getSlotsForWeek(weekNum);
              const booked = getBookedCount(weekNum);
              const isFull = booked >= maxSlots;
              const isSelected = selectedWeeks.includes(weekNum);
              const isPrime = PRIME_TIME_WEEKS.includes(weekNum);

              return (
                <button
                  key={weekNum}
                  disabled={isFull && !isSelected}
                  onClick={() => handleWeekClick(weekNum)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    border: isSelected ? '2px solid #003366' : '1px solid #ccc',
                    background: isSelected ? '#003366' : isFull ? '#ffe6e6' : isPrime ? '#fff8dc' : '#fff',
                    color: isSelected ? '#fff' : isFull ? '#cc0000' : '#000',
                    textAlign: 'center',
                    cursor: isFull && !isSelected ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 'bold' }}>Week {weekNum}</div>
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
                    {isPrime ? '☀️ Prime Time' : 'Standard'}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
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
