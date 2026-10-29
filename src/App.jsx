  const handleSubmitBid = async () => {
    if (selectedWeeks.length === 0 || !currentCarrier) return;

    const hasCompletedR1 = currentCarrier.round1Choice && currentCarrier.round1Choice.length > 0;
    const activeRound = hasCompletedR1 ? 2 : 1;
    const fieldToUpdate = activeRound === 1 ? { round1Choice: selectedWeeks } : { round2Choice: selectedWeeks };

    try {
      // Force update matching the exact carrier name string in Supabase
      const { error } = await supabase
        .from('carriers')
        .update(fieldToUpdate)
        .eq('name', currentCarrier.name.trim());

      if (error) {
        alert(`Database error: ${error.message}`);
        return;
      }
    } catch (err) {
      alert('Network error while saving selections.');
      return;
    }

    // Email notification dispatch
    try {
      const resendApiKey = process.env.REACT_APP_RESEND_API_KEY || 're_123456789';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: 'NALC Branch 366 <bidding@yourdomain.com>',
          to: ['nalctrent@gmail.com'],
          subject: `[BID SUBMITTED] ${currentCarrier.name} completed Round ${activeRound}`,
          html: `<p><strong>${currentCarrier.name}</strong> (Priority #${currentCarrier.seniority_order}) has successfully submitted their picks for <strong>Round ${activeRound}</strong>.</p>
                 <p><strong>Selected Weeks:</strong> ${selectedWeeks.join(', ')}</p>`
        })
      });
    } catch (emailErr) {
      console.warn('Email notification failed to send.');
    }

    const updated = carriers.map(c => {
      if (String(c.id) === String(currentCarrier.id)) {
        return activeRound === 1 ? { ...c, round1Choice: selectedWeeks } : { ...c, round2Choice: selectedWeeks };
      }
      return c;
    });

    saveCarriersState(updated);
    localStorage.removeItem('nalc_logged_in_carrier');
    
    alert(`Round ${activeRound} selections successfully submitted for ${currentCarrier.name}!`);
    setCurrentCarrier(null);
    window.location.reload();
  };
