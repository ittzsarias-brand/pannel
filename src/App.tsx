import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Boxes, Check, ChevronDown, CircleDollarSign,
  FileText, Home, LogOut, Menu, Plus, Search, Settings, ShieldCheck,
  TrendingUp, Wallet, X, LoaderCircle, Sun, Moon,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { auth, db, isFirebaseConfigured } from './lib/firebase';


type Language = 'en' | 'ckb';
const uiTranslations: Record<string, string> = {
  'Overview':'پوختە', 'Money':'پارە', 'Items':'کەلوپەل', 'Debts':'قەرد', 'Settings':'ڕێکخستنەکان',
  'WORKSPACE':'بەشی کار', 'Workspace':'شوێنی کار', 'Cloud sync enabled':'هاوکاتکردنی ئۆنلاین چالاکە',
  'Good to see you.':'بەخێربێیتەوە.', 'A clearer picture of everything that matters to you.':'هەموو شتە گرنگەکانت بە ڕوونی ببینە.',
  'Keep your IQD and USD transactions organized.':'مامەڵەکانی دینار و دۆلارت ڕێک بخە.', 'Know what you have, and where it is.':'بزانە چی هەتە و لە کوێیە.',
  'Your debts, clearly organized.':'قەرزەکانت بە ڕوونی ڕێک بخە.', 'Manage your personal workspace.':'شوێنی کاری تایبەتی خۆت بەڕێوەببە.',
  'Add transaction':'زیادکردنی مامەڵە', 'Add item':'زیادکردنی کەلوپەل', 'New debt':'تێبینییەکی نوێ', 'Quick add':'زیادکردنی خێرا',
  'Track your finances, catalog your items, and capture your ideas.':'داراییەکانت بەدواداچوون بکە، کەلوپەلەکانت تۆمار بکە و بیرۆکەکانت بنووسە.',
  'Financial snapshot':'پوختەی دارایی', 'Tracked transactions only':'تەنها مامەڵە تۆمارکراوەکان', 'IQD balance':'باڵانسی IQD', 'USD balance':'باڵانسی USD',
  'Items tracked':'کەلوپەلە تۆمارکراوەکان', 'Saved debts':'قەردە تۆمارکراوەکان', 'Money activity':'جووڵەی پارە', 'Recent transactions':'دوایین مامەڵەکان',
  'Your latest money activity':'دوایین چالاکییە داراییەکانت', 'View all':'بینینی هەمووی', 'No transactions yet':'هێشتا هیچ مامەڵەیەک نییە',
  'Your recorded income and expenses will show here.':'داهات و خەرجییە تۆمارکراوەکانت لێرە دەردەکەون.',
  'Your workspace':'شوێنی کاری تۆ', 'Everything you track':'هەموو ئەو شتانەی بەدواداچوونیان دەکەیت',
  'Transactions':'مامەڵەکان', 'Your items':'کەلوپەلەکانت', 'All debts':'هەموو قەردەکان', 'Account & privacy':'هەژمار و تایبەتمەندییەکان',
  'Workspace preferences':'هەڵبژاردەکانی شوێنی کار', 'Email':'ئیمەیڵ', 'Sync status':'دۆخی هاوکاتکردنەوە', 'Connected':'پەیوەستە',
  'Default currency':'دراوی سەرەکی', 'Appearance':'ڕووکار', 'Layout':'ڕێکخستن', 'Currency display':'پیشاندانی دراو',
  'Sign out':'چوونەدەرەوە', 'Language':'زمان', 'English':'ئینگلیزی', 'Kurdish (Sorani)':'کوردیی سۆرانی',
  'Personal account':'هەژماری کەسی', 'Search transactions':'گەڕان لە مامەڵەکان', 'Search items':'گەڕان لە کەلوپەلەکان', 'Search debts':'گەڕان لە قەردەکان',
  'Cancel':'هەڵوەشاندنەوە', 'Save':'پاشەکەوتکردن', 'Add a debt':'تێبینییەک دروست بکە',
  'Transaction title':'ناونیشانی مامەڵە', 'Amount':'بڕ', 'Currency':'دراو', 'Type':'جۆر', 'Category':'پۆل', 'Item name':'ناوی کەلوپەل',
  'Quantity':'ژمارە', 'Location':'شوێن', 'Debt title':'ناوی کەس', 'Details':'وردەکاری', 'optional':'ئارەزوومەندانە',
  'Expense':'خەرجی', 'Income':'داهات', 'No matching transactions':'هیچ مامەڵەیەکی گونجاو نەدۆزرایەوە',
  'Your inventory starts here':'کۆگای کەلوپەلەکانت لێرە دەست پێ دەکات', 'A place for your debts':'شوێنێک بۆ قەردەکانت',
};

