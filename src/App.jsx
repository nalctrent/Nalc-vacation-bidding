import React, { useState } from 'react';

const INITIAL_CARRIERS = [
  { id: '1', name: 'Trenton Bauer', category: 3, round1Choice: [], round2Choice: [], completed: false },
  { id: '2', name: 'Jessica', category: 2, round1Choice: [], round2Choice: [], completed: false },
  { id: '3', name: 'John Doe', category: 1, round1Choice: [], round2Choice: [], completed: false },
  { id: '4', name: 'Jane Smith', category: 3, round1Choice: [], round2Choice: [], completed: false },
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
    
    // Prime time: June (5), July (6), August (7)
    const month = start.getMonth();
    const isPrimeTime = month === 5 || month === 6 || month === 7;

    weeks.push({
      weekNum: i + 1,
      dateString,
      isPrimeTime
    });
  }
  return weeks;
};

const CALENDAR_WEEKS = generateYearWeeks();

export default function App() {
  const [carriers, setCarriers] = useState(INITIAL_CARRIERS);
  const [currentCarrierIndex, setCurrentCarrierIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  
  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState({});
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const currentCarrier = carriers[currentCarrierIndex];

  const getSlotsForWeek = (weekObj) => {
    if (customSlots[weekObj.weekNum] !== undefined) {
      return customSlots[weekObj.weekNum];
    }
    const rate = weekObj.isPrimeTime ? 0.14 : 0.11;
    return Math.max(1, Math.round(totalEmployees * rate));
  };

  const getBookedCount = (weekNum) => {
    return carriers.reduce((count, c) => {
      const r1 = c.round1Choice.includes(weekNum) ? 1 : 0;
      const r2 = c.round2Choice.includes(weekNum) ? 1 : 0;
      return count + r1 + r2;
    }, 0);
  };

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
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  const handleWeekClick = (weekNum) => {
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
    if (selectedWeeks.length === 0) {
      alert('Please select at least one week before submitting.');
      return;
    }

    // Round 1 validation rule for 3 selections
    if (currentRound === 1 && selectedWeeks.length === 3) {
      const [w1, w2, w3] = selectedWeeks;
      const isAllConsecutive = (w2 === w1 + 1 && w3 === w2 + 1);
      const isTwoConsecutivePlusOne = (w2 === w1 + 1) || (w3 === w2 + 1);

      if (!isAllConsecutive && !isTwoConsecutivePlusOne) {
        alert('LMOU Rule Violation: When picking 3 weeks in Round 1, they must either be 3 consecutive weeks OR a 2-week consecutive block plus 1 separate week. They cannot all be completely separated.');
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
    const nextCarrierName = isEndOfRound ? 'End of Round' : carriers[nextIndex].name;

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
    <div style={{ maxWidth: '950px', margin: '0 auto', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ background: '#003366', color: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>NALC Branch 366 Vacation Bidding Portal</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Active Round: <strong>Round {currentRound}</strong> | Up Now: <strong>{currentCarrier ? currentCarrier.name : 'Completed'}</strong> (Category {currentCarrier?.category})
        </p>
      </header>

      <div style={{ marginBottom: '16px' }}>
        <button 
          onClick={() => setIsAdminOpen(!isAdminOpen)} 
          style={{ background: '#555', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer' }}
        >
          {isAdminOpen ? 'Close Roster & Slot Admin' : '⚙️ Manage Roster & Weekly Slots'}
        </button>
      </div>

      {isAdminOpen && (
        <div style={{ background: '#f4f4f4', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ccc' }}>
          <h3>Staffing & Slot Capacity Settings</h3>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            Total Craft Employees (Base for 11% / 14% Prime calculation):
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
                  <option value={1}>Category 1 (10 Days Max)</option>
                  <option value={2}>Category 2 (15 Days Max)</option>
                  <option value={3}>Category 3 (15 Days Max)</option>
                </select>
              </li>
            ))}
          </ul>

          <h4 style={{ marginTop: '14px' }}>Manual Slot Overrides per Week</h4>
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

      {currentCarrier && (
        <div>
          <div style={{ background: '#e6f0fa', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: '#003366' }}>{currentCarrier.name}'s Selection</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
              Category {currentCarrier.category} — Selected Weeks: {selectedWeeks.join(', ') || 'None'}
            </p>
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
                    cursor: isFull && !isSelected ? 'not-allowed' : 'pointer',
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
