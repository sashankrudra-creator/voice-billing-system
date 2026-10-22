import { useEffect, useMemo, useState } from "react";
import ProductsView from "../components/ProductsView";
import CustomersView from "../components/CustomersView";
import SettingsView from "../components/SettingsView";
import BillsView from "../components/BillsView";
import VoiceBilling from "../components/VoiceBilling";
import ImageBilling from "../components/ImageBilling";
import BarcodeBilling from "../components/BarcodeBilling";
import axios from "axios";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Store,
  Users,
  WalletCards,
  Wifi,
  X,
  Zap,
  Camera,
  ScanLine,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "../App";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
      { label: "Bills", icon: FileText },
      { label: "Voice Billing", icon: Mic2, badge: "LIVE" },
      { label: "Image Billing", icon: Camera, badge: "NEW" },
      { label: "Barcode Billing", icon: ScanLine },
      { label: "Products", icon: Package },
      { label: "Customers", icon: Users },
    ],
  },
];

const summaryCards = [
  { label: "Today's sales", value: "₹0", meta: "No sales today", icon: IndianRupee, tone: "violet", trend: "neutral" },
  { label: "Bills generated", value: "0", meta: "No bills yet", icon: FileText, tone: "blue", trend: "neutral" },
  { label: "Customers", value: "0", meta: "No customers yet", icon: Users, tone: "amber", trend: "neutral" },
  { label: "Total products", value: "0", meta: "Catalog is empty", icon: Package, tone: "green", trend: "neutral" },
  { label: "Low stock", value: "0", meta: "All in stock", icon: Boxes, tone: "rose", trend: "neutral" },
  { label: "Monthly revenue", value: "₹0", meta: "Current month", icon: WalletCards, tone: "slate", trend: "neutral" },
];

const toneStyles: Record<string, { icon: string; ring: string }> = {
  violet: { icon: "bg-violet-100 text-violet-700", ring: "ring-violet-100" },
  blue: { icon: "bg-blue-100 text-blue-700", ring: "ring-blue-100" },
  amber: { icon: "bg-amber-100 text-amber-700", ring: "ring-amber-100" },
  green: { icon: "bg-emerald-100 text-emerald-700", ring: "ring-emerald-100" },
  rose: { icon: "bg-rose-100 text-rose-700", ring: "ring-rose-100" },
  slate: { icon: "bg-slate-100 text-slate-700", ring: "ring-slate-100" },
};

const avatarStyles: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function ChartTooltip({ active, payload, label, currency = false }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl shadow-slate-200/40">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{currency ? `₹${payload[0].value.toLocaleString("en-IN")}` : `₹${payload[0].value.toLocaleString("en-IN")}`}</p>
    </div>
  );
}

