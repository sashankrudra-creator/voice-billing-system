import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link } from "wouter";
import { API_BASE_URL } from "../apiConfig";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Users,
  Receipt,
  IndianRupee,
  LogIn,
  LogOut,
  Search,
  RefreshCw,
  Clock,
  Laptop,
  Smartphone,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  UserPlus,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  Server,
  Cpu,
  Database,
  Sparkles,
  ExternalLink,
  Store,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";

interface AdminStats {
  total_stores: number;
  total_bills: number;
  total_revenue: string;
  total_customers: number;
  total_products: number;
  logins_today: number;
  successful_logins_today: number;
  failed_logins_today: number;
  total_login_attempts: number;
}

interface LoginLogItem {
  id: number;
  email: string;
  store_name: string | null;
  status: "SUCCESS" | "FAILED";
  failure_reason: string | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface ActivityLogItem {
  id: number;
  store_name: string | null;
  action_type: string;
  title: string;
  description: string;
  metadata: any;
  ip_address: string;
  created_at: string;
}

interface ShopkeeperItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  store_name: string;
  created_at: string;
  last_login: string;
  total_bills: number;
  total_revenue: string;
  total_products: number;
  total_customers: number;
}

interface RecentBillItem {
  id: number;
  invoice: string;
  store_name: string;
  customer: string;
  amount: string;
  status: string;
  time: string;
  created_at: string;
}

interface SystemStatus {
  database: string;
  api: string;
  quantum_engine: string;
  ai_gemini: string;
}

