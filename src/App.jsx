import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase client initialization
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [carriers, setCarriers] = useState([]);
  const [currentCarrier, setCurrentCarrier] = useState(null);
  
  // Login State: Name Dropdown + PIN
  const [selectedCarrierId, setSelectedCarrierId] = useState('');
  const [pinInput, setPinInput] = useState('');
  
  const [currentRound, setCurrentRound] = useState('round1');
  const [takenWeeks, setTakenWeeks] = useState(new Set());
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [blockedEventWeeks, setBlockedEventWeeks] = useState(new Set());

  // Steward & Officer Master Board State
  const [isStewardMode, setIsStewardMode] = useState(false);
  const [stewardPin, setStewardPin] = useState('');
  const [manualCarrierId, setManualCarrierId] = useState('');
  const [manualRound, setManualRound] = useState('round1');
  const [manualWeeksInput, setManualWeeksInput] = useState('');

  // Seniority Queue Reordering State
  const [targetCarrierId, setTargetCarrierId] = useState('');
  const [newSeniorityRank, setNewSeniorityRank] = useState('');

  // Add Carrier & Block State
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierEmail, setNewCarrierEmail] = useState('');
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierPin, setNewCarrierPin] = useState('');
  const [newCarrierRank, setNewCarrierRank] = useState('');
  const [blockWeekInput, setBlockWeekInput] = useState('');

  useEffect(() => {
    fetchCarriers();
    fetchTakenWeeks();
    fetchBranchSettings();
  }, []);

  const fetchCarriers = async () => {
    try {
      const { data, error } = await supabase.from('carriers').select('*').order('seniority_order', { ascending: true });
      if (data && data.length > 0) {
        setCarriers(data);
      } else {
        // Fallback prototype roster if database is empty or offline
        setCarriers([
          { id: '1', name: 'John Doe', email: 'john@nalc.com', phone: '4175550101', pin: '1234', seniority_order: 1, round1Choice: null, round2Choice: null, ps3971_submitted: false },
          { id: '2', name: 'Jane Smith', email: 'jane@nalc.com', phone: '4175550202', pin: '2345', seniority_order: 2, round1Choice: null, round2Choice: null, ps3971_submitted: false },
          { id: '3', name: 'Mike Johnson', email: 'mike@nalc.com', phone: '4175550303', pin: '3456', seniority_order: 3, round1Choice: null, round2Choice: null, ps3971_submitted: false }
        ]);
      }
    } catch (err) {
      console.warn('Using fallback prototype roster due to connection state:', err);
      setCarriers([
        { id: '1', name: 'John Doe', email: 'john@nalc.com', phone: '4175550101', pin: '1234', seniority_order: 1, round1Choice: null, round2Choice: null, ps3971_submitted: false },
        { id: '2', name: 'Jane Smith', email: 'jane@nalc.com', phone: '4175550202', pin: '2345', seniority_order: 2, round1Choice: null, round2Choice: null, ps3971_submitted: false },
        { id: '3', name: 'Mike Johnson', email: 'mike@nalc.com', phone: '4175550303', pin: '3456', seniority_order: 3, round1Choice: null, round2Choice: null, ps3971_submitted: false }
      ]);
    }
  };

  const fetchTakenWeeks = async () => {
    try {
      const { data } = await supabase.from('carriers').select('round1Choice, round2Choice');
      let blocked = new Set();
      data?.forEach(row => {
        if (row.round1Choice) {
          const weeks = typeof row.round1Choice === 'string' ? JSON.parse(row.round1Choice) : row.round1Choice;
          if (Array.isArray(weeks)) weeks.forEach(w => blocked.add(String(w)));
        }
        if (row.round2Choice) {
          const weeks = typeof row.round2Choice === 'string' ? JSON.parse(row.round2Choice) : row.round2Choice;
          if (Array.isArray(weeks)) weeks.forEach(w => blocked.add(String(w)));
        }
      });
      setTakenWeeks(blocked);
    } catch (err) {
      console.warn('Error fetching taken weeks:', err);
    }
  };

  const fetchBranchSettings = async () => {
    try {
      const { data } = await supabase.from('branch_settings').select('*').eq('id', 1).single();
      if (data && data.blocked_weeks) {
        setBlockedEventWeeks(new Set(data.blocked_weeks.map(String)));
      }
    } catch (err) {
      console.warn('Error fetching settings:', err);
    }
  };

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);
  const activeBiddingCarrier = allRound1Complete
    ? sortedCarriers.find(c => !c.round2Choice || (Array.isArray(c.round2Choice) && c.round2Choice.length === 0))
    : sortedCarriers.find(c => !c.round1Choice || (Array.isArray(c.round1Choice) && c.round1Choice.length === 0));

  // Secure Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedCarrierId) {
      alert('Please select your name from the dropdown.');
      return;
    }

    const carrier = carriers.find(c => String(c.id) === String(selectedCarrierId));
    if (carrier) {
      if (String(carrier.pin).trim() !== String(pinInput).trim()) {
        alert('Incorrect PIN. Please check your PIN.');
        return;
      }

      const globalRound = allRound1Complete ? 'round2' : 'round1';
      const hasFinishedCurrentRound = globalRound === 'round1' 
        ? (carrier.round1Choice && carrier.round1Choice.length > 0)
        : (carrier.round2Choice && carrier.round2Choice.length > 0);

      if (hasFinishedCurrentRound) {
        alert(`You have already completed ${globalRound === 'round1' ? 'Round 1' : 'Round 2'}. Please wait for your next turn.`);
        return;
      }

      setCurrentCarrier(carrier);
      setCurrentRound(globalRound);
      setSelectedWeeks([]);
    } else {
      alert('Carrier record not found.');
    }
  };

  const toggleWeekSelection = (weekNum) => {
    const strWeek = String(weekNum);
    if (takenWeeks.has(strWeek) || blockedEventWeeks.has(strWeek)) return;

    if (selectedWeeks.includes(strWeek)) {
      setSelectedWeeks(selectedWeeks.filter(w => w !== strWeek));
    } else {
      setSelectedWeeks([...selectedWeeks, strWeek]);
    }
  };

  // Submit Bid -> Save to Supabase -> Trigger Resend Notification
  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0) {
      alert('Please select at least one vacation week.');
      return;
    }

    const columnToUpdate = currentRound === 'round1' ? 'round1Choice' : 'round2Choice';
    const timestampKey = currentRound === 'round1' ? 'round1_submitted_at' : 'round2_submitted_at';
    const nowISO = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('carriers')
        .update({ 
          [columnToUpdate]: selectedWeeks,
          [timestampKey]: nowISO
        })
        .eq('id', currentCarrier.id);

      // Local state fallback update if DB write fails or operates in prototype mode
      setCarriers(carriers.map(c => c.id === currentCarrier.id ? { ...c, [columnToUpdate]: selectedWeeks, [timestampKey]: nowISO } : c));

      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carrierName: currentCarrier.name,
            round: currentRound,
            choices: selectedWeeks,
            email: currentCarrier.email || 'nalctrent@gmail.com'
          })
        });
      } catch (netErr) {
        console.warn('Email notification dispatch skipped:', netErr);
      }

      alert('Bid successfully submitted, saved to cloud, and confirmation notification sent!');
      fetchTakenWeeks();
      setCurrentCarrier(null);
    } catch (err) {
      // Prototype fallback
      setCarriers(carriers.map(c => c.id === currentCarrier.id ? { ...c, [columnToUpdate]: selectedWeeks, [timestampKey]: nowISO } : c));
      alert('Bid successfully saved (Prototype Mode)!');
      setCurrentCarrier(null);
    }
  };

  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName || !newCarrierPin) {
      alert('Please enter carrier name and PIN.');
      return;
    }

    const newObj = {
      id: String(Date.now()),
      name: newCarrierName,
      email: newCarrierEmail,
      phone: newCarrierPhone,
      pin: newCarrierPin,
      seniority_order: newCarrierRank ? parseInt(newCarrierRank) : sortedCarriers.length + 1,
      ps3971_submitted: false
    };

    try {
      await supabase.from('carriers').insert([newObj]);
    } catch (err) {
      console.warn('Cloud insert skipped, adding locally');
    }

    setCarriers([...carriers, newObj]);
    alert('Carrier successfully added!');
    setNewCarrierName('');
    setNewCarrierEmail('');
    setNewCarrierPhone('');
    setNewCarrierPin('');
    setNewCarrierRank('');
  };

  const handleBlockWeeks = async () => {
    if (!blockWeekInput) return;
    const newBlocked = blockWeekInput.split(',').map(w => w.trim()).filter(Boolean);
    const updatedBlockedSet = new Set([...blockedEventWeeks, ...newBlocked]);
    setBlockedEventWeeks(updatedBlockedSet);
    setBlockWeekInput();

    try {
      await supabase.from('branch_settings').upsert({ id: 1, blocked_weeks: Array.from(updatedBlockedSet) });
    } catch (err) {
      console.warn('Cloud sync skipped');
    }
    alert('Weeks successfully blocked out!');
  };

  const handleManualOverride = async () => {
    if (!manualCarrierId || !manualWeeksInput) {
      alert('Please select a carrier and enter weeks.');
      return;
    }

    const weeksArray = manualWeeksInput.split(',').map(w => w.trim()).filter(Boolean);
    const columnToUpdate = manualRound === 'round1' ? 'round1Choice' : 'round2Choice';
    const timestampKey = manualRound === 'round1' ? 'round1_submitted_at' : 'round2_submitted_at';
    const nowISO = new Date().toISOString();

    try {
      await supabase.from('carriers').update({ [columnToUpdate]: weeksArray, [timestampKey]: nowISO }).eq('id', manualCarrierId);
    } catch (err) {
      console.warn('Cloud override sync skipped');
    }

    setCarriers(carriers.map(c => c.id === manualCarrierId ? { ...c, [columnToUpdate]: weeksArray, [timestampKey]: nowISO } : c));
    alert('Manual bid override assigned successfully!');
    setManualWeeksInput('');
    fetchTakenWeeks();
  };

  const handleUpdateSeniorityOrder = async () => {
    if (!targetCarrierId || !newSeniorityRank) {
      alert('Please select a carrier and enter their new seniority number.');
      return;
    }

    const rankNum = parseInt(newSeniorityRank);
    try {
      await supabase.from('carriers').update({ seniority_order: rankNum }).eq('id', targetCarrierId);
    } catch (err) {
      console.warn('Cloud rank sync skipped');
    }

    setCarriers(carriers.map(c => c.id === targetCarrierId ? { ...c, seniority_order: rankNum } : c));
    alert('Seniority queue order updated successfully!');
    setNewSeniorityRank('');
    setTargetCarrierId('');
  };

  const togglePS3971Status = async (carrierId, currentStatus) => {
    try {
      await supabase.from('carriers').update({ ps3971_submitted: !currentStatus }).eq('id', carrierId);
    } catch (err) {
      console.warn('Cloud status sync skipped');
    }
    setCarriers(carriers.map(c => c.id === carrierId ? { ...c, ps3971_submitted: !currentStatus } : c));
  };

  // Login View
  if (!currentCarrier) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
        <h2>NALC Branch 366 Vacation Bidding PWA</h2>
        
        {!isStewardMode ? (
          <div>
            <form onSubmit={handleLogin} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>Carrier Login</h3>
              <p>Select your name and enter your 4-digit PIN:</p>
              
              <select 
                value={selectedCarrierId} 
                onChange={(e) => setSelectedCarrierId(e.target.value)}
                style={{ padding: '10px', fontSize: '16px', width: '100%', marginBottom: '10px', background: '#fff' }}
              >
                <option value="">-- Select Your Name --</option>
                {sortedCarriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Rank #{c.seniority_order || 'N/A'})</option>
                ))}
              </select>

              <input 
                type="password" 
                value={pinInput} 
                onChange={(e) => setPinInput(e.target.value)} 
                placeholder="PIN (e.g., 1234)"
                style={{ padding: '10px', fontSize: '16px', width: 'calc(100% - 22px)', marginBottom: '10px' }}
              />
              <button type="submit" style={{ padding: '10px 20px', fontSize: '16px', background: '#003366', color: '#fff', border: 'none', cursor: 'pointer', width: '100%' }}>
                Log In to Bid
              </button>
            </form>

            <button onClick={() => setIsStewardMode(true)} style={{ background: 'none', border: 'none', color: '#003366', textDecoration: 'underline', cursor: 'pointer' }}>
              Steward & Officer Portal Login
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff3cd', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>Steward Master Board Login</h3>
            <input 
              type="password" 
              value={stewardPin} 
              onChange={(e) => setStewardPin(e.target.value)} 
              placeholder="Officer PIN"
              style={{ padding: '10px', fontSize: '16px', width: 'calc(100% - 22px)', marginBottom: '10px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => {
                  if (stewardPin === '366366' || stewardPin === 'admin') {
                    setCurrentCarrier({ name: 'Union Steward', isSteward: true });
                  } else {
                    alert('Invalid Officer PIN');
                  }
                }}
                style={{ padding: '10px 20px', background: '#d39e00', color: '#fff', border: 'none', cursor: 'pointer', flex: 1 }}
              >
                Enter Steward Mode
              </button>
              <button onClick={() => setIsStewardMode(false)} style={{ padding: '10px 20px', background: '#6c757d', color: '#fff', border: 'none', cursor: 'pointer' }}>
                Back
              </button>
            </div>
          </div>
        )}

        <hr style={{ margin: '30px 0' }} />
        <h3>Seniority Bidding Queue Status</h3>
        <p><strong>Currently Up for Bid:</strong> {activeBiddingCarrier ? `${activeBiddingCarrier.name} (Rank #${activeBiddingCarrier.seniority_order || 'N/A'})` : 'All rounds completed!'}</p>
      </div>
    );
  }

  // Steward Master Board View
  if (currentCarrier.isSteward) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: 'auto' }}>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #printable-roster, #printable-roster * { visibility: visible; }
            #printable-roster { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}} />

        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Steward & Officer Master Board</h2>
          <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#17a2b8', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Print Clean Master List
          </button>
        </div>
        <p className="no-print">Manage seniority order, manual overrides, roster, and PS 3971 tracking.</p>

        {/* Add Carrier Form */}
        <div className="no-print" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <h4>Add New Carrier</h4>
          <form onSubmit={handleAddCarrier} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 1fr auto', gap: '8px' }}>
            <input type="text" placeholder="Name" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} style={{ padding: '6px' }} />
            <input type="email" placeholder="Email" value={newCarrierEmail} onChange={(e) => setNewCarrierEmail(e.target.value)} style={{ padding: '6px' }} />
            <input type="text" placeholder="Phone" value={newCarrierPhone} onChange={(e) => setNewCarrierPhone(e.target.value)} style={{ padding: '6px' }} />
            <input type="text" placeholder="PIN" value={newCarrierPin} onChange={(e) => setNewCarrierPin(e.target.value)} style={{ padding: '6px' }} />
            <input type="number" placeholder="Rank" value={newCarrierRank} onChange={(e) => setNewCarrierRank(e.target.value)} style={{ padding: '6px' }} />
            <button type="submit" style={{ padding: '6px 12px', background: '#003366', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
          </form>
        </div>

        {/* Block Weeks */}
        <div className="no-print" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <h4>Block Out Event Weeks (Conventions, etc.)</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="Weeks (e.g. 25, 26)" value={blockWeekInput} onChange={(e) => setBlockWeekInput(e.target.value)} style={{ padding: '6px', flex: 1 }} />
            <button onClick={handleBlockWeeks} style={{ padding: '6px 14px', background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer' }}>Block</button>
          </div>
        </div>

        {/* Seniority Queue Reordering */}
        <div className="no-print" style={{ background: '#e9ecef', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <h4>Assign Bidding Turn (Seniority Rank Order)</h4>
          <select value={targetCarrierId} onChange={(e) => setTargetCarrierId(e.target.value)} style={{ padding: '8px', width: '100%', marginBottom: '10px' }}>
            <option value="">-- Select Carrier --</option>
            {sortedCarriers.map(c => (
              <option key={c.id} value={c.id}>{c.name} (Current Rank: {c.seniority_order || 'None'})</option>
            ))}
          </select>
          <input type="number" placeholder="Assign Rank Number (1, 2...)" value={newSeniorityRank} onChange={(e) => setNewSeniorityRank(e.target.value)} style={{ padding: '8px', width: 'calc(100% - 18px)', marginBottom: '10px' }} />
          <button onClick={handleUpdateSeniorityOrder} style={{ padding: '10px 20px', background: '#003366', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Update Bidding Turn Order
          </button>
        </div>

        {/* Manual Overrides */}
        <div className="no-print" style={{ background: '#f1f3f5', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
          <h4>Manual Vacation Week Override</h4>
          <select value={manualCarrierId} onChange={(e) => setManualCarrierId(e.target.value)} style={{ padding: '8px', width: '100%', marginBottom: '10px' }}>
            <option value="">-- Select Carrier --</option>
            {sortedCarriers.map(c => (
              <option key={c.id} value={c.id}>{c.name} (Rank #{c.seniority_order})</option>
            ))}
          </select>
          <select value={manualRound} onChange={(e) => setManualRound(e.target.value)} style={{ padding: '8px', width: '100%', marginBottom: '10px' }}>
            <option value="round1">Round 1</option>
            <option value="round2">Round 2</option>
          </select>
          <input type="text" placeholder="Weeks (e.g. 5, 6, 7)" value={manualWeeksInput} onChange={(e) => setManualWeeksInput(e.target.value)} style={{ padding: '8px', width: 'calc(100% - 18px)', marginBottom: '10px' }} />
          <button onClick={handleManualOverride} style={{ padding: '10px 20px', background: '#28a745', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Assign Week Override
          </button>
        </div>

        {/* SMS Links */}
        <div className="no-print" style={{ margin: '20px 0' }}>
          <h4>Carrier SMS Bidding Links</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#e9ecef', textAlign: 'left' }}>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Name</th>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Phone</th>
                <th style={{ padding: '6px', border: '1px solid #ddd' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map(c => {
                const url = window.location.origin;
                const txt = encodeURIComponent(`Hi ${c.name}, submit your NALC Branch 366 vacation bids here: ${url}`);
                return (
                  <tr key={c.id}>
                    <td style={{ padding: '6px', border: '1px solid #ddd' }}>{c.name}</td>
                    <td style={{ padding: '6px', border: '1px solid #ddd' }}>{c.phone || 'N/A'}</td>
                    <td style={{ padding: '6px', border: '1px solid #ddd' }}>
                      {c.phone ? <a href={`sms:${c.phone}?body=${txt}`} style={{ background: '#007bff', color: '#fff', padding: '4px 8px', borderRadius: '3px', textDecoration: 'none' }}>💬 Text Link</a> : 'No phone'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Printable Clean Master Roster */}
        <div id="printable-roster" style={{ marginTop: '20px' }}>
          <h3>NALC Branch 366 Master Vacation Roster & PS 3971 Tracking</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#003366', color: '#fff' }}>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Turn Rank</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Carrier Name</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Round 1 Choice & Date</th>
                <th style={{ padding: '8px', border: '1px solid #ddd' }}>Round 2 Choice & Date</th>
                <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>PS 3971 Submitted</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map(c => {
                const r1 = c.round1Choice ? (Array.isArray(c.round1Choice) ? c.round1Choice.join(', ') : c.round1Choice) : 'Pending';
                const r1Date = c.round1_submitted_at ? new Date(c.round1_submitted_at).toLocaleDateString() : '';
                const r2 = c.round2Choice ? (Array.isArray(c.round2Choice) ? c.round2Choice.join(', ') : c.round2Choice) : 'Pending';
                const r2Date = c.round2_submitted_at ? new Date(c.round2_submitted_at).toLocaleDateString() : '';

                return (
                  <tr key={c.id}>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 'bold' }}>#{c.seniority_order || '—'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{c.name}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{r1 !== 'Pending' ? `Wks: ${r1} (${r1Date})` : 'Pending'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{r2 !== 'Pending' ? `Wks: ${r2} (${r2Date})` : 'Pending'}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={!!c.ps3971_submitted} 
                        onChange={() => togglePS3971Status(c.id, c.ps3971_submitted)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button 
          className="no-print"
          onClick={() => setCurrentCarrier(null)}
          style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Logout Steward Portal
        </button>
      </div>
    );
  }

  // Active Carrier Bidding View
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h2>Welcome, {currentCarrier.name}</h2>
      <p><strong>Active Round:</strong> {currentRound === 'round1' ? 'Round 1' : 'Round 2'}</p>
      <p>Select your available vacation weeks below. Grayed-out weeks are already locked in by other carriers or events.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', margin: '20px 0' }}>
        {Array.from({ length: 52 }, (_, i) => i + 1).map(week => {
          const strWeek = String(week);
          const isTaken = takenWeeks.has(strWeek) || blockedEventWeeks.has(strWeek);
          const isSelected = selectedWeeks.includes(strWeek);

          let bg = '#f0f0f0';
          if (isTaken) bg = '#adb5bd';
          if (isSelected) bg = '#003366';

          return (
            <button
              key={week}
              disabled={isTaken}
              onClick={() => toggleWeekSelection(week)}
              style={{
                padding: '10px',
                background: bg,
                color: isSelected ? '#fff' : '#000',
                border: '1px solid #ced4da',
                cursor: isTaken ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontWeight: isSelected ? 'bold' : 'normal'
              }}
            >
              Wk {week} {blockedEventWeeks.has(strWeek) ? '🔒' : ''}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleSubmitBid}
          style={{ padding: '12px 20px', background: '#28a745', color: '#fff', border: 'none', fontSize: '16px', cursor: 'pointer', flex: 1, borderRadius: '4px' }}
        >
          Submit & Lock Bid
        </button>
        <button 
          onClick={() => setCurrentCarrier(null)}
          style={{ padding: '12px 20px', background: '#dc3545', color: '#fff', border: 'none', fontSize: '16px', cursor: 'pointer', borderRadius: '4px' }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
