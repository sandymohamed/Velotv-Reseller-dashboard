import React, { useState } from 'react';
import { request } from './api';
import logo from './velotv-icon.png';

export default function InvitationSetup({ token }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [email, setEmail] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirm')) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try { const result = await request('/api/reseller/invitations/claim', { body: { token, password: data.get('password') } }); setEmail(result.email); history.replaceState(null, '', location.pathname); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }


  return <main className="login"><section className="login-brand"><div className="brand"><img className="brand-logo" src={logo} alt="VeloTV official logo" /><div>VeloTV<span>Reseller workspace</span></div></div><div className="login-intro"><h1>Your VeloTV<br />reseller account.</h1><p>Choose a password that only you know.</p></div></section>
    <section className="login-form"><div className="panel form"><h2>Set up your account</h2>
      {email ? <><p role="status">Password saved. Sign in using {email}.</p><button className="primary" onClick={() => window.location.assign(window.location.pathname)}>Go to sign in</button></> :
        <form className="form" onSubmit={submit}><p className="muted">Your sales agent cannot see this password or your playlists. Do not share this setup link.</p>
          <fieldset disabled={busy}><label>New password<input name="password" type="password" autoComplete="new-password" required minLength="10" maxLength="72" /></label>
            <label>Confirm password<input name="confirm" type="password" autoComplete="new-password" required minLength="10" maxLength="72" /></label>
            {error && <p className="notice error" role="alert">{error}</p>}<button className="primary">{busy ? 'Saving…' : 'Set password'}</button></fieldset>
        </form>}
    </div></section></main>;
}