export default function AdminPage() {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem("qv_admin_token");
  });

  // Auth form states
  const [adminEmail, setAdminEmail] = useState("sashankrudra@gmail.com");
  const [password, setPassword] = useState("Rudra@2005");
  const [passcode, setPasscode] = useState("");
  const [authMode, setAuthMode] = useState<"credentials" | "passcode">("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem("qv_admin_profile") || "null");
    } catch {
      return null;
    }
  });

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<"activity" | "logins" | "stores" | "bills" | "system">("activity");

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState<string>("ALL");
  const [loginFilter, setLoginFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loginLogs, setLoginLogs] = useState<LoginLogItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [shopkeepers, setShopkeepers] = useState<ShopkeeperItem[]>([]);
  const [recentBills, setRecentBills] = useState<RecentBillItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // Fetch admin overview data
  const fetchOverview = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin-overview/`);
      if (res.data.success) {
        setStats(res.data.stats);
        setLoginLogs(res.data.login_logs || []);
        setActivityLogs(res.data.activity_logs || []);
        setShopkeepers(res.data.shopkeepers || []);
        setRecentBills(res.data.recent_bills || []);
        setSystemStatus(res.data.system_status || null);
      }
    } catch (err: any) {
      console.error("Failed to fetch admin overview:", err);
      if (isManual) toast.error("Could not refresh data from server");
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchOverview();
    }
  }, [isAdminAuthenticated]);

  // Auto refresh every 8 seconds when active
  useEffect(() => {
    if (!isAdminAuthenticated || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchOverview();
    }, 8000);
    return () => clearInterval(interval);
  }, [isAdminAuthenticated, autoRefresh]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const payload: any = {};
      if (authMode === "passcode") {
        payload.passcode = passcode.trim();
      } else {
        payload.email = adminEmail.trim();
        payload.username = adminEmail.trim();
        payload.password = password.trim();
      }

      const res = await axios.post(`${API_BASE_URL}/api/admin-auth/`, payload);
      if (res.data.success) {
        localStorage.setItem("qv_admin_token", res.data.token);
        localStorage.setItem("qv_admin_profile", JSON.stringify(res.data.admin));
        setAdminProfile(res.data.admin);
        setIsAdminAuthenticated(true);
        toast.success(`Welcome to Admin Console, ${res.data.admin.name}!`);
        fetchOverview();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Invalid administrator credentials or passcode");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickLoginAsSashank = async () => {
    setAdminEmail("sashankrudra@gmail.com");
    setPassword("Rudra@2005");
    setAuthLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin-auth/`, {
        email: "sashankrudra@gmail.com",
        password: "Rudra@2005",
      });
      if (res.data.success) {
        localStorage.setItem("qv_admin_token", res.data.token);
        localStorage.setItem("qv_admin_profile", JSON.stringify(res.data.admin));
        setAdminProfile(res.data.admin);
        setIsAdminAuthenticated(true);
        toast.success(`Welcome, Sashank Rudra! Admin Console unlocked.`);
        fetchOverview();
      }
    } catch (err: any) {
      toast.error("Direct login failed. Please check password.");
    } finally {
      setAuthLoading(false);
    }
  };

  const quickUnlock = async () => {
    setPasscode("admin12");
    setAuthLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin-auth/`, { passcode: "admin12" });
      if (res.data.success) {
        localStorage.setItem("qv_admin_token", res.data.token);
        localStorage.setItem("qv_admin_profile", JSON.stringify(res.data.admin));
        setAdminProfile(res.data.admin);
        setIsAdminAuthenticated(true);
        toast.success("Admin Console unlocked with master key!");
        fetchOverview();
      }
    } catch (err: any) {
      toast.error("Auto unlock failed. Please enter credentials.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("qv_admin_token");
    localStorage.removeItem("qv_admin_profile");
    setIsAdminAuthenticated(false);
    setAdminProfile(null);
    toast.info("Admin session terminated.");
  };

  // Helper to format date
  const formatDateTime = (isoString: string) => {
    if (!isoString) return "N/A";
    try {
      const date = new Date(isoString);
      return date.toLocaleString("en-IN", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Time ago calculation
  const timeAgo = (isoString: string) => {
    if (!isoString) return "";
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 15) return "Just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      return `${Math.floor(diffHour / 24)}d ago`;
    } catch {
      return "";
    }
  };

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    return activityLogs.filter((act) => {
      const matchesFilter =
        activityFilter === "ALL" ||
        (activityFilter === "BILL" && act.action_type === "BILL_CREATED") ||
        (activityFilter === "LOGIN" && act.action_type === "LOGIN") ||
        (activityFilter === "REGISTER" && act.action_type === "REGISTER") ||
        (activityFilter === "PRODUCT" && act.action_type === "PRODUCT_ADDED") ||
        (activityFilter === "PROFILE" && act.action_type === "PROFILE_UPDATED");

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        act.title.toLowerCase().includes(q) ||
        (act.description && act.description.toLowerCase().includes(q)) ||
        (act.store_name && act.store_name.toLowerCase().includes(q)) ||
        (act.ip_address && act.ip_address.includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [activityLogs, activityFilter, searchQuery]);

  // Filtered Logins
  const filteredLogins = useMemo(() => {
    return loginLogs.filter((log) => {
      const matchesFilter = loginFilter === "ALL" || log.status === loginFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        log.email.toLowerCase().includes(q) ||
        (log.store_name && log.store_name.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.includes(q)) ||
        (log.user_agent && log.user_agent.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [loginLogs, loginFilter, searchQuery]);

  // Filtered Stores
  const filteredStores = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return shopkeepers;
    return shopkeepers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.store_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q))
    );
  }, [shopkeepers, searchQuery]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return recentBills;
    return recentBills.filter(
      (b) =>
        b.invoice.toLowerCase().includes(q) ||
        b.customer.toLowerCase().includes(q) ||
        b.store_name.toLowerCase().includes(q) ||
        b.amount.toLowerCase().includes(q)
    );
  }, [recentBills, searchQuery]);

  // If NOT authenticated as admin, show the Admin Gatekeeper Login
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Glow ambient effects */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-[130px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-indigo-950/50">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mb-4">
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                QuantumVoice Admin
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Route: <code className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300 font-mono text-xs">/admin12</code>
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <Lock className="w-3.5 h-3.5" />
                Protected Executive Console
              </div>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex bg-slate-800/80 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setAuthMode("credentials")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authMode === "credentials"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Admin Email & Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("passcode")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authMode === "passcode"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Passcode (admin12)
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {authMode === "credentials" ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="sashankrudra@gmail.com"
                      required
                      autoFocus
                      className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-slate-300">
                        Admin Password
                      </label>
                      <span className="text-[11px] text-slate-400">Rudra@2005</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                        className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Security Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="admin12"
                      required
                      autoFocus
                      className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Master key: <code className="text-indigo-400 font-mono">admin12</code>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Sign In as Admin
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleQuickLoginAsSashank}
                disabled={authLoading}
                className="w-full py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 font-medium text-xs rounded-xl border border-emerald-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                1-Click Sign In as sashankrudra@gmail.com
              </button>

              <button
                type="button"
                onClick={quickUnlock}
                disabled={authLoading}
                className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-slate-700/60 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                1-Click Master Unlock (admin12)
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800 text-center">
              <Link
                href="/"
                className="text-xs text-slate-400 hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5"
              >
                <Store className="w-3.5 h-3.5" />
                Return to Shopkeeper Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED: Full Admin Dashboard
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">QuantumVoice Master Console</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                  /admin12
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Monitoring Active
                </span>
                <span>•</span>
                <span>Audit & Activity Hub</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-refresh pill */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoRefresh
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
              title="Automatically poll every 8 seconds for new logins and events"
            >
              <Activity className="w-3.5 h-3.5" />
              Auto-Sync: {autoRefresh ? "ON (8s)" : "PAUSED"}
            </button>

            {/* Manual refresh button */}
            <button
              onClick={() => fetchOverview(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
              Sync Now
            </button>

            {/* Back to Store */}
            <Link
              href="/"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              <Store className="w-3.5 h-3.5" />
              Store Dashboard
            </Link>

            {/* Logout button */}
            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
              title="End admin session"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lock
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Registered Stores */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Registered Stores</span>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Store className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats?.total_stores ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-indigo-400" />
              <span>{stats?.total_customers ?? 0} platform customers</span>
            </div>
          </div>

          {/* Card 2: Logins Today */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Logins Today</span>
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <LogIn className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight flex items-baseline gap-2">
              <span>{stats?.logins_today ?? 0}</span>
              <span className="text-xs font-normal text-slate-400">attempts</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span className="text-emerald-400 font-medium">✓ {stats?.successful_logins_today ?? 0} OK</span>
              <span>•</span>
              <span className="text-rose-400 font-medium">✕ {stats?.failed_logins_today ?? 0} Failed</span>
            </div>
          </div>

          {/* Card 3: Total Platform Bills */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Bills Generated</span>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats?.total_bills ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>Quantum QGBI Verified Invoices</span>
            </div>
          </div>

          {/* Card 4: Platform Total Sales */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Sales Volume</span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {stats?.total_revenue ?? "₹0"}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Package className="w-3 h-3 text-emerald-400" />
              <span>{stats?.total_products ?? 0} products in catalogs</span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs & Search Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "activity"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Activity className="w-4 h-4" />
              What's Happening ({activityLogs.length})
            </button>

            <button
              onClick={() => setActiveTab("logins")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "logins"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Who's Logging In ({loginLogs.length})
            </button>

            <button
              onClick={() => setActiveTab("stores")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "stores"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Store className="w-4 h-4" />
              Shopkeepers Directory ({shopkeepers.length})
            </button>

            <button
              onClick={() => setActiveTab("bills")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "bills"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Invoices Feed ({recentBills.length})
            </button>

            <button
              onClick={() => setActiveTab("system")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "system"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Server className="w-4 h-4" />
              System Status
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, store, IP, invoice..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: WHAT'S HAPPENING (LIVE ACTIVITY STREAM)           */}
        {/* ======================================================== */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            {/* Filter pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filter events:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "ALL", label: "All Events" },
                  { id: "BILL", label: "Bills & Invoices" },
                  { id: "LOGIN", label: "Logins" },
                  { id: "REGISTER", label: "Registrations" },
                  { id: "PRODUCT", label: "Products" },
                  { id: "PROFILE", label: "Profile Updates" },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    onClick={() => setActivityFilter(pill.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      activityFilter === pill.id
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                        : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Activities List */}
            {filteredActivities.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <Activity className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                <p className="text-sm font-medium">No matching activities found</p>
                <p className="text-xs text-slate-500 mt-1">Actions taken by shopkeepers will appear here in real-time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivities.map((act) => {
                  let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                  let IconComponent = Activity;

                  if (act.action_type === "LOGIN") {
                    badgeColor = "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
                    IconComponent = LogIn;
                  } else if (act.action_type === "BILL_CREATED") {
                    badgeColor = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
                    IconComponent = Receipt;
                  } else if (act.action_type === "REGISTER") {
                    badgeColor = "bg-purple-500/10 text-purple-300 border-purple-500/30";
                    IconComponent = UserPlus;
                  } else if (act.action_type === "PRODUCT_ADDED") {
                    badgeColor = "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
                    IconComponent = Package;
                  } else if (act.action_type === "PROFILE_UPDATED") {
                    badgeColor = "bg-amber-500/10 text-amber-300 border-amber-500/30";
                    IconComponent = Store;
                  }

                  return (
                    <div
                      key={act.id}
                      className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition-all flex items-start gap-4"
                    >
                      <div className={`p-2.5 rounded-xl border ${badgeColor} shrink-0 mt-0.5`}>
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white">{act.title}</span>
                            {act.store_name && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                🏬 {act.store_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="text-indigo-400 font-medium">{timeAgo(act.created_at)}</span>
                            <span>•</span>
                            <span>{formatDateTime(act.created_at)}</span>
                          </div>
                        </div>

                        {act.description && (
                          <p className="text-xs text-slate-300 mt-1">{act.description}</p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          {act.ip_address && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Globe className="w-3 h-3 text-slate-400" />
                              IP: {act.ip_address}
                            </span>
                          )}
                          <span className="uppercase tracking-wider font-semibold text-[10px] text-slate-400">
                            {act.action_type}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: WHO'S LOGGING IN (LOGIN AUDIT LOGS)                */}
        {/* ======================================================== */}
        {activeTab === "logins" && (
          <div className="space-y-4">
            {/* Status Filter buttons */}
            <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filter Logins:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLoginFilter("ALL")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    loginFilter === "ALL"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  All ({loginLogs.length})
                </button>
                <button
                  onClick={() => setLoginFilter("SUCCESS")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    loginFilter === "SUCCESS"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  ✓ Successful ({loginLogs.filter((l) => l.status === "SUCCESS").length})
                </button>
                <button
                  onClick={() => setLoginFilter("FAILED")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    loginFilter === "FAILED"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  ✕ Failed Attempts ({loginLogs.filter((l) => l.status === "FAILED").length})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">User / Email</th>
                      <th className="py-3.5 px-4">Store Name</th>
                      <th className="py-3.5 px-4">IP Address</th>
                      <th className="py-3.5 px-4">Device / Browser</th>
                      <th className="py-3.5 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLogins.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500">
                          No login records match your current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredLogins.map((log) => {
                        const isSuccess = log.status === "SUCCESS";
                        return (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              {isSuccess ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  SUCCESS
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <XCircle className="w-3 h-3" />
                                  FAILED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium text-white">
                              <div>{log.email}</div>
                              {log.failure_reason && (
                                <div className="text-[10px] text-rose-400">{log.failure_reason}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {log.store_name || "—"}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                              {log.ip_address || "127.0.0.1"}
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[200px] truncate" title={log.user_agent}>
                              {log.user_agent ? (
                                log.user_agent.includes("Mobile") ? (
                                  <span className="flex items-center gap-1">
                                    <Smartphone className="w-3 h-3 text-indigo-400 shrink-0" />
                                    Mobile Device
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Laptop className="w-3 h-3 text-cyan-400 shrink-0" />
                                    Desktop Browser
                                  </span>
                                )
                              ) : (
                                "Desktop"
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                              <div>{formatDateTime(log.created_at)}</div>
                              <div className="text-[10px] text-slate-500">{timeAgo(log.created_at)}</div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: REGISTERED SHOPKEEPERS DIRECTORY                   */}
        {/* ======================================================== */}
        {activeTab === "stores" && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Store Name</th>
                    <th className="py-3.5 px-4">Shopkeeper</th>
                    <th className="py-3.5 px-4">Email & Phone</th>
                    <th className="py-3.5 px-4">Last Active</th>
                    <th className="py-3.5 px-4">Invoices Issued</th>
                    <th className="py-3.5 px-4">Total Revenue</th>
                    <th className="py-3.5 px-4">Catalog / Customers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        No registered shopkeepers found.
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((sk) => (
                      <tr key={sk.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <Store className="w-4 h-4 text-indigo-400" />
                            {sk.store_name}
                          </div>
                          <div className="text-[10px] text-slate-500">Store ID #{sk.id}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-200 font-medium">
                          {sk.name}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>{sk.email}</div>
                          <div className="text-[10px] text-slate-400">{sk.phone}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <Clock className="w-3 h-3" />
                            {sk.last_login}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          {sk.total_bills} bills
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400 text-sm">
                          {sk.total_revenue}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {sk.total_products} items • {sk.total_customers} clients
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CROSS-STORE INVOICES FEED                          */}
        {/* ======================================================== */}
        {activeTab === "bills" && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Store</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Date / Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        No invoices generated yet.
                      </td>
                    </tr>
                  ) : (
                    filteredBills.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-300">
                          {b.invoice}
                        </td>
                        <td className="py-3 px-4 font-medium text-white flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          {b.store_name}
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          {b.customer}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-400 text-sm">
                          {b.amount.startsWith("₹") ? b.amount : `₹${b.amount}`}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {b.status || "Paid"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {b.created_at || b.time}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: SYSTEM HEALTH & INFRASTRUCTURE                     */}
        {/* ======================================================== */}
        {activeTab === "system" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-400" />
                Infrastructure Diagnostics
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Database Engine</div>
                      <div className="text-[11px] text-slate-400">{systemStatus?.database || "MySQL Connected"}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ONLINE
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Quantum Circuit Engine</div>
                      <div className="text-[11px] text-slate-400">{systemStatus?.quantum_engine || "Qiskit Sampler Active"}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    OPERATIONAL
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Gemini AI Models</div>
                      <div className="text-[11px] text-slate-400">{systemStatus?.ai_gemini || "Gemini Flash Ready"}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    READY
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">REST API Service</div>
                      <div className="text-[11px] text-slate-400">{systemStatus?.api || "Django REST Framework 4.2"}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    200 OK
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Security & Access Audit
              </h3>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Admin Route Endpoint:</span>
                  <code className="text-indigo-300 font-mono">/admin12</code>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Admin API Endpoint:</span>
                  <code className="text-indigo-300 font-mono">/api/admin-overview/</code>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Current Admin Role:</span>
                  <span className="text-emerald-400 font-semibold">{adminProfile?.role || "Master Administrator"}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Total Login Events Tracked:</span>
                  <span className="text-white font-mono">{stats?.total_login_attempts ?? 0}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Total Activities Logged:</span>
                  <span className="text-white font-mono">{activityLogs.length}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                💡 <strong>Admin Tip:</strong> Every merchant login, failed password attempt, invoice creation, product addition, and customer registration is audited and recorded in real time.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

