import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [carriers, setCarriers] = useState([]);
  const [currentCarrier, setCurrentCarrier] = useState(null);
  const [pinInput, setPinInput] = useState('');
  
  const [currentRound, setCurrentRound] = useState('round1');
  const [takenWeeks, setTakenWeeks] = useState(new Set());
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [blockedEventWeeks, setBlockedEventWeeks] = useState(new Set());

  // Steward & Officer Master Board State
  const [isStewardMode, setIsStewardMode] = useState(false);
  const [stewardPin, setStewardPin] = useState('');
  
  // Manual Overrides & Queue State
  const [manualCarrierId, setManualCarrierId] = useState('');
  const [manualRound, setManualRound] = useState('round1');
  const [manualWeeksInput, setManualWeeksInput] = useState('');
  const [targetCarrierId, setTargetCarrierId] = useState('');
  const [newSeniorityRank, setNewSeniorityRank] = useState('');

  // Add Carrier Form State
  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierEmail, setNewCarrierEmail] = useState('');
  const [newCarrierPin, setNewCarrierPin] = useState('');
  const [newCarrierRank, setNewCarrierRank] = useState('');

  // Block-Out Week State (NALC Events, Conventions, etc.)
  const [blockWeekInput, setBlockWeekInput] = useState('');

  useEffect(() => {
    fetchCarriers();
    fetchTakenWeeks();
    fetchBlockedWeeks();
  }, []);

  const fetchCarriers = async () => {
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .order('seniority_order', { ascending: true });
    if (data) setCarriers(data);
    if (error) console.error('Error fetching carriers:', error.message);
  };

  const fetchTakenWeeks = async () => {
    const { data, error } = await supabase.from('carriers').select('round1Choice, round2Choice');
    if (error) return;

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
  };

  const fetchBlockedWeeks = async () => {
    // Fetches branch-wide event blockouts if stored in Supabase (or defaults empty)
    const { data } = await supabase.from('branch_settings').select('*').eq('id', 1).single();
    if (data && data.blocked_weeks) {
      setBlockedEventWeeks(new Set(data.blocked_weeks.map(String)));
    }
  };

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);

  const activeBiddingCarrier = allRound1Complete
    ? sortedCarriers.find(c => !c.round2Choice || (Array.isArray(c.round2Choice) && c.round2Choice.length === 0))
    : sortedCarriers.find(c => !c.round1Choice || (Array.isArray(c.round1Choice) && c.round1Choice.length === 0));

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('carriers')
      .select('*')
      .eq('pin', pinInput.trim())
      .single();

    if (data && !error) {
      const globalRound = allRound1Complete ? 'round2' : 'round1';
      const hasFinishedCurrentRound = globalRound === 'round1' 
        ? (data.round1Choice && data.round1Choice.length > 0)
        : (data.round2Choice && data.round2Choice.length > 0);

      if (hasFinishedCurrentRound) {
        alert(`You have already completed ${globalRound === 'round1' ? 'Round 1' : 'Round 2'}. Please wait for your next turn.`);
        return;
      }

      setCurrentCarrier(data);
      setCurrentRound(globalRound);
      setSelectedWeeks([]);
    } else {
      alert('Invalid PIN. Please check your credentials or contact a union steward.');
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

  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0) {
      alert('Please select at least one vacation week before locking in your bid.');
      return;
    }

    const columnToUpdate = currentRound === 'round1' ? 'round1Choice' : 'round2Choice';
    const timestampKey = currentRound === 'round1' ? 'round1_submitted_at' : 'round2_submitted_at';

    const { error } = await supabase
      .from('carriers')
      .update({ 
        [columnToUpdate]: selectedWeeks,
        [timestampKey]: new Date().toISOString()
      })
      .eq('id', currentCarrier.id);

    if (!error) {
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
      } catch (err) {
        console.error('Notification dispatch warning:', err);
      }

      alert(`${currentRound === 'round1' ? 'Round 1' : 'Round 2'} bid successfully locked in!`);
      fetchCarriers();
      fetchTakenWeeks();
      setCurrentCarrier(null);
    } else {
      alert('Database error saving bid: ' + error.message);
    }
  };

  // Steward Action: Add New Carrier to Roster
  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName || !newCarrierPin) {
      alert('Please enter carrier name and PIN.');
      return;
    }

    const { error } = await supabase.from('carriers').insert([{
      name: newCarrierName,
      email: newCarrierEmail,
      pin: newCarrierPin,
      seniority_order: newCarrierRank ? parseInt(newCarrierRank) : sortedCarriers.length + 1,
      ps3971_submitted: false
    }]);

    if (!error) {
      alert('Carrier successfully added to roster!');
      setNewCarrierName('');
      setNewCarrierEmail('');
      setNewCarrierPin('');
      setNewCarrierRank('');
      fetchCarriers();
    } else {
      alert('Error adding carrier: ' + error.message);
    }
  };

  // Steward Action: Block Out Event Weeks (NALC Conventions, etc.)
  const handleBlockWeeks = async () => {
    if (!blockWeekInput) return;
    const newBlocked = blockWeekInput.split(',').map(w => w.trim()).filter(Boolean);
    const updatedBlockedSet = new Set([...blockedEventWeeks, ...newBlocked]);
    const blockedArray = Array.from(updatedBlockedSet);

    setBlockedEventWeeks(updatedBlockedSet);
    setBlockWeekInput('');

    // Save to branch settings table
    await supabase.from('branch_settings').upsert({ id: 1, blocked_weeks: blockedArray });
    alert('Weeks successfully blocked out for branch events!');
  };

  const handleManualOverride = async () => {
    if (!manualCarrierId || !manualWeeksInput) {
      alert('Please select a carrier and specify the weeks.');
      return;
    }

    const weeksArray = manualWeeksInput.split(',').map(w => w.trim()).filter(Boolean);
    const columnToUpdate = manualRound === 'round1' ? 'round1Choice' : 'round2Choice';
    const timestampKey = manualRound === 'round1' ? 'round1_submitted_at' : 'round2_submitted_at';

    const { error } = await supabase
      .from('carriers')
      .update({ 
        [columnToUpdate]: weeksArray,
        [timestampKey]: new Date().toISOString()
      })
      .eq('id', manualCarrierId);

    if (!error) {
      alert('Manual vacation slot override successfully applied!');
      setManualWeeksInput('');
      fetchCarriers();
      fetchTakenWeeks();
    } else {
      alert('Error executing override: ' + error.message);
    }
  };

  const handleUpdateSeniorityOrder = async () => {
    if (!targetCarrierId || !newSeniorityRank) {
      alert('Please select a carrier and enter their exact seniority turn position.');
      return;
    }

    const { error } = await supabase
      .from('carriers')
      .update({ seniority_order: parseInt(newSeniorityRank) })
      .eq('id', targetCarrierId);

    if (!error) {
      alert('Seniority bidding order successfully updated!');
      setNewSeniorityRank('');
      setTargetCarrierId('');
      fetchCarriers();
    } else {
      alert('Error updating queue sequence: ' + error.message);
    }
  };

  const togglePS3971Status = async (carrierId, currentStatus) => {
    const { error } = await supabase
      .from('carriers')
      .update({ ps3971_submitted: !currentStatus })
      .eq('id', carrierId);

    if (!error) {
      fetchCarriers();
    }
  };

  if (!currentCarrier) {
    return (
      <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '600px', margin: '40px auto', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#003366', borderBottom: '2px solid #003366', paddingBottom: '8px' }}>NALC Branch 366 Vacation Bidding Portal</h2>
        
        {!isStewardMode ? (
          <div>
            <form onSubmit={handleLogin} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '6px', margin: '20px 0', border: '1px solid #e9ecef' }}>
              <h3 style={{ marginTop: 0 }}>Carrier Login</h3>
              <p style={{ color: '#555', fontSize: '14px' }}>Enter your assigned 4-digit PIN to access your personal leave bidding portal:</p>
              <input 
                type="password" 
                value={pinInput} 
                onChange={(e) => setPinInput(e.target.value)} 
                placeholder="Enter 4-digit PIN"
                style={{ padding: '12px', fontSize: '16px', width: 'calc(100% - 26px)', marginBottom: '12px', borderRadius: '4px', border: '1px solid #ced4da' }}
              />
              <button type="submit" style={{ padding: '12px 20px', fontSize: '16px', background: '#003366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 'bold' }}>
                Secure Carrier Login
              </button>
            </form>

            <button onClick={() => setIsStewardMode(true)} style={{ background: 'none', border: 'none', color: '#003366', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}>
              Switch to Steward & Officer Master Portal
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff3cd', padding: '20px', borderRadius: '6px', margin: '20px 0', border: '1px solid #ffeeba' }}>
            <h3 style={{ marginTop: 0, color: '#856404' }}>Steward & Officer Authorization</h3>
            <p style={{ fontSize: '14px', color: '#856404' }}>Enter executive officer PIN to access master branch controls:</p>
            <input 
              type="password" 
              value={stewardPin} 
              onChange={(e) => setStewardPin(e.target.value)} 
              placeholder="Officer Master PIN"
              style={{ padding: '12px', fontSize: '16px', width: 'calc(100% - 26px)', marginBottom: '12px', borderRadius: '4px', border: '1px solid #ffeeba' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => {
                  if (stewardPin === '366366' || stewardPin === 'admin') {
                    setCurrentCarrier({ name: 'Branch Union Steward', isSteward: true });
                  } else {
                    alert('Invalid Officer PIN clearance.');
                  }
                }}
                style={{ padding: '10px 20px', background: '#d39e00', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}
              >
                Authenticate Steward
              </button>
              <button onClick={() => setIsStewardMode(false)} style={{ padding: '10px 20px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '30px', padding: '15px', background: '#e2e3e5', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#383d41' }}>Active Seniority Queue Status ({allRound1Complete ? 'Round 2' : 'Round 1'})</h4>
          <p style={{ margin: 0, fontSize: '15px' }}>
            <strong>Currently Up for Bid:</strong> {activeBiddingCarrier ? `${activeBiddingCarrier.name} (Turn Rank #${activeBiddingCarrier.seniority_order || 'N/A'})` : 'All scheduled bidding rounds completed.'}
          </p>
        </div>
      </div>
    );
  }

  if (currentCarrier.isSteward) {
    return (
      <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '950px', margin: '20px auto', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        
        {/* CSS Print Rules: Hides everything except the printable roster section when printing */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            #printable-roster, #printable-roster * { visibility: visible; }
            #printable-roster { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
        `}} />

        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #003366', paddingBottom: '10px' }}>
          <div>
            <h2 style={{ color: '#003366', margin: 0 }}>Steward & Officer Master Board</h2>
            <p style={{ color: '#666', margin: '4px 0 0 0' }}>Phase: <strong>{allRound1Complete ? 'Round 2' : 'Round 1'}</strong></p>
          </div>
          <button 
            onClick={() => window.print()} 
            style={{ padding: '10px 16px', background: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🖨️ Print Clean Master List
          </button>
        </div>

        {/* 1. Add Carrier to Roster */}
        <div className="no-print" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px', margin: '20px 0', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#003366' }}>Add New Carrier to Roster</h3>
          <form onSubmit={handleAddCarrier} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Carrier Full Name" 
              value={newCarrierName}
              onChange={(e) => setNewCarrierName(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
            <input 
              type="email" 
              placeholder="Email (for Resend alerts)" 
              value={newCarrierEmail}
              onChange={(e) => setNewCarrierEmail(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
            <input 
              type="text" 
              placeholder="4-Digit PIN" 
              value={newCarrierPin}
              onChange={(e) => setNewCarrierPin(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
            <input 
              type="number" 
              placeholder="Rank #" 
              value={newCarrierRank}
              onChange={(e) => setNewCarrierRank(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
            <button type="submit" style={{ padding: '8px 16px', background: '#003366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Add Carrier
            </button>
          </form>
        </div>

        {/* 2. Block-Out Weeks Manager */}
        <div className="no-print" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px', margin: '20px 0', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#003366' }}>Block Out Weeks (NALC Events / Branch Conventions)</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Weeks to block (e.g. 25, 26, 40)" 
              value={blockWeekInput}
              onChange={(e) => setBlockWeekInput(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', flex: 1 }}
            />
            <button onClick={handleBlockWeeks} style={{ padding: '8px 16px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Block Weeks
            </button>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#666' }}>
            Currently blocked branch event weeks: {Array.from(blockedEventWeeks).join(', ') || 'None'}
          </p>
        </div>

        {/* 3. Seniority Queue Turn Manager */}
        <div className="no-print" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px', margin: '20px 0', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#003366' }}>Manage Bidding Turn Queue (Seniority Order)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px' }}>
            <select 
              value={targetCarrierId} 
              onChange={(e) => setTargetCarrierId(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
            >
              <option value="">-- Select Carrier --</option>
              {sortedCarriers.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Rank: #{c.seniority_order || 'Unassigned'})</option>
              ))}
            </select>
            <input 
              type="number" 
              placeholder="Rank (1, 2...)" 
              value={newSeniorityRank}
              onChange={(e) => setNewSeniorityRank(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
            <button onClick={handleUpdateSeniorityOrder} style={{ padding: '10px 16px', background: '#003366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Assign Turn
            </button>
          </div>
        </div>

        {/* 4. Manual Slot Overrides */}
        <div className="no-print" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px', margin: '20px 0', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#003366' }}>Manual Vacation Week Slot Override</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px' }}>
            <select 
              value={manualCarrierId} 
              onChange={(e) => setManualCarrierId(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
            >
              <option value="">-- Select Carrier --</option>
              {sortedCarriers.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Rank #{c.seniority_order})</option>
              ))}
            </select>
            <select 
              value={manualRound} 
              onChange={(e) => setManualRound(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
            >
              <option value="round1">Round 1</option>
              <option value="round2">Round 2</option>
            </select>
            <input 
              type="text" 
              placeholder="Weeks (e.g. 14, 15)" 
              value={manualWeeksInput}
              onChange={(e) => setManualWeeksInput(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
            <button onClick={handleManualOverride} style={{ padding: '10px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Override
            </button>
          </div>
        </div>

        {/* PRINTABLE ONLY SECTION: Master Vacation Roster & PS 3971 Checklist */}
        <div id="printable-roster" style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '18px', color: '#003366', borderBottom: '2px solid #003366', paddingBottom: '6px' }}>
            NALC Branch 366 — Master Vacation Roster & PS 3971 Tracking
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#003366', color: '#fff', textAlign: 'left' }}>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Rank</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Carrier Name</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Round 1 Weeks & Date</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6' }}>Round 2 Weeks & Date</th>
                  <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>PS 3971 Submitted</th>
                </tr>
              </thead>
              <tbody>
                {sortedCarriers.map(c => {
                  const r1Choices = c.round1Choice ? (Array.isArray(c.round1Choice) ? c.round1Choice.join(', ') : c.round1Choice) : 'Pending';
                  const r1Date = c.round1_submitted_at ? new Date(c.round1_submitted_at).toLocaleDateString() : '';

                  const r2Choices = c.round2Choice ? (Array.isArray(c.round2Choice) ? c.round2Choice.join(', ') : c.round2Choice) : 'Pending';
                  const r2Date = c.round2_submitted_at ? new Date(c.round2_submitted_at).toLocaleDateString() : '';

                  return (
                    <tr key={c.id}>
                      <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold' }}>#{c.seniority_order || '—'}</td>
                      <td style={{ padding: '10px', border: '1px solid #dee2e6', fontWeight: '500' }}>{c.name}</td>
                      <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                        {r1Choices !== 'Pending' ? `Wks: ${r1Choices} (${r1Date})` : <span style={{ color: '#999' }}>Pending</span>}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>
                        {r2Choices !== 'Pending' ? `Wks: ${r2Choices} (${r2Date})` : <span style={{ color: '#999' }}>Pending</span>}
                      </td>
                      <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={!!c.ps3971_submitted} 
                          onChange={() => togglePS3971Status(c.id, c.ps3971_submitted)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <button 
          className="no-print"
          onClick={() => setCurrentCarrier(null)}
          style={{ marginTop: '30px', padding: '12px 20px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Exit Steward Portal
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '650px', margin: '20px auto', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #003366', paddingBottom: '10px', marginBottom: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#003366' }}>Welcome, {currentCarrier.name}</h2>
          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>Seniority Turn Rank: <strong>#{currentCarrier.seniority_order || 'N/A'}</strong></p>
        </div>
        <div style={{ background: '#e9ecef', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', color: '#003366', fontSize: '14px' }}>
          {currentRound === 'round1' ? 'Round 1 Bidding' : 'Round 2 Bidding'}
        </div>
      </div>

      <p style={{ color: '#445', fontSize: '15px', lineHeight: '1.5' }}>
        Select your desired vacation weeks from the calendar grid below. Grayed-out weeks are already locked in by senior carriers or blocked for union events.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', margin: '20px 0' }}>
        {Array.from({ length: 52 }, (_, i) => i + 1).map(week => {
          const strWeek = String(week);
          const isTaken = takenWeeks.has(strWeek) || blockedEventWeeks.has(strWeek);
          const isSelected = selectedWeeks.includes(strWeek);

          let bg = '#f8f9fa';
          let borderColor = '#ced4da';
          let textColor = '#212529';

          if (isTaken) {
            bg = '#e9ecef';
            borderColor = '#adb5bd';
            textColor = '#6c757d';
          } else if (isSelected) {
            bg = '#003366';
            borderColor = '#002244';
            textColor = '#ffffff';
          }

          return (
            <button
              key={week}
              disabled={isTaken}
              onClick={() => toggleWeekSelection(week)}
              style={{
                padding: '12px 6px',
                background: bg,
                color: textColor,
                border: `1px solid ${borderColor}`,
                cursor: isTaken ? 'not-allowed' : 'pointer',
                borderRadius: '6px',
                fontWeight: isSelected ? 'bold' : 'normal',
                fontSize: '14px'
              }}
            >
              Wk {week} {blockedEventWeeks.has(strWeek) ? '🔒' : ''}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
        <button 
          onClick={handleSubmitBid}
          style={{ padding: '14px 20px', background: '#28a745', color: '#fff', border: 'none', fontSize: '16px', cursor: 'pointer', flex: 1, borderRadius: '6px', fontWeight: 'bold' }}
        >
          Submit & Lock Cloud Bid
        </button>
        <button 
          onClick={() => setCurrentCarrier(null)}
          style={{ padding: '14px 20px', background: '#6c757d', color: '#fff', border: 'none', fontSize: '16px', cursor: 'pointer', borderRadius: '6px', fontWeight: 'bold' }}
        >
          Logout Session
        </button>
      </div>
    </div>
  );
}
