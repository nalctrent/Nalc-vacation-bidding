80,000import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

import { supabase } from './supabaseClient';

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
  { id: '1', name: 'Trenton Bauer', category: 3, phone: '4173964312', pin: '4312', contact: 'nalctrent@gmail.com', round1Choice: [], round2Choice: [], seniority_order: 1, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'active' },
  { id: '2', name: 'Jessica', category: 2, phone: '4173565260', pin: '5260', contact: 'Jessica.branch366@gmail.com', round1Choice: [], round2Choice: [], seniority_order: 2, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'pending' },
  { id: '3', name: 'John Doe', category: 1, phone: '', pin: '1234', contact: '', round1Choice: [], round2Choice: [], seniority_order: 3, ps3971_submitted: false, link_sent_at: null, deadline_at: null, status: 'pending' }
];

export default function App() {
  const [carriers, setCarriers] = useState(DEFAULT_ROSTER);
  const [currentCarrier, setCurrentCarrier] = useState(null);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [portalMessage, setPortalMessage] = useState('');

  // Login Screen states
  const [loginCarrierId, setLoginCarrierId] = useState('');
  const [loginPinInput, setLoginPinInput] = useState('');

  // Steward / Admin Settings state
  const [totalEmployees, setTotalEmployees] = useState(30);
  const [customSlots, setCustomSlots] = useState(() => {
    const saved = localStorage.getItem('nalc_custom_slots');
    return saved ? JSON.parse(saved) : {};
  });

  const [newCarrierName, setNewCarrierName] = useState('');
  const [newCarrierCategory, setNewCarrierCategory] = useState(1);
  const [newCarrierPhone, setNewCarrierPhone] = useState('');
  const [newCarrierPin, setNewCarrierPin] = useState('');
  const [newCarrierContact, setNewCarrierContact] = useState('');
  const [newCarrierRank, setNewCarrierRank] = useState('');

  const [stewardPinInput, setStewardPinInput] = useState('');
  const [isStewardUnlocked, setIsStewardUnlocked] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStewardView, setIsStewardView] = useState(true);

  // Sync data from Supabase on mount
  useEffect(() => {
    const syncData = async () => {
      try {
        const { data, error } = await supabase.from('carriers').select('*').order('seniority_order', { ascending: true });
        if (!error && data && data.length > 0) {
          setCarriers(data);
        }
      } catch (err) {
        console.warn('Network sync failed, using default fallback');
      } finally {
        setIsDataLoaded(true);
      }
    };
    syncData();
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    const savedId = localStorage.getItem('nalc_logged_in_carrier');
    if (savedId) {
      const found = carriers.find(c => String(c.id) === String(savedId));
      if (found) {
        const globalRound = carriers.every(c => c.round1Choice && c.round1Choice.length > 0) ? 2 : 1;
        const finishedCurrent = globalRound === 1 
          ? (found.round1Choice && found.round1Choice.length > 0) 
          : (found.round2Choice && found.round2Choice.length > 0);
        
        if (finishedCurrent && !isStewardUnlocked) {
          localStorage.removeItem('nalc_logged_in_carrier');
          setCurrentCarrier(null);
        } else {
          setCurrentCarrier(found);
        }
      }
    }
  }, [isDataLoaded, carriers, isStewardUnlocked]);

  const saveCustomSlotsState = (newSlots) => {
    setCustomSlots(newSlots);
    localStorage.setItem('nalc_custom_slots', JSON.stringify(newSlots));
  };

  const handleCustomSlotChange = (weekNum, val) => {
    const num = parseInt(val, 10);
    const updated = { ...customSlots, [weekNum]: isNaN(num) ? '' : num };
    saveCustomSlotsState(updated);
  };

  const sortedCarriers = [...carriers].sort((a, b) => (a.seniority_order || 999) - (b.seniority_order || 999));
  const allRound1Complete = sortedCarriers.length > 0 && sortedCarriers.every(c => c.round1Choice && c.round1Choice.length > 0);
  const currentRound = allRound1Complete ? 2 : 1;

  const activeBiddingCarrier = currentRound === 1
    ? sortedCarriers.find(c => (!c.round1Choice || c.round1Choice.length === 0) && c.status !== 'bypassed')
    : sortedCarriers.find(c => (!c.round2Choice || c.round2Choice.length === 0) && c.status !== 'bypassed');

  const handleCarrierLogin = async (e) => {
    e.preventDefault();
    if (!loginCarrierId) {
      alert('Please select your name.');
      return;
    }

    let latestCarriers = carriers;
    try {
      const { data, error } = await supabase.from('carriers').select('*');
      if (!error && data && data.length > 0) {
        latestCarriers = data;
        setCarriers(data);
      }
    } catch (err) {}

    const found = latestCarriers.find(c => String(c.id) === String(loginCarrierId));
    if (!found) {
      alert('Carrier not found.');
      return;
    }

    const expectedPin = found.pin || (found.phone ? found.phone.slice(-4) : '1234');
    if (loginPinInput.trim() !== expectedPin) {
      alert('Incorrect PIN. Please check with your shop steward if you forgot your PIN.');
      return;
    }

    const hasFinishedRound = currentRound === 1 
      ? (found.round1Choice && found.round1Choice.length > 0)
      : (found.round2Choice && found.round2Choice.length > 0);

    if (hasFinishedRound && !isStewardUnlocked) {
      setPortalMessage(`${found.name}, you have already completed your selections for Round ${currentRound}. Thank you!`);
      return;
    }

    localStorage.setItem('nalc_logged_in_carrier', found.id);
    setCurrentCarrier(found);
    setSelectedWeeks([]);
    setPortalMessage('');
  };

  const saveCarriersState = (newCarriers) => {
    setCarriers(newCarriers);
  };

  const getSlotsForWeek = (weekObj) => {
    if (customSlots[weekObj.weekNum] !== undefined && customSlots[weekObj.weekNum] !== '') {
      return Number(customSlots[weekObj.weekNum]);
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
    localStorage.setItem('nalc_logged_in_carrier', carrier.id);
    setCurrentCarrier(carrier);
    setIsStewardView(false);
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

    const cleanOrigin = window.location.origin;
    const userPin = carrier.pin || (carrier.phone ? carrier.phone.slice(-4) : '1234');
    const portalLink = `${cleanOrigin}`;

    const deadlineFormatted = deadline.toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const msg = encodeURIComponent(`Hi ${carrier.name}, it is your turn to bid for Round ${currentRound}! Go to ${portalLink}, select your name, and use PIN: ${userPin}. You have until ${deadlineFormatted} to submit your picks.`);
    
    window.location.href = `sms:${carrier.phone || ''}?body=${msg}`;
  };

  const handleAddCarrier = async (e) => {
    e.preventDefault();
    if (!newCarrierName.trim()) return;
    const pinVal = newCarrierPin.trim() || (newCarrierPhone ? newCarrierPhone.slice(-4) : '1234');
    const newCarrier = {
      id: String(Date.now()),
      name: newCarrierName.trim(),
      category: Number(newCarrierCategory),
      phone: newCarrierPhone.trim(),
      pin: pinVal,
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
    setNewCarrierName(''); setNewCarrierPhone(''); setNewCarrierPin(''); setNewCarrierContact(''); setNewCarrierRank('');
    alert(`Successfully added ${newCarrier.name} with PIN: ${pinVal}!`);
  };

  const handleUpdateRank = async (id, newRank) => {
    const updated = carriers.map(c => c.id === id ? { ...c, seniority_order: Number(newRank) } : c);
    saveCarriersState(updated);
    try { await supabase.from('carriers').update({ seniority_order: Number(newRank) }).eq('id', id); } catch (err) {}
  };

  const handleRemoveCarrier = async (id) => {
    if (confirm('Remove carrier?')) {
      const targetCarrier = carriers.find(c => c.id === id);
      const deletedRank = targetCarrier ? targetCarrier.seniority_order : null;

      const updated = carriers
        .filter(c => c.id !== id)
        .map(c => {
          if (deletedRank !== null && c.seniority_order > deletedRank) {
            return { ...c, seniority_order: c.seniority_order - 1 };
          }
          return c;
        });

      saveCarriersState(updated);

      try {
        await supabase.from('carriers').delete().eq('id', id);
        for (const c of updated) {
          if (deletedRank !== null && c.seniority_order >= deletedRank) {
            await supabase.from('carriers').update({ seniority_order: c.seniority_order }).eq('id', c.id);
          }
        }
      } catch (err) {
        console.error('Error updating ranks after removal:', err);
      }
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

    // SUBMIT BID, UPDATE SUPABASE WITH EXACT ROW RETURN, AND TRIGGER BACKEND NOTIFY API
  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0 || !currentCarrier) return;

    const hasCompletedR1 = currentCarrier.round1Choice && currentCarrier.round1Choice.length > 0;
    const activeRound = hasCompletedR1 ? 2 : 1;
    const fieldToUpdate = activeRound === 1 
      ? { round1Choice: selectedWeeks } 
      : { round2Choice: selectedWeeks };

        try {
      // 1. Try updating with numeric ID
      let { data, error } = await supabase
        .from('carriers')
        .update(fieldToUpdate)
        .eq('id', Number(currentCarrier.id))
        .select();

      // 2. Fallback: match by exact Carrier Name
      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from('carriers')
          .update(fieldToUpdate)
          .eq('name', currentCarrier.name)
          .select();
          
        data = fallback.data;
        error = fallback.error;
      }

      // 3. AUTO-INSERT FIX: If row doesn't exist in Supabase, create it automatically!
      if (!data || data.length === 0) {
        const payload = {
          ...currentCarrier,
          id: Number(currentCarrier.id) || 1,
          ...fieldToUpdate
        };
        const upsertResult = await supabase
          .from('carriers')
          .upsert([payload])
          .select();

        data = upsertResult.data;
        error = upsertResult.error;
      }

      if (error) {
        alert(`Supabase Error: ${error.message}`);
        return;
      }
    } catch (err) {
      alert(`Network Error: ${err.message}`);
      return;
    }


    // Determine who is next after this submission
    const nextPerson = sortedCarriers.find(c => 
      String(c.id) !== String(currentCarrier.id) && 
      (activeRound === 1 ? (!c.round1Choice || c.round1Choice.length === 0) : (!c.round2Choice || c.round2Choice.length === 0))
    );

    // Trigger secure backend notify function
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          carrierName: currentCarrier.name,
          round: `Round ${activeRound}`,
          selectedWeeks: selectedWeeks.map(w => `Week ${w}`).join(', '),
          nextCarrier: nextPerson ? `${nextPerson.name} (#${nextPerson.seniority_order})` : 'None (All Complete)'
        })
      });
    } catch (e) {
      console.warn('Notification failed to dispatch', e);
    }

    localStorage.removeItem('nalc_logged_in_carrier');
    setCurrentCarrier(null);
    setSelectedWeeks([]);
    
    alert(`Round ${activeRound} selections successfully submitted for ${currentCarrier.name}!`);
    window.location.reload();
  };


    const handlePrintMasterList = () => {
    let rowsHtml = '';
    sortedCarriers.forEach(c => {
      const r1 = c.round1Choice || c.round1_choice || [];
      const r2 = c.round2Choice || c.round2_choice || [];
      const submitted = c.ps3971_submitted || c.ps3971Submitted || false;

      rowsHtml += `<tr>
        <td style="text-align:center;">#${c.seniority_order || '-'}</td>
        <td><b>${c.name || 'Unknown'}</b></td>
        <td style="text-align:center;">${c.category || '-'}</td>
        <td>${formatWeeksWithDates(r1)}</td>
        <td>${formatWeeksWithDates(r2)}</td>
        <td style="text-align:center;">${submitted ? 'Yes' : 'No'}</td>
      </tr>`;
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Master Roster</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 15px; color: #000; }
            h2 { margin-bottom: 10px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { padding: 8px; border: 1px solid #333; }
            th { background: #003366; color: #fff; }
          </style>
        </head>
        <body>
          <h2>NALC Branch 366 Master Roster</h2>
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Name</th>
                <th>Cat</th>
                <th>Round 1</th>
                <th>Round 2</th>
                <th>PS 3971</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Remove old iframe if present
    const oldFrame = document.getElementById('print-master-frame');
    if (oldFrame) oldFrame.remove();

    // Create a hidden iframe on the current page
    const iframe = document.createElement('iframe');
    iframe.id = 'print-master-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Wait for content to render before opening print sheet
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  };

    let html = `<html><head><title>Master Roster</title><style>body{font-family:Arial;padding:20px;}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px;}th,td{padding:8px;border:1px solid #333;}th{background:#003366;color:#fff;}.center{text-align:center;}</style></head><body><h2>NALC Branch 366 Master Roster</h2><table><thead><tr><th>Priority</th><th>Name</th><th>Cat</th><th>Round 1</th><th>Round 2</th><th>PS 3971</th></tr></thead><tbody>`;
    
    sortedCarriers.forEach(c => {
      const r1 = c.round1Choice || c.round1_choice || [];
      const r2 = c.round2Choice || c.round2_choice || [];
      const submitted = c.ps3971_submitted || c.ps3971Submitted || false;

      html += `<tr>
        <td class="center">#${c.seniority_order || '-'}</td>
        <td><b>${c.name || 'Unknown'}</b></td>
        <td class="center">${c.category || '-'}</td>
        <td>${formatWeeksWithDates(r1)}</td>
        <td>${formatWeeksWithDates(r2)}</td>
        <td class="center">${submitted ? 'Yes' : 'No'}</td>
      </tr>`;
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
            <button onClick={() => setIsStewardView(!isStewardView)} style={{ background: '#003366', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{isStewardView ? '📋 Back to Portal' : '🛡️ Steward Board'}</button>
            <button onClick={() => setIsAdminOpen(!isAdminOpen)} style={{ background: '#555', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>{isAdminOpen ? 'Close Roster Admin' : '⚙️ Roster & Quota Settings'}</button>
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
                <th style={{ padding: '10px' }}>PIN</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>PS 3971</th>
                <th style={{ padding: '10px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCarriers.map((c) => {
                const isCurrentTurn = activeBiddingCarrier && activeBiddingCarrier.id === c.id;
                const hasFinished = currentRound === 1 ? (c.round1Choice?.length > 0) : (c.round2Choice?.length > 0);
                const carrierPin = c.pin || (c.phone ? c.phone.slice(-4) : '1234');
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #ddd', fontSize: '13px', background: isCurrentTurn ? '#fff9e6' : '#fff' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>#{c.seniority_order}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{c.name} {isCurrentTurn && '(Up Now)'}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{carrierPin}</td>
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

      {isStewardUnlocked && isAdminOpen && (
        <div className="no-print" style={{ background: '#f4f4f4', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ccc' }}>
          <h3>Staffing & Leave Quota Settings</h3>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Total Office Carriers (Base 11%/14% Calculator):</label>
            <input 
              type="number" 
              value={totalEmployees} 
              onChange={(e) => setTotalEmployees(Number(e.target.value))}
              style={{ padding: '4px 8px', width: '60px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <h4 style={{ margin: '15px 0 8px 0' }}>Manual Weekly Leave Slot Overrides</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', maxHeight: '220px', overflowY: 'auto', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '20px' }}>
            {CALENDAR_WEEKS.map(w => {
              const defaultSlots = Math.max(1, Math.round(totalEmployees * (w.isPrimeTime ? 0.14 : 0.11)));
              return (
                <div key={w.weekNum} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px', borderBottom: '1px solid #eee' }}>
                  <span>Wk {w.weekNum} ({w.isPrimeTime ? 'Prime' : 'Std'}):</span>
                  <input
                    type="number"
                    placeholder={defaultSlots}
                    value={customSlots[w.weekNum] !== undefined ? customSlots[w.weekNum] : ''}
                    onChange={(e) => handleCustomSlotChange(w.weekNum, e.target.value)}
                    style={{ width: '45px', textAlign: 'center', padding: '2px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
              );
            })}
          </div>

          <h4 style={{ margin: '15px 0 8px 0' }}>Add New Carrier</h4>
          <form onSubmit={handleAddCarrier} style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Carrier Name" value={newCarrierName} onChange={(e) => setNewCarrierName(e.target.value)} style={{ padding: '6px', flex: 1 }} />
            <select value={newCarrierCategory} onChange={(e) => setNewCarrierCategory(Number(e.target.value))} style={{ padding: '6px' }}>
              <option value={1}>Cat 1 (2 Weeks)</option>
              <option value={2}>Cat 2 (3 Weeks)</option>
              <option value={3}>Cat 3 (3 Weeks)</option>
            </select>
            <input type="tel" placeholder="Phone" value={newCarrierPhone} onChange={(e) => setNewCarrierPhone(e.target.value)} style={{ padding: '6px', width: '110px' }} />
            <input type="text" placeholder="PIN (opt)" value={newCarrierPin} onChange={(e) => setNewCarrierPin(e.target.value)} style={{ padding: '6px', width: '80px' }} />
            <input type="number" placeholder="Priority #" value={newCarrierRank} onChange={(e) => setNewCarrierRank(e.target.value)} style={{ padding: '6px', width: '70px' }} />
            <button type="submit" style={{ background: '#28a745', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Add Carrier</button>
          </form>

          <h4 style={{ margin: '15px 0 8px 0' }}>Manage Seniority Roster Order</h4>
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

      {portalMessage && (
        <div style={{ background: '#e2f0fb', color: '#003366', padding: '20px', borderRadius: '8px', border: '1px solid #b0c4de', marginBottom: '20px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 6px 0' }}>NALC Branch 366 Portal</h3>
          <p style={{ margin: 0, fontSize: '15px' }}>{portalMessage}</p>
        </div>
      )}

      {!currentCarrier && !isStewardUnlocked && !portalMessage ? (
        <div className="no-print" style={{ background: '#fff', padding: '30px', borderRadius: '8px', border: '1px solid #ccc', maxWidth: '400px', margin: '40px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h2 style={{ color: '#003366', marginTop: 0, textAlign: 'center' }}>Carrier Login</h2>
          <p style={{ fontSize: '13px', color: '#555', textAlign: 'center', marginBottom: '20px' }}>
            Select your name and enter your assigned 4-digit PIN to access your secure bidding calendar.
          </p>
          <form onSubmit={handleCarrierLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Select Your Name:</label>
              <select 
                value={loginCarrierId} 
                onChange={(e) => setLoginCarrierId(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
              >
                <option value="">-- Choose Your Name --</option>
                {sortedCarriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Priority #{c.seniority_order})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Enter Your 4-Digit PIN:</label>
              <input 
                type="password" 
                maxLength={6}
                placeholder="PIN" 
                value={loginPinInput} 
                onChange={(e) => setLoginPinInput(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <button 
              type="submit" 
              style={{ background: '#003366', color: '#fff', border: 'none', padding: '12px', borderRadius: '4px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', marginTop: '6px' }}
            >
              🔓 Open My Bidding Calendar
            </button>
          </form>
        </div>
      ) : null}

      {currentCarrier ? (
        <div className="no-print">
          <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#155724' }}>Authenticated as: {currentCarrier.name} (Priority #{currentCarrier.seniority_order})</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Category {currentCarrier.category} — Selected: {selectedWeeks.join(', ') || 'None'}</p>
            </div>
            <button onClick={() => { localStorage.removeItem('nalc_logged_in_carrier'); setCurrentCarrier(null); }} style={{ background: '#6c757d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Log Out</button>
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
