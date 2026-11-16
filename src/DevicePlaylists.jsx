import React, { useEffect, useState } from 'react';
import { Dialog } from './components';

function playlistFields(item) {
  if (!item) return { name: '', format: 'm3u', url: '', username: '', password: '' };
  if (item.source_format === 'm3u') return { name: item.profile_name, format: 'm3u', url: item.host };
  if (item.source_format === 'xtream' || Number(item.isXS) === 1) {
    return { name: item.profile_name, format: 'xtream', url: item.host, username: item.username, password: item.password };
  }
  try {
    const url = new URL(item.host);
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    if (username && password) {
      return { name: item.profile_name, format: 'xtream', url: url.origin, username, password };
    }
  } catch {}
  return { name: item.profile_name, format: 'm3u', url: item.host };
}

function PlaylistForm({ selected, busy, submit }) {
  const fields = playlistFields(selected);
  const [format, setFormat] = useState(fields.format);
  return (
    <form className="form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <label>Playlist name<input name="name" required maxLength={255} defaultValue={fields.name}/></label>
        <label>Format<select name="format" value={format} onChange={event => setFormat(event.target.value)}>
          <option value="m3u">M3U URL</option><option value="xtream">Xtream Codes</option>
        </select></label>
        <label>{format === 'm3u' ? 'Playlist URL' : 'Server URL'}
          <input name="url" type="url" maxLength={4096} required defaultValue={fields.url} placeholder="https://"/>
        </label>
        {format === 'xtream' && <div className="form-row">
          <label>Username<input name="username" required maxLength={255} defaultValue={fields.username} autoComplete="off"/></label>
          <label>Password<input name="password" required maxLength={255} defaultValue={fields.password} type="password" autoComplete="new-password"/></label>
        </div>}
        <button className="primary">{busy ? 'Saving…' : selected ? 'Save changes' : 'Add playlist'}</button>
      </fieldset>
    </form>
  );
}

export default function DevicePlaylists({ device, api, close }) {
  const path = '/reseller/dashboard/devices/' + device.id + '/playlists';
  const label = device.android_id || device.mac || String(device.id);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [formVersion, setFormVersion] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    api(path, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setItems(result.playlists); })
      .catch(failure => { if (!controller.signal.aborted) setLoadError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, path, version]);

  async function save(operation, message) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await operation();
      setSelected(null);
      setDeleting(null);
      setFormVersion(value => value + 1);
      setLoading(true);
      setVersion(value => value + 1);
      setStatus(message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.url = body.url.trim();
    const target = selected ? path + '/' + selected.id : path;
    void save(() => api(target, { method: selected ? 'PATCH' : 'POST', body }),
      selected ? 'Playlist updated.' : 'Playlist added. Reopen Manage Playlists on the device.');
  }

  return <Dialog title="Device playlists" busy={busy} close={close}>
    <div className="dialog-form form">
      <p className="muted">Device <strong className="mono">{label}</strong></p>
      {status && <p className="notice success" role="status">{status}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {loading ? <p role="status">Loading playlists…</p> : loadError ? (
        <div className="form"><p className="notice error" role="alert">{loadError}</p>
          <button className="secondary" onClick={() => setVersion(value => value + 1)}>Retry</button></div>
      ) : <>
        {items.length ? <ul className="device-playlist-list">{items.map(item => <li key={item.id}>
          <strong>{item.profile_name}</strong>
          <div className="actions">
            <button className="text-button" disabled={busy} onClick={() => {
              setDeleting(null); setSelected(item); setError('');
            }}>Edit</button>
            <button className="text-button" disabled={busy} onClick={() => {
              setDeleting(item); setError('');
            }}>Delete</button>
          </div>
        </li>)}</ul> : <p className="muted">This device has no playlists.</p>}
        {deleting ? <div className="notice error">
          <p>Delete {deleting.profile_name} from this device?</p>
          <div className="actions">
            <button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button>
            <button className="primary" disabled={busy} onClick={() => void save(
              () => api(path + '/' + deleting.id, { method: 'DELETE' }), 'Playlist deleted.',
            )}>Confirm delete</button>
          </div>
        </div> : <>
          <div className="section-head device-playlist-heading">
            <h2>{selected ? 'Edit playlist' : 'New playlist'}</h2>
            {selected && <button className="text-button" disabled={busy} onClick={() => setSelected(null)}>Cancel edit</button>}
          </div>
          <PlaylistForm key={selected?.id ?? 'new-' + formVersion} selected={selected} busy={busy} submit={submit}/>
        </>}
      </>}
    </div>
  </Dialog>;
}
