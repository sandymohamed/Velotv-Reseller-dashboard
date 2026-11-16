import DevicePlaylists from './DevicePlaylists';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight,
  CircleAlert, CreditCard, LayoutDashboard, LogOut, Menu, Monitor, Play, Plus,
  RefreshCw, Search, Ticket, Wallet, X,
} from 'lucide-react';
import { checkout, request } from './api';
import { Activation, BillingAction, DataTable, date, number, PaymentTables, State } from './components';

const nav = [
  ['overview', 'Overview', LayoutDashboard],
  ['devices', 'Devices', Monitor],
  ['coupons', 'Coupons', Ticket],
  ['packages', 'Packages', CreditCard],
  ['billing', 'Billing', Wallet],
];
const sessionKey = 'velotv-reseller-session';
function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(sessionKey)); } catch { return null; }
}

function Brand() {
  return <div className="brand"><div className="brand-icon"><Play size={19} fill="currentColor" /></div>
    <div>VeloTV<span>Reseller workspace</span></div></div>;
}

function Login({ onLogin, expired }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signIn(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const data = await request('/reseller/user/login', {
        body: { username: fields.get('username').trim(), password: fields.get('password') },
      });
      onLogin({ token: data.result, account: data.payload });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return <main className="login">
    <section className="login-brand"><Brand /><div className="login-intro"><Monitor size={42} />
      <h1>Manage your<br />VeloTV business.</h1>
      <p>Activate devices, manage coupons and track your balance from one workspace.</p></div></section>
    <section className="login-form"><form className="panel form" onSubmit={signIn}>
      <h2>Reseller sign in</h2><p className="muted">Use your existing VeloTV reseller account.</p>
      {(error || expired) && <p role="alert" className="notice error">{error || 'Your session expired. Sign in again.'}</p>}
      <label>Email or username<input name="username" required maxLength={255} autoComplete="username" /></label>
      <label>Password<input name="password" type="password" required maxLength={72} autoComplete="current-password" /></label>
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button>
    </form></section>
  </main>;
}

function useData(api, path, revision) {
  const [state, setState] = useState({ loading: true, value: null, error: '' });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ loading: true, value: null, error: '' });
    api(path, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setState({ loading: false, value, error: '' }); })
      .catch(error => {
        if (!controller.signal.aborted) setState({ loading: false, value: null, error: error.message });
      });
    return () => controller.abort();
  }, [api, path, revision]);
  return state;
}

function Section({ title, action, children }) {
  return <section className="panel section"><div className="section-head"><h2>{title}</h2>{action}</div>{children}</section>;
}

const deviceColumns = [
  ['Device', row => <><strong className="mono">{row.android_id || row.mac}</strong><small>Type {row.type}</small></>],
  ['Status', row => <State value={row.state} />],
  ['Expires', row => date(row.expires_at)],
  ['Last activation', row => date(row.last_activation)],
  ['Activations', row => row.activations],
];

