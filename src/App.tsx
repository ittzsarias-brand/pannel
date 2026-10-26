import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Boxes, Check, ChevronDown, CircleDollarSign,
  FileText, Home, LogOut, Menu, Plus, Search, Settings, ShieldCheck, Sparkles,
  TrendingUp, Wallet, X, LoaderCircle,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { auth, db, isFirebaseConfigured } from './lib/firebase';


type Language = 'en' | 'ckb';
const uiTranslations: Record<string, string> = {
  'Overview':'پوختە', 'Money':'پارە', 'Items':'کەلوپەل', 'Notes':'تێبینییەکان', 'Settings':'ڕێکخستنەکان',
  'WORKSPACE':'شوێنی کار', 'Workspace':'شوێنی کار', 'Cloud sync enabled':'هاوکاتکردنی هەور چالاکە',
  'YOUR PERSONAL SPACE':'شوێنی تایبەتی تۆ', 'YOUR DASHBOARD':'داشبۆردی تۆ',
  'Good to see you.':'خۆشحاڵین بە بینینت.', 'A clearer picture of everything that matters to you.':'وێنەیەکی ڕوونتر لەو شتانەی بۆت گرنگن.',
  'Keep your IQD and USD transactions organized.':'مامەڵەکانی IQD و USD ڕێک بخە.', 'Know what you have, and where it is.':'بزانە چی هەتە و لە کوێیە.',
  'Your thoughts, collected in one place.':'بیرۆکەکانت لە یەک شوێندا کۆ بکەرەوە.', 'Manage your personal workspace.':'شوێنی کاری تایبەتی خۆت بەڕێوە ببە.',
  'Add transaction':'زیادکردنی مامەڵە', 'Add item':'زیادکردنی کەلوپەل', 'New note':'تێبینییەکی نوێ', 'Quick add':'زیادکردنی خێرا',
  'Everything in its right place.':'هەموو شتێک لە شوێنی خۆیدایە.', 'Track your finances, catalog your items, and capture your ideas.':'داراییەکانت بەدواداچوون بکە، کەلوپەلەکانت تۆمار بکە و بیرۆکەکانت بنووسە.',
  'Financial snapshot':'پوختەی دارایی', 'Tracked transactions only':'تەنها مامەڵە تۆمارکراوەکان', 'IQD balance':'باڵانسی IQD', 'USD balance':'باڵانسی USD',
  'Items tracked':'کەلوپەلی بەدواداچوونکراو', 'Saved notes':'تێبینییە پاشەکەوتکراوەکان', 'Money activity':'چالاکی پارە', 'Recent transactions':'دوایین مامەڵەکان',
  'Your latest money activity':'دوایین چالاکییە داراییەکانت', 'View all':'بینینی هەمووی', 'No transactions yet':'هێشتا هیچ مامەڵەیەک نییە',
  'Your recorded income and expenses will show here.':'داهات و خەرجییە تۆمارکراوەکانت لێرە دەردەکەون.',
  'Your workspace':'شوێنی کاری تۆ', 'Everything you track':'هەموو ئەو شتانەی بەدواداچوونیان دەکەیت',
  'Transactions':'مامەڵەکان', 'Your items':'کەلوپەلەکانت', 'All notes':'هەموو تێبینییەکان', 'Account & privacy':'هەژمار و تایبەتمەندی',
  'Workspace preferences':'هەڵبژاردەکانی شوێنی کار', 'Email':'ئیمەیڵ', 'Sync status':'دۆخی هاوکاتکردن', 'Connected':'پەیوەستە',
  'Default currency':'دراوی بنەڕەت', 'Appearance':'ڕووکار', 'Layout':'ڕێکخستن', 'Currency display':'پیشاندانی دراو',
  'Sign out':'چوونەدەرەوە', 'Language':'زمان', 'English':'ئینگلیزی', 'Kurdish (Sorani)':'کوردی (سۆرانی)',
  'Personal account':'هەژماری کەسی', 'Search transactions':'گەڕان لە مامەڵەکان', 'Search items':'گەڕان لە کەلوپەلەکان', 'Search notes':'گەڕان لە تێبینییەکان',
  'Cancel':'پاشگەزبوونەوە', 'Save':'پاشەکەوتکردن', 'Create a note':'دروستکردنی تێبینی', 'Add item':'زیادکردنی کەلوپەل',
  'Transaction title':'ناونیشانی مامەڵە', 'Amount':'بڕ', 'Currency':'دراو', 'Type':'جۆر', 'Category':'پۆل', 'Item name':'ناوی کەلوپەل',
  'Quantity':'ژمارە', 'Location':'شوێن', 'Note title':'ناونیشانی تێبینی', 'Details':'وردەکاری', 'optional':'ئارەزوومەندانە',
  'Expense':'خەرجی', 'Income':'داهات', 'No matching transactions':'هیچ مامەڵەیەکی هاوتا نەدۆزرایەوە',
  'Your inventory starts here':'کۆگای کەلوپەلەکانت لێرە دەست پێ دەکات', 'A place for your thoughts':'شوێنێک بۆ بیرۆکەکانت',
};

