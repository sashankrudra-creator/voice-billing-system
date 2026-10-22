import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FileText, Plus, X, Eye, Search, Filter, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../App';

const avatarStyles: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

export default function BillsView() {
  const { shopkeeper } = useAuth();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [selectedBill, setSelectedBill] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    invoice: '',
    customer: '',
    amount: '',
    time: '',
    status: 'Paid',
    initials: '',
    tone: 'blue'
  });

  const fetchBills = () => {
    setLoading(true);
    axios.get('http://127.0.0.1:8000/api/bills/', {
      params: { shopkeeper_email: shopkeeper?.email }
    })
      .then(res => {
        setBills(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load bills', err);
        toast.error('Failed to load bills');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBills();
  }, [shopkeeper?.email]);

  const handleOpenModal = () => {
    const now = new Date();
    const timeStr = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).format(now);
    const invoiceNum = `#QV-${Math.floor(1000 + Math.random() * 9000)}`;

    setFormData({
      invoice: invoiceNum,
      customer: '',
      amount: '₹0',
      time: timeStr,
      status: 'Paid',
      initials: '',
      tone: 'blue'
    });
    setShowModal(true);
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const customer = e.target.value;
    const initials = customer.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SK';
    const tones = ['violet', 'blue', 'amber', 'green', 'rose'];
    const tone = tones[customer.length % tones.length];
    
    setFormData({
      ...formData,
      customer,
      initials,
      tone
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    axios.post('http://127.0.0.1:8000/api/bills/', { ...formData, shopkeeper_email: shopkeeper?.email })
      .then(() => {
        toast.success('Bill generated successfully');
        setShowModal(false);
        fetchBills();
      })
      .catch(() => toast.error('Failed to generate bill'));
  };

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = 
        bill.invoice?.toLowerCase().includes(search.toLowerCase()) ||
        bill.customer?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || bill.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bills, search, statusFilter]);

  const totalRevenue = useMemo(() => {
    return bills.reduce((sum, b) => {
      const clean = String(b.amount || '0').replace('₹', '').replace(/,/g, '').trim();
      const num = parseFloat(clean) || 0;
      return sum + num;
    }, 0);
  }, [bills]);

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 sm:px-6 lg:px-10 lg:pt-9">
      {/* Header */}
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600">
            <FileText className="h-3.5 w-3.5" /> Billing History & Invoices
          </div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.04em] text-slate-950 sm:text-[34px]">
            Bill History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View, track, and manage all your past customer bills and transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" /> New Bill
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Invoices</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{bills.length}</p>
          <p className="mt-0.5 text-xs text-slate-500">All registered bills</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">₹{totalRevenue.toLocaleString("en-IN")}</p>
          <p className="mt-0.5 text-xs text-slate-500">Accumulated from invoices</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paid Rate</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">
            {bills.length > 0
              ? `${Math.round((bills.filter(b => b.status === 'Paid').length / bills.length) * 100)}%`
              : '0%'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Successfully settled</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number or customer..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          {(['All', 'Paid', 'Pending'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                statusFilter === status
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3 font-bold sm:px-6">Invoice</th>
                <th className="px-3 py-3 font-bold">Customer</th>
                <th className="px-3 py-3 font-bold">Amount</th>
                <th className="px-3 py-3 font-bold">Time</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    Loading bill history...
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    {search || statusFilter !== 'All' ? 'No matching bills found.' : 'No invoices generated yet.'}
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id || bill.invoice}
                    className="border-b border-slate-50 last:border-0 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3.5 text-sm font-bold text-slate-800 sm:px-6">
                      {bill.invoice}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-bold ${
                            avatarStyles[bill.tone] || avatarStyles['blue']
                          }`}
                        >
                          {bill.initials || 'SK'}
                        </div>
                        <span className="whitespace-nowrap text-sm font-semibold text-slate-700">
                          {bill.customer || 'Walk-in Customer'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-sm font-bold text-slate-900">{bill.amount}</td>
                    <td className="px-3 py-3.5 text-xs font-medium text-slate-500">{bill.time}</td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold ${
                          bill.status === "Paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : bill.status === "Pending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            bill.status === "Paid"
                              ? "bg-emerald-500"
                              : bill.status === "Pending"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                        />
                        {bill.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right sm:px-6">
                      <button
                        onClick={() => setSelectedBill(bill)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
                        title="View bill details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Details Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Invoice Details
                </h3>
                <p className="text-xs text-slate-400">{selectedBill.invoice}</p>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-500">Customer</span>
                <span className="text-sm font-bold text-slate-800">{selectedBill.customer}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-500">Total Amount</span>
                <span className="text-base font-extrabold text-slate-950">{selectedBill.amount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-500">Time / Date</span>
                <span className="text-xs font-semibold text-slate-700">{selectedBill.time}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-500">Payment Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                    selectedBill.status === 'Paid'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {selectedBill.status}
                </span>
              </div>
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setSelectedBill(null)}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Bill Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-slate-900">Generate Manual Bill</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Invoice Number</label>
                    <input
                      disabled
                      value={formData.invoice}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Customer Name</label>
                  <input
                    required
                    value={formData.customer}
                    onChange={handleCustomerChange}
                    placeholder="Enter customer name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Total Amount</label>
                  <input
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g., ₹1,200"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