function Listing({ pageName, api, revision, onActivate, onPlaylists }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const isDevices = pageName === 'devices';
  const params = new URLSearchParams({ page, search });
  if (filter) params.set(isDevices ? 'status' : 'used', filter);
  const state = useData(api, (isDevices ? '/reseller/dashboard/devices?' : '/reseller/coupon?') + params, revision);
  const columns = isDevices ? [...deviceColumns, ['Action', row => <div className="actions">
    <button className="text-button" onClick={() => onActivate({ android_id: row.android_id, mac: row.mac, type: row.type })}>Renew</button>
    {Number(row.can_manage_playlists) === 1 && <button className="text-button" onClick={() => onPlaylists(row)}>Playlists</button>}
  </div>]] : [
    ['Coupon', row => <><strong className="mono">{row.coupon}</strong><small>#{row.id}</small></>],
    ['Duration', row => row.duration + (row.duration === 1 ? ' month' : ' months')],
    ['Status', row => <State value={Number(row.used) === 1 ? 'used' : Number(row.used) === 0 ? 'available' : 'unknown'} />],
    ['Device', row => row.android_id || row.mac || '—'],
    ['Created', row => date(row.created_at)],
    ['Action', row => Number(row.used) === 0 && <button className="text-button"
      onClick={() => onActivate({ coupon: row })}>Activate</button>],
  ];
  return <Section title={isDevices ? 'Your devices' : 'Coupon inventory'}>
    <div className="toolbar">
      <form className="search" onSubmit={event => { event.preventDefault(); setPage(0); setSearch(draft.trim()); }}>
        <Search size={17} /><input value={draft} maxLength={100} onChange={e => setDraft(e.target.value)}
          placeholder={isDevices ? 'Search by Android ID or MAC' : 'Search by coupon or device'} aria-label="Search" />
        <button className="secondary">Search</button>
      </form>
      <select aria-label="Filter by status" value={filter} onChange={e => { setPage(0); setFilter(e.target.value); }}>
        <option value="">All statuses</option>
        {(isDevices ? [['active', 'Active'], ['expired', 'Expired']] :
          [['0', 'Available'], ['1', 'Used']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </div>
    <DataTable state={state} columns={columns} empty={isDevices ? 'No devices match your search.' : 'No coupons match your search.'} />
    <div className="pagination"><span>{state.value ? `${number(state.value.count)} results · Page ${page + 1}` : ''}</span>
      <button className="icon-button" aria-label="Previous page" disabled={!page || state.loading} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>
      <button className="icon-button" aria-label="Next page" disabled={state.loading || (page + 1) * 100 >= (state.value?.count ?? 0)} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button>
    </div>
  </Section>;
}

function Metric({ icon: Icon, label, value, tone }) {
  return <div className="panel metric"><div className={'metric-icon ' + tone}><Icon size={20} /></div><p>{label}</p><strong>{value}</strong></div>;
}

function Overview({ api, revision, balance, go, onActivate }) {
  const available = useData(api, '/reseller/coupon?used=0', revision);
  const devices = useData(api, '/reseller/dashboard/devices', revision);
  const active = useData(api, '/reseller/dashboard/devices?status=active', revision);
  const errors = [...new Set([balance.error, available.error, devices.error, active.error].filter(Boolean))];
  return <>
    <section className="hero"><div><h2>Device activation</h2>
      <p>Use an available coupon to activate or renew a device.</p>
      <button className="hero-button" onClick={() => onActivate({})}><Plus size={18} /> Activate device</button>
    </div><div className="hero-art" aria-hidden="true"><Monitor size={106} strokeWidth={1} /><Play size={24} fill="currentColor" /></div></section>
    <div className="metrics">
      <Metric icon={Wallet} tone="violet" label="Credit balance" value={number(balance.value?.solde)} />
      <Metric icon={Ticket} tone="blue" label="Available coupons" value={number(available.value?.count)} />
      <Metric icon={Monitor} tone="green" label="Active devices" value={number(active.value?.count)} />
      <Metric icon={Activity} tone="amber" label="Total devices" value={number(devices.value?.count)} />
    </div>
    {errors.map(error => <p className="notice error" key={error} role="alert">{error}</p>)}
    <Section title="Recent device activity" action={<button className="text-button" onClick={() => go('devices')}>All devices <ArrowRight size={16} /></button>}>
      <DataTable state={devices} columns={deviceColumns} limit={6} empty="Activated devices will appear here." />
    </Section>
  </>;
}

function Packages({ catalog, onBuy }) {
  if (catalog.loading || catalog.error) return <p className={'notice ' + (catalog.error ? 'error' : '')}>{catalog.error || 'Loading packages…'}</p>;
  const packs = catalog.value?.packages || [];
  if (!packs.length) return <p className="notice">No reseller packages are configured.</p>;
  return <div className="packages">{packs.map(pack => <article className="panel package" key={pack.id}>
    <div className="metric-icon violet"><Ticket size={21} /></div>
    <h2>{pack.package_name}</h2>
    <p>{pack.count_devices} coupons · {pack.periods} {pack.periods === 1 ? 'month' : 'months'} each</p>
    <strong>{number(pack.package_amount)} <span>credits</span></strong>
    <div className="actions"><button className="primary" onClick={() => onBuy({ pack, kind: 'credits' })}>Buy with credits</button>
      <button className="secondary" onClick={() => onBuy({ pack, kind: 'package' })}>PayPal</button></div>
  </article>)}</div>;
}

function Billing({ api, revision, balance, onBuy }) {
  const ledger = useData(api, '/reseller/service/payment', revision);
  const payments = useData(api, '/reseller/dashboard/payments', revision);
  return <>
    <div className="panel balance"><div><span>Available credit balance</span><strong>{number(balance.value?.solde)}</strong></div>
      <button className="primary" onClick={() => onBuy({ kind: 'balance' })}><Plus size={17} /> Add credits</button></div>
    {balance.error && <p className="notice error" role="alert">{balance.error}</p>}
    <Section title="Credit history"><DataTable state={ledger} rows={ledger.value?.data} empty="No credit transactions yet." columns={[
      ['Date', row => date(row.created_at)], ['Description', row => row.message],
      ['Previous balance', row => number(row.oldcredits)], ['New balance', row => number(row.newcredits)],
      ['Change', row => { const diff = Number(row.newcredits) - Number(row.oldcredits); const Icon = diff >= 0 ? ArrowUpRight : ArrowDownLeft;
        return <span className={diff >= 0 ? 'credit up' : 'credit down'}><Icon size={15} />{diff > 0 && '+'}{number(diff)}</span>; }],
    ]} /></Section>
    <PaymentTables state={payments} />
  </>;
}

const subtitles = {
  overview: 'Your device activations, coupons and reseller balance.',
  devices: 'Search, track and renew devices activated by your account.',
  coupons: 'Find available coupons and see where they were redeemed.',
  packages: 'Choose a coupon package and pay with credits or PayPal.',
  billing: 'Top up your credits and review payment activity.',
};

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [expired, setExpired] = useState(false);
  const [page, setPage] = useState('overview');
  const [menu, setMenu] = useState(false);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const signOut = useCallback((timeout = false) => {
    sessionStorage.removeItem(sessionKey);
    setSession(null);
    setExpired(timeout);
    setModal(null);
    setMessage('');
    setPage('overview');
    setMenu(false);
  }, []);
  const api = useCallback(async (path, options) => {
    try { return await request(path, { ...options, token: session?.token }); }
    catch (error) {
      if (error.status === 401) signOut(true);
      throw error;
    }
  }, [session?.token, signOut]);
  const balance = useData(api, session ? '/reseller/service/CurrentSolde' : null, revision);
  const catalog = useData(api, session && (modal?.type === 'activation' || page === 'packages') ? '/reseller/dashboard/catalog' : null, revision);
  if (!session) return <Login expired={expired} onLogin={value => {
    sessionStorage.setItem(sessionKey, JSON.stringify(value));
    setSession(value);
    setExpired(false);
  }} />;
  const accountName = session.account?.username || session.account?.email || 'Reseller';
  const go = name => { setPage(name); setMenu(false); setMessage(''); };
  const activate = seed => setModal({ type: 'activation', seed });
  const buy = seed => setModal({ type: 'billing', seed });
  const done = notice => { setModal(null); setMessage(notice); setRevision(value => value + 1); };
  return <div className="shell">
    <a className="skip" href="#content">Skip to content</a>
    {menu && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMenu(false)} />}
    <aside className={'sidebar ' + (menu ? 'open' : '')}>
      <Brand />
      <nav aria-label="Dashboard">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => go(id)}
        className={id === page ? 'current' : ''} aria-current={id === page ? 'page' : undefined}><Icon size={19} /> {label}</button>)}</nav>
      <div className="sidebar-foot"><div className="account"><span className="avatar">{accountName[0].toUpperCase()}</span>
        <strong title={accountName}>{accountName}</strong></div>
        <button onClick={() => signOut()}><LogOut size={17} /> Sign out</button></div>
    </aside>
    <main id="content" className="main">
      <header className="topbar"><button className="icon-button hamburger" aria-label="Open navigation" onClick={() => setMenu(true)}><Menu size={22} /></button>
        <div className="breadcrumbs">Workspace <ChevronRight size={14} /> <strong>{nav.find(item => item[0] === page)[1]}</strong></div>
        <div className="top-right"><span className="balance-pill"><Wallet size={17} /> {number(balance.value?.solde)} credits</span>
          <button className="icon-button" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={() => setRevision(value => value + 1)}><RefreshCw size={17} /></button></div>
      </header>
      <div className="content">
        <div className="page-head"><div><h1>{nav.find(item => item[0] === page)[1]}</h1><p>{subtitles[page]}</p></div>
          {['devices', 'coupons'].includes(page) && <button className="primary" onClick={() => activate({})}><Plus size={18} /> Activate device</button>}</div>
        {message && <div className="notice success" role="status">{message}<button className="icon-button" aria-label="Dismiss message" onClick={() => setMessage('')}><X size={16} /></button></div>}
        {new URLSearchParams(window.location.search).get('checkout') && <p className="notice"><CircleAlert size={17} />
          PayPal return received. Check Billing or Coupons for the server-confirmed result.</p>}
        {page === 'overview' && <Overview api={api} revision={revision} balance={balance} go={go} onActivate={activate} />}
        {['devices', 'coupons'].includes(page) && <Listing key={page} pageName={page} api={api} revision={revision} onActivate={activate} onPlaylists={device => setModal({ type: 'playlists', device })} />}
        {page === 'packages' && <Packages catalog={catalog} onBuy={buy} />}
        {page === 'billing' && <Billing api={api} revision={revision} balance={balance} onBuy={buy} />}
      </div>
    </main>
    {modal?.type === 'playlists' && <DevicePlaylists api={api} device={modal.device} close={() => setModal(null)}/> }
    {modal?.type === 'activation' && <Activation seed={modal.seed} api={api} catalog={catalog} close={() => setModal(null)} done={done} />}
    {modal?.type === 'billing' && <BillingAction seed={modal.seed} api={api} close={() => setModal(null)} done={done} checkout={checkout} />}
  </div>;
}