type Tab = 'Overview' | 'Money' | 'Items' | 'Notes' | 'Settings';
type Currency = 'IQD' | 'USD';
type Transaction = { id: string; title: string; amount: number; currency: Currency; kind: 'income' | 'expense'; category: string; created_at: string };
type Item = { id: string; name: string; category: string; quantity: number; location: string; created_at: string };
type Note = { id: string; title: string; body: string; created_at: string };

const navItems: { name: Tab; icon: typeof Home }[] = [
  { name: 'Overview', icon: Home }, { name: 'Money', icon: Wallet },
  { name: 'Items', icon: Boxes }, { name: 'Notes', icon: FileText },
  { name: 'Settings', icon: Settings },
];
const moneyChart = [
  { day: 'Mon', income: 180000, expense: 90000 }, { day: 'Tue', income: 250000, expense: 120000 },
  { day: 'Wed', income: 160000, expense: 85000 }, { day: 'Thu', income: 310000, expense: 145000 },
  { day: 'Fri', income: 220000, expense: 110000 }, { day: 'Sat', income: 360000, expense: 175000 },
  { day: 'Sun', income: 290000, expense: 125000 },
];
const money = (value: number, currency: Currency) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, maximumFractionDigits: currency === 'IQD' ? 0 : 2,
}).format(value);
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function App() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('pannel-language') === 'ckb' ? 'ckb' : 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language === 'ckb' ? 'ckb' : 'en';
    root.dir = language === 'ckb' ? 'rtl' : 'ltr';
    try { localStorage.setItem('pannel-language', language); } catch { /* storage may be unavailable */ }
    const applyTranslations = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const value = node.nodeValue;
        if (!value || !value.trim()) continue;
        const trimmed = value.trim();
        const translated = language === 'ckb' ? uiTranslations[trimmed] : Object.keys(uiTranslations).find((key) => uiTranslations[key] === trimmed);
        if (translated) node.nodeValue = value.replace(trimmed, translated);
      }
      document.querySelectorAll<HTMLElement>('input, textarea, button, [aria-label], [title]').forEach((el) => {
        for (const attr of ['placeholder', 'aria-label', 'title']) {
          const value = el.getAttribute(attr);
          if (!value) continue;
          const translated = language === 'ckb' ? uiTranslations[value] : Object.keys(uiTranslations).find((key) => uiTranslations[key] === value);
          if (translated) el.setAttribute(attr, translated);
        }
      });
    };
    applyTranslations();
    const observer = new MutationObserver(() => applyTranslations());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);
  const [session, setSession] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [modal, setModal] = useState<'transaction' | 'item' | 'note' | null>(null);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [transactionForm, setTransactionForm] = useState({ title: '', amount: '', currency: 'IQD' as Currency, kind: 'expense' as 'income' | 'expense', category: 'General' });
  const [itemForm, setItemForm] = useState({ name: '', category: 'General', quantity: '1', location: '' });
  const [noteForm, setNoteForm] = useState({ title: '', body: '' });

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    return onAuthStateChanged(auth, (user) => { setSession(user); setAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!session || !db) { setTransactions([]); setItems([]); setNotes([]); return; }
    const toRecords = <T extends { id: string; created_at: string }>(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }): T[] =>
      snapshot.docs.map((document) => {
        const data = document.data();
        return { ...data, id: document.id, created_at: new Date(Number(data.createdAt ?? Date.now())).toISOString() } as T;
      });
    const unsubTransactions = onSnapshot(query(collection(db, 'transactions'), where('userId', '==', session.uid)), (snapshot) => {
      setTransactions(toRecords<Transaction>(snapshot).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    });
    const unsubItems = onSnapshot(query(collection(db, 'trackedItems'), where('userId', '==', session.uid)), (snapshot) => {
      setItems(toRecords<Item>(snapshot).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    });
    const unsubNotes = onSnapshot(query(collection(db, 'notes'), where('userId', '==', session.uid)), (snapshot) => {
      setNotes(toRecords<Note>(snapshot).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    });
    return () => { unsubTransactions(); unsubItems(); unsubNotes(); };
  }, [session]);

  const totals = useMemo(() => transactions.reduce((acc, t) => {
    acc[t.currency][t.kind] += Number(t.amount);
    return acc;
  }, { IQD: { income: 0, expense: 0 }, USD: { income: 0, expense: 0 } }), [transactions]);
  const filteredItems = items.filter((item) => (item.name + ' ' + item.category + ' ' + item.location).toLowerCase().includes(search.toLowerCase()));
  const filteredNotes = notes.filter((note) => (note.title + ' ' + note.body).toLowerCase().includes(search.toLowerCase()));
  const filteredTransactions = transactions.filter((t) => (t.title + ' ' + t.category + ' ' + t.kind).toLowerCase().includes(search.toLowerCase()));

  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setAuthMessage('');
    if (!auth) { setBusy(false); setAuthMessage('Firebase is not configured yet. Add the Firebase environment values described in README.md.'); return; }
    try {
      if (authMode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
      setAuthMessage('');
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally { setBusy(false); }
  };

  const saveTransaction = async (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    const amount = Number(transactionForm.amount);
    if (!transactionForm.title.trim() || !Number.isFinite(amount) || amount <= 0) { setFormError('Enter a title and an amount greater than zero.'); return; }
    if (!db || !session) { setFormError('Sign in after configuring Firebase to save data.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'transactions'), { userId: session.uid, title: transactionForm.title.trim(), amount, currency: transactionForm.currency, kind: transactionForm.kind, category: transactionForm.category, createdAt: Date.now() });
      setModal(null); setTransactionForm({ title: '', amount: '', currency: 'IQD', kind: 'expense', category: 'General' });
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save transaction.'); }
    finally { setBusy(false); }
  };

  const saveItem = async (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    const quantity = Number(itemForm.quantity);
    if (!itemForm.name.trim() || !Number.isInteger(quantity) || quantity < 0) { setFormError('Enter a name and a valid quantity.'); return; }
    if (!db || !session) { setFormError('Sign in after configuring Firebase to save data.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'trackedItems'), { userId: session.uid, name: itemForm.name.trim(), category: itemForm.category, quantity, location: itemForm.location.trim(), createdAt: Date.now() });
      setModal(null); setItemForm({ name: '', category: 'General', quantity: '1', location: '' });
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save item.'); }
    finally { setBusy(false); }
  };

  const saveNote = async (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    if (!noteForm.title.trim()) { setFormError('Add a title for your note.'); return; }
    if (!db || !session) { setFormError('Sign in after configuring Firebase to save data.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'notes'), { userId: session.uid, title: noteForm.title.trim(), body: noteForm.body.trim(), createdAt: Date.now() });
      setModal(null); setNoteForm({ title: '', body: '' });
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save note.'); }
    finally { setBusy(false); }
  };

  if (!authReady) return <main className="loading-screen"><LoaderCircle className="spin" size={28} /><span>Opening your dashboard…</span></main>;

  if (!session) return (
    <main className="auth-shell">
      <div className="auth-glow" />
      <section className="auth-card">
        <div className="brand-mark"><Activity size={23} /></div>
        <div className="eyebrow"><ShieldCheck size={14} /> YOUR PRIVATE WORKSPACE</div>
        <h1>Pannel<span>.</span></h1>
        <p className="auth-subtitle">Your money, items, and notes. All in one place.</p>
        <form onSubmit={signIn} className="form-stack">
          <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
          {authMessage && <p className="form-error">{authMessage}</p>}
          <button className="button primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : null}{authMode === 'login' ? 'Sign in securely' : 'Create account'}</button>
        </form>
        <button className="text-button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthMessage(''); }}>
          {authMode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        {!isFirebaseConfigured && <div className="setup-notice"><strong>Setup required</strong><span>Connect your Firebase project using the README instructions before account access is available.</span></div>}
        <p className="auth-foot"><ShieldCheck size={13} /> Your records are designed to be isolated by account.</p>
      </section>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setTab('Overview'); }}><span className="brand-mark"><Activity size={21} /></span><span>Pannel<span className="brand-dot">.</span><small>PERSONAL DASHBOARD</small></span></a>
        <div className="nav-caption">WORKSPACE</div>
        <nav>{navItems.map(({ name, icon: Icon }) => <button key={name} className={'nav-link ' + (tab === name ? 'active' : '')} onClick={() => setTab(name)}><Icon size={18} /><span>{name}</span>{name === 'Notes' && notes.length > 0 && <span className="nav-count">{notes.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={18} /><strong>Your space. Your data.</strong><p>Personal records, organized in one private workspace.</p><span><i /> ACCOUNT CONNECTED</span></div><div className="user-row"><div className="avatar">{session.email?.slice(0, 1).toUpperCase() ?? 'P'}</div><div className="user-info"><strong>{session.email?.split('@')[0]}</strong><span>Personal account</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => { if (auth) void signOut(auth); }}><LogOut size={17} /></button></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{tab}</strong></div><div className="topbar-actions"><span className="sync-status"><i /> Cloud sync enabled</span><button className="mobile-profile" onClick={() => setTab('Settings')} aria-label="Settings"><Settings size={18} /></button><div className="avatar small">{session.email?.slice(0, 1).toUpperCase() ?? 'P'}</div></div></header>
        <div className="page-content">
          <div className="page-heading"><div><div className="eyebrow"><Sparkles size={13} /> YOUR PERSONAL SPACE</div><h1>{tab === 'Overview' ? 'Good to see you.' : tab}</h1><p>{tab === 'Overview' ? 'A clearer picture of everything that matters to you.' : tab === 'Money' ? 'Keep your IQD and USD transactions organized.' : tab === 'Items' ? 'Know what you have, and where it is.' : tab === 'Notes' ? 'Your thoughts, collected in one place.' : 'Manage your personal workspace.'}</p></div>{tab !== 'Settings' && <button className="button primary" onClick={() => { setFormError(''); setModal(tab === 'Money' ? 'transaction' : tab === 'Items' ? 'item' : tab === 'Notes' ? 'note' : 'transaction'); }}><Plus size={17} /><span>{tab === 'Money' ? 'Add transaction' : tab === 'Items' ? 'Add item' : tab === 'Notes' ? 'New note' : 'Quick add'}</span></button>}</div>

          {tab === 'Overview' && <>
            <div className="welcome-banner"><div className="welcome-orb"><Activity size={26} /></div><div><span className="banner-label">YOUR DASHBOARD</span><h2>Everything in its right place.</h2><p>Track your finances, catalog your items, and capture your ideas.</p></div><div className="banner-spark"><span /><span /><span /><span /><span /><span /><span /></div></div>
            <div className="section-title"><h2>Financial snapshot</h2><span>Tracked transactions only</span></div>
            <div className="stats-grid">
              <StatCard icon={<Wallet size={18} />} label="IQD balance" value={money(totals.IQD.income - totals.IQD.expense, 'IQD')} note={`${money(totals.IQD.income, 'IQD')} income recorded`} tone="violet" />
              <StatCard icon={<CircleDollarSign size={18} />} label="USD balance" value={money(totals.USD.income - totals.USD.expense, 'USD')} note={`${money(totals.USD.expense, 'USD')} spent recorded`} tone="blue" />
              <StatCard icon={<Boxes size={18} />} label="Items tracked" value={String(items.length)} note={`${items.reduce((sum, item) => sum + Number(item.quantity), 0)} total units`} tone="green" />
              <StatCard icon={<FileText size={18} />} label="Saved notes" value={String(notes.length)} note="Your ideas, in one place" tone="amber" />
            </div>
            <div className="content-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Money activity</h3><p>Sample trend · IQD</p></div><span className="chart-legend"><i /> Income <i className="legend-expense" /> Expenses</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={moneyChart} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cff" stopOpacity={0.26} /><stop offset="95%" stopColor="#8b7cff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#252935" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#777f91', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#777f91', fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} /><Tooltip contentStyle={{ background: '#171a23', border: '1px solid #303545', borderRadius: 12, color: '#fff', fontSize: 12 }} formatter={(value) => [money(Number(value), 'IQD')]} /><Area type="monotone" dataKey="income" name="Income" stroke="#9b8cff" strokeWidth={2.5} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expense" name="Expenses" stroke="#42c8ad" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer></div><p className="chart-footnote">Illustrative chart only — replace with your recorded data as transactions are added.</p></section>
            <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent transactions</h3><p>Your latest money activity</p></div><button className="subtle-link" onClick={() => setTab('Money')}>View all</button></div>{transactions.slice(0, 4).length ? transactions.slice(0, 4).map((t) => <TransactionRow key={t.id} transaction={t} />) : <EmptyState icon={<Wallet size={20} />} title="No transactions yet" text="Your recorded income and expenses will show here." />}</section></div>
            <div className="section-title section-title-lower"><h2>Your workspace</h2><span>Everything you track</span></div><div className="workspace-grid"><QuickCard icon={<Wallet />} title="Money tracker" desc="Income, expenses, and balances" count={`${transactions.length} transactions`} tone="violet" onClick={() => setTab('Money')} /><QuickCard icon={<Boxes />} title="Item tracker" desc="Belongings and inventory" count={`${items.length} saved items`} tone="green" onClick={() => setTab('Items')} /><QuickCard icon={<FileText />} title="Note tracker" desc="Thoughts and important details" count={`${notes.length} saved notes`} tone="amber" onClick={() => setTab('Notes')} /></div>
          </>}

          {tab === 'Money' && <><div className="stats-grid money-stats"><StatCard icon={<TrendingUp size={18} />} label="IQD balance" value={money(totals.IQD.income - totals.IQD.expense, 'IQD')} note="Income minus expenses" tone="violet" /><StatCard icon={<CircleDollarSign size={18} />} label="USD balance" value={money(totals.USD.income - totals.USD.expense, 'USD')} note="Income minus expenses" tone="blue" /><StatCard icon={<ArrowDownLeft size={18} />} label="Total IQD income" value={money(totals.IQD.income, 'IQD')} note="Recorded income" tone="green" /><StatCard icon={<ArrowUpRight size={18} />} label="Total IQD expenses" value={money(totals.IQD.expense, 'IQD')} note="Recorded expenses" tone="amber" /></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Transactions</h3><p>IQD and USD are tracked separately</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search transactions" /></div>{filteredTransactions.length ? <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>TYPE</th><th>DATE</th><th className="align-right">AMOUNT</th></tr></thead><tbody>{filteredTransactions.map((t) => <tr key={t.id}><td><div className="table-name"><span className={'transaction-icon ' + t.kind}>{t.kind === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><strong>{t.title}</strong></div></td><td><span className="category-pill">{t.category}</span></td><td><span className={'type-label ' + t.kind}>{t.kind}</span></td><td>{dateLabel(t.created_at)}</td><td className={'align-right amount ' + t.kind}>{t.kind === 'income' ? '+' : '−'}{money(Number(t.amount), t.currency)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Wallet size={20} />} title="No matching transactions" text="Add your first transaction to start tracking your money." action={<button className="button secondary" onClick={() => setModal('transaction')}><Plus size={16} /> Add transaction</button>} />}</section></>}

          {tab === 'Items' && <section className="panel list-panel"><div className="panel-heading"><div><h3>Your items</h3><p>Track quantities, categories, and locations</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search items" /></div>{filteredItems.length ? <div className="item-grid">{filteredItems.map((item) => <article className="item-card" key={item.id}><div className="item-card-icon"><Boxes size={20} /></div><span className="category-pill">{item.category}</span><h3>{item.name}</h3><p>{item.location || 'Location not specified'}</p><div className="item-card-bottom"><span>Quantity</span><strong>{item.quantity}</strong></div></article>)}</div> : <EmptyState icon={<Boxes size={20} />} title="Your inventory starts here" text="Add belongings, devices, collections, or anything you want to keep track of." action={<button className="button primary" onClick={() => setModal('item')}><Plus size={16} /> Add first item</button>} />}</section>}

          {tab === 'Notes' && <section className="panel list-panel"><div className="panel-heading"><div><h3>All notes</h3><p>Search your saved thoughts and details</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search notes" /></div>{filteredNotes.length ? <div className="notes-grid">{filteredNotes.map((note) => <article className="note-card" key={note.id}><div className="note-card-top"><span className="note-icon"><FileText size={17} /></span><span>{dateLabel(note.created_at)}</span></div><h3>{note.title}</h3><p>{note.body || 'No additional details.'}</p></article>)}</div> : <EmptyState icon={<FileText size={20} />} title="A place for your thoughts" text="Create notes for ideas, reminders, plans, or information you want to keep handy." action={<button className="button primary" onClick={() => setModal('note')}><Plus size={16} /> Write a note</button>} />}</section>}

          {tab === 'Settings' && <div className="settings-grid"><section className="panel settings-panel"><div className="settings-icon"><ShieldCheck size={21} /></div><h3>Account & privacy</h3><p>Your account is signed in. Firestore Security Rules must restrict each record to its authenticated owner.</p><div className="settings-row"><span>Email</span><strong>{session.email}</strong></div><div className="settings-row"><span>Sync status</span><span className="sync-status"><i /> Connected</span></div><div className="settings-row"><span>Default currency</span><strong>IQD (USD supported)</strong></div><button className="button secondary full" onClick={() => { if (auth) void signOut(auth); }}><LogOut size={16} /> Sign out</button></section><section className="panel settings-panel"><div className="settings-icon blue"><Settings size={21} /></div><h3>Workspace preferences</h3><p>Pannel is optimized for mobile screens and supports larger displays.</p><div className="settings-row"><span>Language / زمان</span><select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="ckb">کوردی (سۆرانی)</option></select></div><div className="settings-row"><span>Appearance</span><strong>Dark Pro</strong></div><div className="settings-row"><span>Layout</span><strong>Mobile-first</strong></div><div className="settings-row"><span>Currency display</span><strong>Per-transaction currency</strong></div><div className="settings-hint">IQD and USD balances are kept separate. No automatic exchange rate is assumed.</div></section></div>}
        </div>
        <footer className="footer"><span>© {new Date().getFullYear()} Pannel Dashboard</span><span><ShieldCheck size={13} /> Your personal space</span></footer>
      </main>
      <nav className="mobile-nav">{navItems.slice(0, 4).map(({ name, icon: Icon }) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon size={20} /><span>{name === 'Overview' ? 'Home' : name}</span></button>)}<button className={tab === 'Settings' ? 'active' : ''} onClick={() => setTab('Settings')}><Menu size={20} /><span>More</span></button></nav>

      {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2 id="modal-title">{modal === 'transaction' ? 'Add transaction' : modal === 'item' ? 'Add item' : 'Create a note'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button></div>
        <form className="form-stack" onSubmit={modal === 'transaction' ? saveTransaction : modal === 'item' ? saveItem : saveNote}>
          {modal === 'transaction' && <><label>Transaction title<input value={transactionForm.title} onChange={(e) => setTransactionForm({ ...transactionForm, title: e.target.value })} placeholder="e.g. Monthly allowance" required maxLength={100} /></label><div className="form-row"><label>Amount<input type="number" min="0.01" step="any" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} placeholder="0.00" required /></label><label>Currency<select value={transactionForm.currency} onChange={(e) => setTransactionForm({ ...transactionForm, currency: e.target.value as Currency })}><option value="IQD">IQD — Dinar</option><option value="USD">USD — Dollar</option></select></label></div><div className="form-row"><label>Type<select value={transactionForm.kind} onChange={(e) => setTransactionForm({ ...transactionForm, kind: e.target.value as 'income' | 'expense' })}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Category<select value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })}>{['General', 'Food', 'Transport', 'Shopping', 'Bills', 'Salary', 'Savings', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></label></div></>}
          {modal === 'item' && <><label>Item name<input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Headphones" required maxLength={120} /></label><div className="form-row"><label>Category<select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>{['General', 'Electronics', 'Clothing', 'Home', 'Collectibles', 'Books', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></label><label>Quantity<input type="number" min="0" step="1" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} required /></label></div><label>Location <span className="optional">(optional)</span><input value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} placeholder="e.g. Desk drawer" maxLength={120} /></label></>}
          {modal === 'note' && <><label>Note title<input value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} placeholder="Give your note a title" required maxLength={160} /></label><label>Details<textarea rows={6} value={noteForm.body} onChange={(e) => setNoteForm({ ...noteForm, body: e.target.value })} placeholder="Write anything you want to remember…" maxLength={12000} /></label></>}
          {formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Save {modal === 'transaction' ? 'transaction' : modal === 'item' ? 'item' : 'note'}</button></div>
        </form></section></div>}
    </div>
  );
}

function StatCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <article className="stat-card"><div className={'stat-icon ' + tone}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></article>;
}
function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  return <div className="transaction-row"><span className={'transaction-icon ' + t.kind}>{t.kind === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div className="transaction-info"><strong>{t.title}</strong><span>{t.category} · {dateLabel(t.created_at)}</span></div><strong className={'transaction-amount ' + t.kind}>{t.kind === 'income' ? '+' : '−'}{money(Number(t.amount), t.currency)}</strong></div>;
}
function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function QuickCard({ icon, title, desc, count, tone, onClick }: { icon: React.ReactNode; title: string; desc: string; count: string; tone: string; onClick: () => void }) {
  return <button className="quick-card" onClick={onClick}><span className={'quick-icon ' + tone}>{icon}</span><span className="quick-title">{title}</span><span className="quick-desc">{desc}</span><span className="quick-bottom">{count}<ChevronDown size={15} /></span></button>;
}
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-box"><Search size={15} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>;
}