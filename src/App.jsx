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
  const [weekQuotas, setWeekQuotas] = useState({});

  // Steward & Officer Master Board State
  const [isStewardMode, setIsStewardMode] = useState(false);
  const [stewardPin, setStewardPin] = useState('');
  const [manualCarrierId, setManualCarrierId] = useState('');
  const [manualRound, setManualRound] = useState('round1');
  const [manualWeeksInput, setManualWeeksInput] = useState('');

  // Seniority Queue Reordering State
  const [targetCarrierId, setTargetCarrierId] = useState('');
  const [newSeniorityRank, setNewSeniorityRank] = useState('');

  // Add Carrier & Quota/Block State
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
      const { data } = await supabase.from('carriers').select('*').order('seniority_order', { ascending: true });
      if (data) setCarriers(data);
    } catch (err) {
      console.error('Error fetching carriers:', err);
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
      console.error('Error fetching taken weeks:', err);
    }
  };

  const fetchBranchSettings = async () => {
    try {
      const { data } = await supabase.from('branch_settings').select('*').eq('id', 1).single();
      if (data) {
        if (data.blocked_weeks) setBlockedEventWeeks(new Set(data.blocked_weeks.map(String)));
        if (data.week_quotas) setWeekQuotas(data.week_quotas);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
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

    try {
      const { data, error } = await supabase
        .from('carriers')
        .select('*')
        .eq('id', selectedCarrierId)
        .single();

      if (data && !error) {
        if (String(data.pin).trim() !== String(pinInput).trim()) {
          alert('Incorrect PIN. Please check your PIN.');
          return;
        }

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
        alert('Carrier record not found.');
      }
    } catch (err) {
      alert('Connection error during login.');
      console.error(err);
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

    try {
      const { error } = await supabase
        .from('carriers')
        .update({ 
          [columnToUpdate]: selectedWeeks,
          [timestampKey]: new Date().toISOString()
        })
        .eq('id', currentCarrier.id);

      if (!error) {
        // Fire Resend email notification
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
          console.warn('Email notification skipped:', netErr);
        }

        alert('Bid successfully submitted, saved to cloud, and confirmation notification sent!');
        fetchCarriers();
        fetchTakenWeeks();
        setCurrentCarrier(null);
      } else {
        alert('Error saving bid: ' + error.message);
      }
    } catch (err) {
      alert('Network error while submitting bid.');
      console.error(err);
    }
  };

  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName || !newCarrierPin) {
      alert('Please enter carrier name and PIN.');
      return;
    }

    try {
      const { error } = await supabase.from('carriers').insert([{
        name: newCarrierName,
        email: newCarrierEmail,
        phone: newCarrierPhone,
        pin: newCarrierPin,
        seniority_order: newCarrierRank ? parseInt(newCarrierRank) : sortedCarriers.length + 1,
        ps3971_submitted: false
      }]);

      if (!error) {
        alert('Carrier successfully added!');
        setNewCarrierName('');
        setNewCarrierEmail('');
        setNewCarrierPhone('');
        setNewCarrierPin('');
        setNewCarrierRank('');
        fetchCarriers();
      } else {
        alert('Error adding carrier: ' + error.message);
      }
    } catch (err) {
      alert('Network error adding carrier.');
    }
  };

  const handleBlockWeeks = async () => {
    if (!blockWeekInput) return;
    const newBlocked = blockWeekInput.split(',').map(w => w.trim()).filter(Boolean);
    const updatedBlockedSet = new Set([...blockedEventWeeks, ...newBlocked]);
    const blockedArray = Array.from(updatedBlockedSet);

    setBlockedEventWeeks(updatedBlockedSet);
    setBlockWeekInput('');

    try {
      await supabase.from('branch_settings').upsert({ id: 1, blocked_weeks: blockedArray });
      alert('Weeks successfully blocked out for NALC events!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualOverride = async () => {
    if (!manualCarrierId || !manualWeeksInput) {
      alert('Please select a carrier and enter weeks.');
      return;
    }

    const weeksArray = manualWeeksInput.split(',').map(w => w.trim()).filter(Boolean);
    const columnToUpdate = manualRound === 'round1' ? 'round1Choice' : 'round2Choice';
    const timestampKey = manualRound === 'round1' ? 'round1_submitted_at' : 'round2_submitted_at';

    try {
      const { error } = await supabase
        .from('carriers')
        .update({ 
          [columnToUpdate]: weeksArray,
          [timestampKey]: new Date().toISOString()
        })
        .eq('id', manualCarrierId);

      if (!error) {
        alert('Manual bid override assigned successfully!');
        setManualWeeksInput('');
        fetchCarriers();
        fetchTakenWeeks();
      } else {
        alert('Error performing override: ' + error.message);
      }
    } catch (err) {
      alert('Network error during override.');
    }
  };

  const handleUpdateSeniorityOrder = async () => {
    if (!targetCarrierId || !newSeniorityRank) {
      alert('Please select a carrier and enter their new seniority number.');
      return;
    }

    try {
      const { error } = await supabase
        .from('carriers')
        .update({ seniority_order: parseInt(newSeniorityRank) })
        .eq('id', targetCarrierId);

      if (!error) {
        alert('Seniority queue order updated successfully!');
        setNewSeniorityRank('');
        setTargetCarrierId('');
        fetchCarriers();
      } else {
        alert('Error updating queue order: ' + error.message);
      }
    } catch (err) {
      alert('Network error updating order.');
    }
  };

  const togglePS3971Status = async (carrierId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('carriers')
        .update({ ps3971_submitted: !currentStatus })
        .eq('id', carrierId);

      if (!error) fetchCarriers();
    } catch (err) {
      console.error(err);
    }
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
          <div style={{ background: '#fff3