type Tab = 'Overview' | 'Money' | 'Items' | 'Debts' | 'Settings';
type Currency = 'IQD' | 'USD';
type Transaction = { id: string; title: string; amount: number; currency: Currency; kind: 'income' | 'expense'; category: string; created_at: string };
type Item = { id: string; name: string; category: string; quantity: number; location: string; created_at: string };
type Debt = { id: string; person: string; amount: number; paid: number; currency: Currency; direction: 'owed_to_me' | 'i_owe'; due_date: string; details: string; created_at: string };

const navItems: { name: Tab; icon: typeof Home }[] = [
  { name: 'Overview', icon: Home }, { name: 'Money', icon: Wallet },
  { name: 'Items', icon: Boxes }, { name: 'Debts', icon: FileText },
  { name: 'Settings', icon: Settings },
];
const money = (value: number, currency: Currency) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, maximumFractionDigits: currency === 'IQD' ? 0 : 2,
}).format(value);
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function App() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('pannel-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('pannel-theme', theme); } catch { /* storage may be unavailable */ }
  }, [theme]);
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
    observer.observe(document.body, { childList: true, subtree: true });
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
  const [debts, setDebts] = useState<Debt[]>([]);
  const [modal, setModal] = useState<'transaction' | 'item' | 'debt' | null>(null);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [transactionForm, setTransactionForm] = useState({ title: '', amount: '', currency: 'IQD' as Currency, kind: 'expense' as 'income' | 'expense', category: 'General' });
  const [itemForm, setItemForm] = useState({ name: '', category: 'General', quantity: '1', location: '' });
  const [debtForm, setDebtForm] = useState({ person: '', amount: '', paid: '0', currency: 'IQD' as Currency, direction: 'i_owe' as 'owed_to_me' | 'i_owe', due_date: '', details: '' });

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    return onAuthStateChanged(auth, (user) => { setSession(user); setAuthReady(true); });
  }, []);

  useEffect(() => {
    if (!session || !db) { setTransactions([]); setItems([]); setDebts([]); return; }
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
    const unsubDebts = onSnapshot(query(collection(db, 'debts'), where('userId', '==', session.uid)), (snapshot) => {
      setDebts(toRecords<Debt>(snapshot).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    });
    return () => { unsubTransactions(); unsubItems(); unsubDebts(); };
  }, [session]);

  const totals = useMemo(() => transactions.reduce((acc, t) => {
    acc[t.currency][t.kind] += Number(t.amount);
    return acc;
  }, { IQD: { income: 0, expense: 0 }, USD: { income: 0, expense: 0 } }), [transactions]);
  const moneyChart = useMemo(() => {
    const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = dateKey(date);
      const dayTransactions = transactions.filter((transaction) => {
        const createdAt = new Date(transaction.created_at);
        return transaction.currency === 'IQD' && !Number.isNaN(createdAt.getTime()) && dateKey(createdAt) === key;
      });
      return {
        day: date.toLocaleDateString(undefined, { weekday: 'short' }),
        income: dayTransactions.filter((transaction) => transaction.kind === 'income').reduce((sum, transaction) => sum + Number(transaction.amount), 0),
        expense: dayTransactions.filter((transaction) => transaction.kind === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0),
      };
    });
  }, [transactions]);
  const filteredItems = items.filter((item) => (item.name + ' ' + item.category + ' ' + item.location).toLowerCase().includes(search.toLowerCase()));
  const filteredDebts = debts.filter((debt) => (debt.person + ' ' + debt.details + ' ' + debt.direction).toLowerCase().includes(search.toLowerCase()));
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

  const saveDebt = async (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    const amount = Number(debtForm.amount); const paid = Number(debtForm.paid);
    if (!debtForm.person.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0 || paid > amount) { setFormError('Enter a person, a valid amount, and a payment between zero and the debt amount.'); return; }
    if (!db || !session) { setFormError('Sign in after configuring Firebase to save data.'); return; }
    setBusy(true);
    try {
      await addDoc(collection(db, 'debts'), { userId: session.uid, person: debtForm.person.trim(), amount, paid, currency: debtForm.currency, direction: debtForm.direction, due_date: debtForm.due_date, details: debtForm.details.trim(), createdAt: Date.now() });
      setModal(null); setDebtForm({ person: '', amount: '', paid: '0', currency: 'IQD', direction: 'i_owe', due_date: '', details: '' });
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Could not save debt.'); }
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
        <p className="auth-subtitle">Your money, items, and debts. All in one place.</p>
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
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setTab('Overview'); }}><span className="brand-mark"><Activity size={21} /></span><span>Pannel<span className="brand-dot">.</span></span></a>
        <nav>{navItems.map(({ name, icon: Icon }) => <button key={name} className={'nav-link ' + (tab === name ? 'active' : '')} onClick={() => setTab(name)}><Icon size={18} /><span>{name}</span>{name === 'Debts' && debts.length > 0 && <span className="nav-count">{debts.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={18} /><strong>Your space. Your data.</strong><p>Personal records, organized in one private workspace.</p><span><i /> ACCOUNT CONNECTED</span></div><div className="user-row"><div className="avatar">{session.email?.slice(0, 1).toUpperCase() ?? 'P'}</div><div className="user-info"><strong>{session.email?.split('@')[0]}</strong><span>Personal account</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => { if (auth) void signOut(auth); }}><LogOut size={17} /></button></div></div>
      </aside>

      <main className="main-content">

        <div className="page-content">
          <div className="page-toolbar">{tab !== 'Settings' && <button className="quick-add-premium" onClick={() => { setFormError(''); setModal(tab === 'Money' ? 'transaction' : tab === 'Items' ? 'item' : tab === 'Debts' ? 'debt' : 'transaction'); }}><span className="quick-add-icon"><Plus size={16} /></span><span>{tab === 'Money' ? 'Add transaction' : tab === 'Items' ? 'Add item' : tab === 'Debts' ? 'New debt' : 'Quick add'}</span></button>}</div>
          <div className={'page-heading ' + (tab === 'Overview' ? 'overview-hero' : 'inner-page-heading')}>
            <div className="hero-copy">
              {tab === 'Overview' && <span className="hero-kicker"><i /> PERSONAL WORKSPACE</span>}
              <h1>{tab === 'Overview' ? 'Your money. Your world.' : tab}</h1>
              <p>{tab === 'Overview' ? 'A clearer view of what you have, what you spend, and what matters.' : tab === 'Money' ? 'Every transaction, organized in one clear view.' : tab === 'Items' ? 'Keep track of the things you own.' : tab === 'Debts' ? 'Keep track of money owed to you and money you owe.' : 'Make your workspace work the way you do.'}</p>
            </div>
            {tab === 'Overview' && <div className="hero-orbit" aria-hidden="true"><span className="orbit-ring orbit-ring-one" /><span className="orbit-ring orbit-ring-two" /><span className="orbit-core"><Activity size={26} /></span><span className="orbit-spark orbit-spark-one" /><span className="orbit-spark orbit-spark-two" /></div>}
          </div>

          {tab === 'Overview' && <>
            <div className="section-title"><h2>Financial snapshot</h2><span>Tracked transactions only</span></div>
            <div className="stats-grid">
              <StatCard icon={<Wallet size={18} />} label="IQD balance" value={money(totals.IQD.income - totals.IQD.expense, 'IQD')} debt={`${money(totals.IQD.income, 'IQD')} income recorded`} tone="violet" />
              <StatCard icon={<CircleDollarSign size={18} />} label="USD balance" value={money(totals.USD.income - totals.USD.expense, 'USD')} debt={`${money(totals.USD.expense, 'USD')} spent recorded`} tone="blue" />
              <StatCard icon={<Boxes size={18} />} label="Items tracked" value={String(items.length)} debt={`${items.reduce((sum, item) => sum + Number(item.quantity), 0)} total units`} tone="green" />
              <StatCard icon={<FileText size={18} />} label="Saved debts" value={String(debts.length)} debt="Your ideas, in one place" tone="amber" />
            </div>
            <div className="content-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Money activity</h3><p>Recorded activity · IQD · Last 7 days</p></div><span className="chart-legend"><i /> Income <i className="legend-expense" /> Expenses</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={moneyChart} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cff" stopOpacity={0.26} /><stop offset="95%" stopColor="#8b7cff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#252935" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#777f91', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#777f91', fontSize: 10 }} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : String(v)} /><Tooltip contentStyle={{ background: '#171a23', border: '1px solid #303545', borderRadius: 12, color: '#fff', fontSize: 12 }} formatter={(value) => [money(Number(value), 'IQD')]} /><Area type="monotone" dataKey="income" name="Income" stroke="#9b8cff" strokeWidth={2.5} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expense" name="Expenses" stroke="#42c8ad" strokeWidth={2} fill="transparent" /></AreaChart></ResponsiveContainer></div><p className="chart-footnote">{transactions.some((transaction) => transaction.currency === "IQD") ? "Based on your saved IQD transactions." : "Add an IQD transaction to start building your activity history."}</p></section>
            <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent transactions</h3><p>Your latest money activity</p></div><button className="subtle-link" onClick={() => setTab('Money')}>View all</button></div>{transactions.slice(0, 4).length ? transactions.slice(0, 4).map((t) => <TransactionRow key={t.id} transaction={t} />) : <EmptyState icon={<Wallet size={20} />} title="No transactions yet" text="Your recorded income and expenses will show here." />}</section></div>
            <div className="section-title section-title-lower"><h2>Your workspace</h2><span>Everything you track</span></div><div className="workspace-grid"><QuickCard icon={<Wallet />} title="Money tracker" desc="Income, expenses, and balances" count={`${transactions.length} transactions`} tone="violet" onClick={() => setTab('Money')} /><QuickCard icon={<Boxes />} title="Item tracker" desc="Belongings and inventory" count={`${items.length} saved items`} tone="green" onClick={() => setTab('Items')} /><QuickCard icon={<FileText />} title="Debt tracker" desc="Money owed to you and money you owe" count={`${debts.length} recorded debts`} tone="amber" onClick={() => setTab('Debts')} /></div>
          </>}

          {tab === 'Money' && <><div className="stats-grid money-stats"><StatCard icon={<TrendingUp size={18} />} label="IQD balance" value={money(totals.IQD.income - totals.IQD.expense, 'IQD')} debt="Income minus expenses" tone="violet" /><StatCard icon={<CircleDollarSign size={18} />} label="USD balance" value={money(totals.USD.income - totals.USD.expense, 'USD')} debt="Income minus expenses" tone="blue" /><StatCard icon={<ArrowDownLeft size={18} />} label="Total IQD income" value={money(totals.IQD.income, 'IQD')} debt="Recorded income" tone="green" /><StatCard icon={<ArrowUpRight size={18} />} label="Total IQD expenses" value={money(totals.IQD.expense, 'IQD')} debt="Recorded expenses" tone="amber" /></div><section className="panel table-panel"><div className="panel-heading"><div><h3>Transactions</h3><p>IQD and USD are tracked separately</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search transactions" /></div>{filteredTransactions.length ? <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>CATEGORY</th><th>TYPE</th><th>DATE</th><th className="align-right">AMOUNT</th></tr></thead><tbody>{filteredTransactions.map((t) => <tr key={t.id}><td><div className="table-name"><span className={'transaction-icon ' + t.kind}>{t.kind === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><strong>{t.title}</strong></div></td><td><span className="category-pill">{t.category}</span></td><td><span className={'type-label ' + t.kind}>{t.kind}</span></td><td>{dateLabel(t.created_at)}</td><td className={'align-right amount ' + t.kind}>{t.kind === 'income' ? '+' : '−'}{money(Number(t.amount), t.currency)}</td></tr>)}</tbody></table></div> : <EmptyState icon={<Wallet size={20} />} title="No matching transactions" text="Add your first transaction to start tracking your money." action={<button className="button secondary" onClick={() => setModal('transaction')}><Plus size={16} /> Add transaction</button>} />}</section></>}

          {tab === 'Items' && <section className="panel list-panel"><div className="panel-heading"><div><h3>Your items</h3><p>Track quantities, categories, and locations</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search items" /></div>{filteredItems.length ? <div className="item-grid">{filteredItems.map((item) => <article className="item-card" key={item.id}><div className="item-card-icon"><Boxes size={20} /></div><span className="category-pill">{item.category}</span><h3>{item.name}</h3><p>{item.location || 'Location not specified'}</p><div className="item-card-bottom"><span>Quantity</span><strong>{item.quantity}</strong></div></article>)}</div> : <EmptyState icon={<Boxes size={20} />} title="Your inventory starts here" text="Add belongings, devices, collections, or anything you want to keep track of." action={<button className="button primary" onClick={() => setModal('item')}><Plus size={16} /> Add first item</button>} />}</section>}

          {tab === 'Debts' && <><div className="stats-grid money-stats"><StatCard icon={<ArrowDownLeft size={18} />} label="Owed to you · IQD" value={money(debtTotal('owed_to_me', 'IQD'), 'IQD')} note="Outstanding balance" tone="green" /><StatCard icon={<ArrowUpRight size={18} />} label="You owe · IQD" value={money(debtTotal('i_owe', 'IQD'), 'IQD')} note="Outstanding balance" tone="amber" /><StatCard icon={<CircleDollarSign size={18} />} label="Owed to you · USD" value={money(debtTotal('owed_to_me', 'USD'), 'USD')} note="Outstanding balance" tone="blue" /><StatCard icon={<Wallet size={18} />} label="You owe · USD" value={money(debtTotal('i_owe', 'USD'), 'USD')} note="Outstanding balance" tone="violet" /></div><section className="panel list-panel"><div className="panel-heading"><div><h3>Debt records</h3><p>Track who owes whom, payments, and remaining balances</p></div><SearchBox value={search} onChange={setSearch} placeholder="Search debts" /></div>{filteredDebts.length ? <div className="notes-grid">{filteredDebts.map((debt) => <article className="note-card" key={debt.id}><div className="note-card-top"><span className="note-icon"><CircleDollarSign size={17} /></span><span>{dateLabel(debt.created_at)}</span></div><h3>{debt.person}</h3><p>{debt.direction === 'owed_to_me' ? 'Owes you' : 'You owe'} · {money(outstanding(debt), debt.currency)} remaining</p><p>Original: {money(Number(debt.amount), debt.currency)} · Paid: {money(Number(debt.paid), debt.currency)}</p>{debt.due_date && <p>Due date: {debt.due_date}</p>}{debt.details && <p>{debt.details}</p>}</article>)}</div> : <EmptyState icon={<CircleDollarSign size={20} />} title="Your debt tracker starts here" text="Record money someone owes you or money you owe someone, and keep an eye on what's left to pay." action={<button className="button primary" onClick={() => setModal('debt')}><Plus size={16} /> Add first debt</button>} />}</section></>}

          {tab === 'Settings' && <div className="settings-grid"><section className="panel settings-panel"><div className="settings-icon"><ShieldCheck size={21} /></div><h3>Account & privacy</h3><p>Your account is signed in. Firestore Security Rules must restrict each record to its authenticated owner.</p><div className="settings-row"><span>Email</span><strong>{session.email}</strong></div><div className="settings-row"><span>Sync status</span><span className="sync-status"><i /> Connected</span></div><div className="settings-row"><span>Default currency</span><strong>IQD (USD supported)</strong></div><button className="button secondary full" onClick={() => { if (auth) void signOut(auth); }}><LogOut size={16} /> Sign out</button></section><section className="panel settings-panel"><div className="settings-icon blue"><Settings size={21} /></div><h3>Workspace preferences</h3><p>Pannel is optimized for mobile screens and supports larger displays.</p><div className="settings-row"><span>Language / زمان</span><select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="ckb">کوردی (سۆرانی)</option></select></div><div className="settings-row"><span>Appearance</span><button className="button secondary theme-setting" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button></div><div className="settings-row"><span>Layout</span><strong>Mobile-first</strong></div><div className="settings-row"><span>Currency display</span><strong>Per-transaction currency</strong></div><div className="settings-hint">IQD and USD balances are kept separate. No automatic exchange rate is assumed.</div></section></div>}
        </div>
      </main>
      <nav className="mobile-nav">{navItems.slice(0, 4).map(({ name, icon: Icon }) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon size={20} /><span>{name === 'Overview' ? 'Home' : name}</span></button>)}<button className={tab === 'Settings' ? 'active' : ''} onClick={() => setTab('Settings')}><Menu size={20} /><span>More</span></button></nav>

      {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2 id="modal-title">{modal === 'transaction' ? 'Add transaction' : modal === 'item' ? 'Add item' : 'Add a debt'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X size={19} /></button></div>
        <form className="form-stack" onSubmit={modal === 'transaction' ? saveTransaction : modal === 'item' ? saveItem : saveDebt}>
          {modal === 'transaction' && <><label>Transaction title<input value={transactionForm.title} onChange={(e) => setTransactionForm({ ...transactionForm, title: e.target.value })} placeholder="e.g. Monthly allowance" required maxLength={100} /></label><div className="form-row"><label>Amount<input type="number" min="0.01" step="any" value={transactionForm.amount} onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })} placeholder="0.00" required /></label><label>Currency<select value={transactionForm.currency} onChange={(e) => setTransactionForm({ ...transactionForm, currency: e.target.value as Currency })}><option value="IQD">IQD — Dinar</option><option value="USD">USD — Dollar</option></select></label></div><div className="form-row"><label>Type<select value={transactionForm.kind} onChange={(e) => setTransactionForm({ ...transactionForm, kind: e.target.value as 'income' | 'expense' })}><option value="expense">Expense</option><option value="income">Income</option></select></label><label>Category<select value={transactionForm.category} onChange={(e) => setTransactionForm({ ...transactionForm, category: e.target.value })}>{['General', 'Food', 'Transport', 'Shopping', 'Bills', 'Salary', 'Savings', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></label></div></>}
          {modal === 'item' && <><label>Item name<input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Headphones" required maxLength={120} /></label><div className="form-row"><label>Category<select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>{['General', 'Electronics', 'Clothing', 'Home', 'Collectibles', 'Books', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></label><label>Quantity<input type="number" min="0" step="1" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} required /></label></div><label>Location <span className="optional">(optional)</span><input value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} placeholder="e.g. Desk drawer" maxLength={120} /></label></>}
          {modal === 'debt' && <><label>Person / organization<input value={debtForm.person} onChange={(e) => setDebtForm({ ...debtForm, person: e.target.value })} placeholder="Who is the debt with?" required maxLength={120} /></label><div className="form-row"><label>Direction<select value={debtForm.direction} onChange={(e) => setDebtForm({ ...debtForm, direction: e.target.value as 'owed_to_me' | 'i_owe' })}><option value="owed_to_me">They owe me</option><option value="i_owe">I owe them</option></select></label><label>Currency<select value={debtForm.currency} onChange={(e) => setDebtForm({ ...debtForm, currency: e.target.value as Currency })}><option value="IQD">IQD — Dinar</option><option value="USD">USD — Dollar</option></select></label></div><div className="form-row"><label>Total amount<input type="number" min="0.01" step="any" value={debtForm.amount} onChange={(e) => setDebtForm({ ...debtForm, amount: e.target.value })} placeholder="0" required /></label><label>Already paid<input type="number" min="0" step="any" value={debtForm.paid} onChange={(e) => setDebtForm({ ...debtForm, paid: e.target.value })} placeholder="0" required /></label></div><label>Due date <span className="optional">(optional)</span><input type="date" value={debtForm.due_date} onChange={(e) => setDebtForm({ ...debtForm, due_date: e.target.value })} /></label><label>Details <span className="optional">(optional)</span><textarea rows={3} value={debtForm.details} onChange={(e) => setDebtForm({ ...debtForm, details: e.target.value })} placeholder="Any extra details…" maxLength={2000} /></label></>}
          {formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Save {modal === 'transaction' ? 'transaction' : modal === 'item' ? 'item' : 'debt'}</button></div>
        </form></section></div>}
    </div>
  );
}

function StatCard({ icon, label, value, debt, tone }: { icon: React.ReactNode; label: string; value: string; debt: string; tone: string }) {
  return <article className="stat-card"><div className={'stat-icon ' + tone}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-debt">{debt}</span></article>;
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