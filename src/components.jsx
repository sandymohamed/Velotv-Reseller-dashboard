import React, { useEffect, useRef, useState } from 'react';
import { CircleAlert, X } from 'lucide-react';

const formatter = new Intl.NumberFormat('en', { maximumFractionDigits: 5 });
const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
export function number(value) {
  return value == null || !Number.isFinite(Number(value)) ? '—' : formatter.format(Number(value));
}
export function date(value) {
  if (!value) return '—';
  const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  const parsed = new Date(utc);
  return Number.isNaN(parsed.valueOf()) ? '—' : dateFormatter.format(parsed);
}

const labels = {
  active: 'Active', expired: 'Expired',
  used: 'Used', available: 'Available', unknown: 'Unavailable',
  completed: 'Completed', incomplete: 'Incomplete',
};
export function State({ value }) {
  return <span className={'state state-' + value}>{labels[value] || 'Unknown'}</span>;
}
export function DataTable({ state, columns, rows = state.value?.result, empty, limit }) {
  if (state.loading) return <p className="table-message" role="status">Loading…</p>;
  if (state.error) return <p className="table-message error-text" role="alert">{state.error}</p>;
  if (!rows?.length) return <p className="table-message">{empty}</p>;
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Results table"><table>
    <thead><tr>{columns.map(([label]) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.slice(0, limit ?? rows.length).map(row => <tr key={row.id}>
      {columns.map(([label, display]) => <td key={label}>{display(row)}</td>)}
    </tr>)}</tbody>
  </table></div>;
}

export function Dialog({ title, busy, close, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby="dialog-title" onCancel={event => {
    event.preventDefault();
    if (!busy) close();
  }}>
    <div className="dialog-head"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button"
      aria-label="Close dialog" disabled={busy} onClick={close}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export function Activation({ seed, api, catalog, close, done }) {
  const [mode, setMode] = useState('activate');
  const [identity, setIdentity] = useState(seed.mac && !seed.android_id ? 'mac' : 'android');
  const [androidId, setAndroidId] = useState(seed.android_id || '');
  const [mac, setMac] = useState(seed.mac || '');
  const [deviceType, setDeviceType] = useState(seed.type ?? '');
  const [search, setSearch] = useState('');
  const [couponId, setCouponId] = useState(seed.coupon?.id?.toString() || '');
  const [couponList, setCouponList] = useState({ rows: [], count: 0, loading: true, error: '' });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const assisted = mode === 'register';
  useEffect(() => {
    if (seed.coupon) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setCouponList({ rows: [], count: 0, loading: true, error: '' });
      api('/reseller/coupon?' + new URLSearchParams({ used: '0', search }), { signal: controller.signal })
        .then(data => {
          if (!controller.signal.aborted) setCouponList({ rows: data.result, count: data.count, loading: false, error: '' });
        }).catch(error => {
          if (!controller.signal.aborted) setCouponList({ rows: [], count: 0, loading: false, error: error.message });
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, search, seed.coupon]);

  async function submit(event) {
    event.preventDefault();
    if (busy || !couponId) return;
    const fields = new FormData(event.currentTarget);
    const body = { id_coupon: Number(couponId) };
    if (identity === 'android') Object.assign(body, { android_id: androidId.trim(), type: Number(deviceType) });
    else Object.assign(body, { mac: mac.trim(), password: fields.get('password') });

    setFailure('');
    setBusy(true);
    try {
      await api(assisted ? '/reseller/dashboard/devices/register-and-activate' : '/reseller/devices/redeemed', { body });
      done('Coupon redeemed successfully. Ask the customer to refresh Device Info.');
    } catch (error) {
      setFailure(error.message);
    } finally { setBusy(false); }
  }

  const types = catalog.value?.types ?? [];
  return <Dialog title="Device activation" busy={busy} close={close}>
    <form className="form dialog-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className="segmented" aria-label="Activation mode">
          <button type="button" aria-pressed={!assisted} onClick={() => { setMode('activate'); setFailure(''); }}>Activate</button>
          <button type="button" aria-pressed={assisted} onClick={() => { setMode('register'); setIdentity('android'); setFailure(''); }}>Register &amp; activate</button>
        </div>
        <p className="muted">{assisted ? 'Use the Android ID and device type from Device Info to activate a new device.'
          : 'Use an available coupon to activate or renew a registered device.'}</p>
        {!assisted && <label>Device identifier<select value={identity} onChange={event => setIdentity(event.target.value)}>
          <option value="android">Android ID</option><option value="mac">Legacy MAC address</option></select></label>}
        {identity === 'android' ? <div className="form-row">
          <label>Android ID<input required maxLength={16} pattern="[A-Fa-f0-9]{1,16}" value={androidId}
            onChange={event => setAndroidId(event.target.value)} placeholder="e.g. 5194a8c538a286d1" /></label>
          <label>Device type<input required type="number" min={1} max={2147483647} step={1} list="device-types"
            value={deviceType} onChange={event => setDeviceType(event.target.value)} placeholder="From Device Info" />
            <datalist id="device-types">{types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</datalist></label>
        </div> : <>
          <label>MAC address<input required maxLength={17} pattern="([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}"
            value={mac} onChange={event => setMac(event.target.value)} placeholder="AA:BB:CC:DD:EE:FF" /></label>
          <label>Legacy device password<input required name="password" type="password" maxLength={72} autoComplete="off" /></label>
        </>}
        {seed.coupon ? <label>Coupon<input readOnly value={seed.coupon.coupon + ' · ' + seed.coupon.duration + ' mo'} /></label>
          : <>
            <label>Find coupon<input value={search} maxLength={100} placeholder="Search by coupon code"
              onChange={event => { setSearch(event.target.value); setCouponId(''); }} /></label>
            <label>Available coupon<select required value={couponId} onChange={event => setCouponId(event.target.value)}>
              <option value="">{couponList.loading ? 'Loading coupons…' : 'Select a coupon'}</option>
              {couponList.rows.map(row => <option key={row.id} value={row.id}>{row.coupon} · {row.duration} mo</option>)}
            </select></label>
            {couponList.error && <p className="error-text" role="alert">{couponList.error}</p>}
            {!couponList.loading && !couponList.error && !couponList.rows.length && <p className="muted">No available coupons found.</p>}
            {couponList.count > 100 && <p className="muted">Showing 100 coupons. Search by code to find more.</p>}
          </>}
        {failure && <p className="notice error" role="alert"><CircleAlert size={17} />{failure}</p>}
        <div className="actions end"><button type="button" className="secondary" onClick={close}>Cancel</button>
          <button className="primary" disabled={!couponId}>{busy ? 'Applying coupon…' : assisted ? 'Register & activate' : 'Activate device'}</button></div>
      </fieldset>
    </form>
  </Dialog>;
}

export function BillingAction({ seed, api, close, done, checkout }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(null);
  const { kind, pack } = seed;
  const title = kind === 'balance' ? 'Add credits' : 'Purchase ' + pack.package_name;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const amount = new FormData(event.currentTarget).get('amount');
    setBusy(true);
    setError('');
    try {
      if (kind === 'credits') {
        // Keep the same operation reference across retries within this confirmation.
        operation.current ??= globalThis.crypto.randomUUID();
        await api('/reseller/coupon', { body: { package: pack.id }, key: operation.current });
        done('Purchase complete. Your new coupons are available in Coupons.');
      } else {
        const result = kind === 'balance'
          ? await api('/reseller/paybalance/paypal/pay', { body: { amount } })
          : await api('/reseller/pay/paypal/pay', { body: { package_id: pack.id } });
        checkout(result.redirectUrl);
      }
    } catch (failure) {
      setError(failure.message);
    } finally { setBusy(false); }
  }

  return <Dialog title={title} busy={busy} close={close}>
    <form className="form dialog-form" onSubmit={submit}>
      {kind === 'balance' ? <label>Amount in EUR<input name="amount" type="number" min="0.01" max="99999.99" step="0.01" required placeholder="10.00" /></label>
        : <p className="muted">{pack.count_devices} coupons · {pack.periods} mo each · {number(pack.package_amount)} {kind === 'credits' ? 'credits' : 'EUR'}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="actions end"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button>
        <button className="primary" disabled={busy}>{busy ? 'Processing…' : kind === 'credits' ? 'Confirm purchase' : 'Continue to PayPal'}</button></div>
    </form>
  </Dialog>;
}

export function PaymentTables({ state }) {
  const paymentState = row => <State value={Number(row.status) === 1 ? 'completed' : 'incomplete'} />;
  return <>
    <section className="panel section"><div className="section-head"><h2>Balance payments</h2></div>
      <DataTable state={state} rows={state.value?.balance} empty="No balance payments yet." columns={[
        ['Date', row => date(row.created_at)], ['Reference', row => row.paymentID], ['Method', row => row.methode],
        ['Amount', row => number(row.payment_amount)], ['Credits', row => number(row.credits)], ['Status', paymentState],
      ]} />
    </section>
    <section className="panel section"><div className="section-head"><h2>Package payments</h2></div>
      <DataTable state={state} rows={state.value?.packages} empty="No package payments yet." columns={[
        ['Date', row => date(row.createdtime)], ['Reference', row => row.paymentID], ['Package', row => '#' + row.packages],
        ['Amount', row => number(row.payment_amount)], ['Status', paymentState],
      ]} />
    </section>
  </>;
}