export default function Home() {
  const { shopkeeper, logout } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [salesByHour, setSalesByHour] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchDashboardData = () => {
    if (activeNav !== "Dashboard") return;
    axios.get("http://127.0.0.1:8000/api/dashboard-data/", {
      params: { shopkeeper_email: shopkeeper?.email }
    })
      .then(response => {
        const data = response.data;
        setSummaryStats(data.summaryStats);
        setSalesByHour(data.salesByHour);
        setRevenueTrend(data.revenueTrend);
        setRecentBills(data.recentBills);
        setLowStock(data.lowStock);
        setTopProducts(data.topProducts);
        setRecentCustomers(data.recentCustomers);
        setNotifications(data.notifications || []);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        toast.error("Failed to load live data");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [activeNav, shopkeeper?.email]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return [
      ...recentBills.map((bill) => ({ type: "Bill", title: bill.invoice, sub: bill.customer })),
      ...recentCustomers.map((customer) => ({ type: "Customer", title: customer.name, sub: customer.phone })),
      ...topProducts.map((product) => ({ type: "Product", title: product.name, sub: product.value })),
    ].filter((item) => `${item.title} ${item.sub}`.toLowerCase().includes(query)).slice(0, 5);
  }, [search, recentBills, recentCustomers, topProducts]);

  const handleNav = (label: string) => {
    setActiveNav(label);
    setMobileNavOpen(false);
    if (label !== "Dashboard") toast(`${label} workspace`, { description: "This module is ready to connect to your live data." });
  };

  const handleAction = (label: string) => {
    if (label === "New voice bill") return handleNav("Voice Billing");
    if (label === "Scan image") return handleNav("Image Billing");
    if (label === "Barcode scan") return handleNav("Barcode Billing");
    if (label === "Add product" || label === "Products") return handleNav("Products");
    if (label === "Add customer" || label === "Customers") return handleNav("Customers");
    if (label === "All bills" || label === "Bills") return handleNav("Bills");
    toast(label, { description: "Navigating..." });
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#10142b] text-white shadow-2xl shadow-indigo-950/10 transition-transform duration-200 lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[88px] items-center justify-between border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-violet-400 via-indigo-400 to-blue-500 shadow-lg shadow-indigo-500/30">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.4} />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#10142b] bg-emerald-300" />
            </div>
            <div>
              <p className="font-display text-[15px] font-bold tracking-tight">QuantumVoice</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-200/60">AI Billing System</p>
            </div>
          </div>
          <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-7">
          <div className="mb-8 rounded-2xl border border-indigo-300/10 bg-gradient-to-br from-indigo-500/20 to-violet-400/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-100/70"><Wifi className="h-3.5 w-3.5 text-emerald-300" /> System online</div>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.1)]" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/50">Your AI billing assistant is ready to help.</p>
          </div>

          {navGroups.map((group) => (
            <div key={group.label} className="mb-7">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(({ label, icon: Icon, badge }) => {
                  const isActive = activeNav === label;
                  return (
                    <button key={label} onClick={() => handleNav(label)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-all duration-150 ${isActive ? "bg-white text-slate-900 shadow-lg shadow-black/10" : "text-white/55 hover:bg-white/8 hover:text-white"}`}>
                      <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-violet-600" : "text-white/45 group-hover:text-white/80"}`} strokeWidth={isActive ? 2.3 : 1.9} />
                      <span className="flex-1">{label}</span>
                      {badge && <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${isActive ? "bg-violet-50 text-violet-600" : badge === "LIVE" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-white/35"}`}>{badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 p-4">
          <button onClick={() => handleNav("Settings")} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-white/50 transition hover:bg-white/8 hover:text-white"><Settings2 className="h-[17px] w-[17px]" /> Settings</button>
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-orange-300 text-xs font-bold text-orange-800">
              {shopkeeper?.name ? shopkeeper.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'SK'}
            </div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{shopkeeper?.name || 'Shopkeeper'}</p><p className="mt-0.5 truncate text-[10px] text-white/35">Owner · {shopkeeper?.store_name || 'Store'}</p></div>
            <ChevronDown className="h-4 w-4 text-white/30" />
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-4 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
          <button onClick={() => setMobileNavOpen(true)} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="relative max-w-[380px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, customers, invoices…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-12 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">⌘ K</kbd>
            {searchResults.length > 0 && <div className="absolute left-0 right-0 top-[50px] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-300/30">
              {searchResults.map((result) => <button key={`${result.type}-${result.title}`} onClick={() => { toast(`${result.type}: ${result.title}`); setSearch(""); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Search className="h-3.5 w-3.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{result.title}</p><p className="truncate text-[10px] text-slate-400">{result.type} · {result.sub}</p></div><ChevronRight className="h-3.5 w-3.5 text-slate-300" /></button>)}
            </div>}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live sync</div>
            <button onClick={() => toast("You're all caught up", { description: "No new notifications right now." })} className="relative rounded-xl border border-transparent p-2.5 text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900" aria-label="Notifications"><Bell className="h-[19px] w-[19px]" strokeWidth={1.8} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500 ring-2 ring-white" /></button>
            <div className="hidden h-7 w-px bg-slate-200 sm:block" />
            <div className="relative">
              <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} className="flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition hover:bg-slate-50"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-orange-300 text-xs font-bold text-orange-800">{shopkeeper?.name ? shopkeeper.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'SK'}</div><div className="hidden text-left md:block"><p className="text-xs font-bold text-slate-800">{shopkeeper?.name || 'Shopkeeper'}</p><p className="text-[10px] text-slate-400">{shopkeeper?.store_name || 'Store'}</p></div><ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" /></button>
              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/50">
                    <div className="px-2 py-2 mb-1 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-800">{shopkeeper?.name || 'Shopkeeper'}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{shopkeeper?.email || 'shopkeeper@example.com'}</p>
                    </div>
                    <button onClick={() => { setProfileMenuOpen(false); handleNav('Settings'); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-violet-600">
                      <Settings2 className="h-4 w-4" /> Settings
                    </button>
                    <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 sm:px-6 lg:px-10 lg:pt-9">
          {activeNav === "Products" && <ProductsView />}
          {activeNav === "Customers" && <CustomersView />}
          {activeNav === "Settings" && <SettingsView />}
          {activeNav === "Bills" && <BillsView />}
          {activeNav === "Voice Billing" && <VoiceBilling />}
          {activeNav === "Image Billing" && <ImageBilling />}
          {activeNav === "Barcode Billing" && <BarcodeBilling />}
          {activeNav === "Dashboard" && (
            <>
              <section className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600"><Store className="h-3.5 w-3.5" /> {shopkeeper?.store_name || 'Store'} <span className="text-slate-300">/</span> Overview</div>
              <h1 className="font-display text-[28px] font-bold tracking-[-0.04em] text-slate-950 sm:text-[34px]">{getGreeting(now.getHours())}, {shopkeeper?.name ? shopkeeper.name.split(' ')[0] : 'Shopkeeper'} <span className="inline-block origin-bottom-right animate-[wave_1.8s_ease-in-out_infinite]">👋</span></h1>
              <p className="mt-2 text-sm text-slate-500">Here’s what’s happening with your business today.</p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-sm shadow-slate-200/40 md:self-auto"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Clock3 className="h-4 w-4" /></div><div><p className="text-[11px] font-semibold text-slate-800">{formatDate(now)}</p><p className="mt-0.5 text-[10px] text-slate-400">Last synced {formatTime(now)}</p></div></div>
          </section>

          <section className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {summaryCards.map(({ label, icon: Icon, tone, trend }, index) => {
              const styles = toneStyles[tone];
              let dynamicValue = "₹0";
              let dynamicMeta = "No activity yet";
              if (summaryStats) {
                 if (index === 0) { dynamicValue = summaryStats.todaySales; dynamicMeta = summaryStats.todaySalesMeta || "No sales today"; }
                 if (index === 1) { dynamicValue = String(summaryStats.billsGenerated); dynamicMeta = summaryStats.billsGeneratedMeta || "No bills yet"; }
                 if (index === 2) { dynamicValue = String(summaryStats.totalCustomers); dynamicMeta = summaryStats.totalCustomersMeta || "No customers yet"; }
                 if (index === 3) { dynamicValue = String(summaryStats.totalProducts); dynamicMeta = summaryStats.totalProductsMeta || "Catalog is empty"; }
                 if (index === 4) { dynamicValue = String(summaryStats.lowStock); dynamicMeta = summaryStats.lowStockMeta || "All in stock"; }
                 if (index === 5) { dynamicValue = summaryStats.monthlyRevenue; dynamicMeta = summaryStats.monthlyRevenueMeta || "Current month"; }
              }
              const isZero = dynamicValue === "0" || dynamicValue === "₹0";
              return (
                <div key={label} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/40 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-4 ${styles.icon} ${styles.ring}`}>
                      <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
                    </div>
                    {isZero ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                        Ready
                      </span>
                    ) : (
                      <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend === "down" ? "text-rose-500" : "text-emerald-600"}`}>
                        {trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {trend === "down" ? "Needs action" : "On track"}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                  <p className="mt-1 text-[22px] font-bold tracking-[-0.035em] text-slate-950">{dynamicValue}</p>
                  <p className="mt-1.5 text-[10px] font-medium text-slate-400">{dynamicMeta}</p>
                  <div className={`absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-[0.045] ${styles.icon.split(" ")[0]}`} />
                </div>
              );
            })}
          </section>

          <section className="mb-7 grid gap-5 xl:grid-cols-[1.48fr_1fr]">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Today’s sales</h2><span className="rounded-md bg-emerald-50 px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-600">Live</span></div><p className="mt-1 text-xs text-slate-400">Hourly revenue performance</p></div><span className="text-[11px] font-semibold text-slate-400">Hourly breakdown</span></div>
              <div className="h-[218px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={salesByHour} margin={{ top: 10, right: 2, left: -20, bottom: 0 }} barCategoryGap="30%"><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(value) => value === 0 ? "₹0" : `₹${value / 1000}k`} /><Tooltip cursor={{ fill: "#f8f7ff" }} content={<ChartTooltip />} /><Bar dataKey="sales" fill="url(#barGradient)" radius={[5, 5, 2, 2]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400"><span className="h-2 w-2 rounded-full bg-violet-500" /> Revenue by hour <span className="ml-auto font-semibold text-slate-500">{summaryStats?.todaySales !== "₹0" ? "Peak: 6 PM" : "Awaiting sales"}</span></div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
              <div className="mb-5 flex items-start justify-between"><div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Revenue trend</h2><p className="mt-1 text-xs text-slate-400">Last 7 days</p></div><button onClick={() => handleAction("Bills")} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><MoreHorizontal className="h-4 w-4" /></button></div>
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-[25px] font-bold tracking-[-0.04em] text-slate-950">{summaryStats?.monthlyRevenue || "₹0"}</span>
                {summaryStats?.billsGenerated > 0 && (
                  <span className="flex items-center text-[10px] font-bold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> Active</span>
                )}
              </div>
              <p className="mb-2 text-[10px] text-slate-400">{summaryStats?.billsGenerated > 0 ? "Total revenue recorded" : "No sales in the last 7 days"}</p>
              <div className="h-[184px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={revenueTrend} margin={{ top: 12, right: 4, left: -22, bottom: 0 }}><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.25} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} /></linearGradient><linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#a78bfa" /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f6" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 9 }} dy={7} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 9 }} tickFormatter={(value) => `₹${value / 1000}k`} /><Tooltip content={<ChartTooltip currency />} /><Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#areaGradient)" dot={{ r: 3, fill: "#7c3aed", strokeWidth: 2, stroke: "white" }} activeDot={{ r: 5, fill: "#7c3aed", strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div>
            </div>
          </section>

          <section className="mb-7 grid gap-5 xl:grid-cols-1">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Recent bills</h2>
                  <p className="mt-1 text-xs text-slate-400">Your latest invoices at a glance</p>
                </div>
                <button onClick={() => handleNav("Bills")} className="flex items-center gap-1 text-[11px] font-bold text-violet-600 transition hover:text-violet-800">
                  View all history <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      <th className="px-5 py-3 font-bold sm:px-6">Invoice</th>
                      <th className="px-3 py-3 font-bold">Customer</th>
                      <th className="px-3 py-3 font-bold">Amount</th>
                      <th className="px-3 py-3 font-bold">Time</th>
                      <th className="px-3 py-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBills.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-400">
                          No bills generated yet. Start billing via Voice, Image, or Barcode!
                        </td>
                      </tr>
                    ) : (
                      recentBills.map((bill) => (
                        <tr key={bill.invoice} className="border-b border-slate-50 last:border-0 transition hover:bg-slate-50/70">
                          <td className="px-5 py-3.5 text-xs font-bold text-slate-800 sm:px-6">{bill.invoice}</td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[9px] font-bold ${avatarStyles[bill.tone] || 'bg-slate-100 text-slate-600'}`}>{bill.initials}</div>
                              <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{bill.customer}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-xs font-bold text-slate-900">{bill.amount}</td>
                          <td className="px-3 py-3.5 text-[11px] text-slate-400">{bill.time}</td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold ${bill.status === "Paid" ? "bg-emerald-50 text-emerald-700" : bill.status === "Pending" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${bill.status === "Paid" ? "bg-emerald-500" : bill.status === "Pending" ? "bg-amber-500" : "bg-blue-500"}`} />{bill.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="mb-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Quick actions</h2><p className="mt-1 text-xs text-slate-400">Common tasks, one tap away</p></div><span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><Zap className="h-3.5 w-3.5 text-amber-400" /> Built for speed</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{[{ label: "New voice bill", icon: Mic2, tone: "bg-violet-50 text-violet-700", primary: true }, { label: "Scan image", icon: Camera, tone: "bg-blue-50 text-blue-700" }, { label: "Barcode scan", icon: ScanLine, tone: "bg-emerald-50 text-emerald-700" }, { label: "Add product", icon: Package, tone: "bg-amber-50 text-amber-700" }, { label: "Add customer", icon: Users, tone: "bg-rose-50 text-rose-700" }].map(({ label, icon: Icon, tone, primary }) => <button key={label} onClick={() => handleAction(label)} className={`group flex flex-col items-start rounded-xl border p-3.5 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${primary ? "border-violet-200 bg-violet-600 text-white shadow-lg shadow-violet-600/15 hover:bg-violet-700" : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-white"}`}><div className={`mb-4 flex h-8 w-8 items-center justify-center rounded-lg ${primary ? "bg-white/15 text-white" : tone}`}><Icon className="h-4 w-4" /></div><span className={`text-[11px] font-bold ${primary ? "text-white" : "text-slate-700"}`}>{label}</span><ChevronRight className={`mt-2 h-3.5 w-3.5 transition group-hover:translate-x-0.5 ${primary ? "text-white/60" : "text-slate-300"}`} /></button>)}</div></section>

          <section className="grid gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
              <div className="flex items-start justify-between">
                <div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Top selling products</h2><p className="mt-1 text-xs text-slate-400">Best performers this month</p></div>
                <button onClick={() => handleAction("Products")} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal className="h-4 w-4" /></button>
              </div>
              <div className="mt-5 space-y-4">
                {topProducts.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No products sold yet.</p>
                ) : (
                  topProducts.map((product, index) => (
                    <div key={product.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-4 text-[10px] font-bold text-slate-300">0{index + 1}</span>
                          <span className="truncate text-[11px] font-bold text-slate-700">{product.name}</span>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-slate-900">{product.value}</span>
                      </div>
                      <div className="ml-6 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${product.color}`} style={{ width: product.width }} />
                        </div>
                        <span className="w-12 text-right text-[9px] font-medium text-slate-400">{product.sold}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
              <div className="flex items-start justify-between">
                <div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Daily sales summary</h2><p className="mt-1 text-xs text-slate-400">Recent day-by-day performance</p></div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><IndianRupee className="h-4 w-4" /></div>
              </div>
              <div className="mt-5 space-y-1">
                {revenueTrend.length === 0 || summaryStats?.billsGenerated === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No sales recorded yet.</p>
                ) : (
                  revenueTrend.slice().reverse().map((item, idx) => (
                    <div key={item.day} className={`flex items-center rounded-xl px-3 py-3 ${idx === 0 ? "bg-violet-50/70" : ""}`}>
                      <div className={`mr-3 h-2 w-2 rounded-full ${idx === 0 ? "bg-violet-500" : "bg-slate-200"}`} />
                      <span className="flex-1 text-xs font-semibold text-slate-600">{item.day}</span>
                      <span className="mr-3 text-xs font-bold text-slate-900">₹{(item.value).toLocaleString("en-IN")}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Voice billing status</h2><p className="mt-1 text-xs text-slate-400">Your AI assistant’s performance</p></div><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><Mic2 className="h-4 w-4" /></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold text-slate-400">Voice bills today</p><p className="mt-1 text-[23px] font-bold tracking-tight text-slate-900">{summaryStats?.voiceBillsToday || 0}</p><p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> Ready</p></div><div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-[10px] font-semibold text-emerald-700/60">Accuracy</p><p className="mt-1 text-[23px] font-bold tracking-tight text-emerald-800">{summaryStats?.accuracy || "100%"}</p><p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CircleCheck className="h-3 w-3" /> Ready</p></div></div></div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Recent customers</h2><p className="mt-1 text-xs text-slate-400">Latest customers who visited your store</p></div>
                <button onClick={() => handleAction("Customers")} className="text-[11px] font-bold text-violet-600">View all</button>
              </div>
              <div className="space-y-2">
                {recentCustomers.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No customers recorded yet.</p>
                ) : (
                  recentCustomers.map((customer) => (
                    <div key={customer.name} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-bold ${avatarStyles[customer.tone] || 'bg-slate-100 text-slate-600'}`}>{customer.initials}</div>
                      <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{customer.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{customer.phone}</p></div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-[16px] font-bold tracking-tight text-slate-950">Notifications</h2><p className="mt-1 text-xs text-slate-400">Recent activity across your store</p></div><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">{notifications.length}</span></div><div className="space-y-3">{notifications.length > 0 ? notifications.map((notif: any) => <button key={notif.id} onClick={() => toast(notif.title, { description: notif.description })} className="flex w-full items-center gap-3 rounded-xl text-left transition hover:bg-slate-50"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notif.color}`}><Bell className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-700">{notif.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{notif.description}</p></div><span className="shrink-0 text-[9px] font-medium text-slate-300">{notif.time}</span></button>) : <p className="text-center text-xs text-slate-400">No new notifications</p>}</div></div>
          </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
