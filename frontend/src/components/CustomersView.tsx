import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Edit2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { API_BASE_URL } from '../apiConfig';

const avatarStyles: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

export default function CustomersView() {
  const { shopkeeper } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    initials: '',
    tone: 'violet'
  });

  const fetchCustomers = () => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/customers/`, {
      params: { shopkeeper_email: shopkeeper?.email }
    })
      .then(res => {
        setCustomers(res.data);
        setLoading(false);
      })
      .catch(err => {
        toast.error('Failed to load customers');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCustomers();
  }, [shopkeeper?.email]);

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        initials: customer.initials,
        tone: customer.tone
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        initials: '',
        tone: 'violet'
      });
    }
    setShowModal(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const tones = ['violet', 'blue', 'amber', 'green', 'rose'];
    const tone = tones[name.length % tones.length];
    
    setFormData({
      ...formData,
      name,
      initials: editingCustomer ? formData.initials : initials,
      tone: editingCustomer ? formData.tone : tone
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCustomer 
      ? `${API_BASE_URL}/api/customers/${editingCustomer.id}/`
      : `${API_BASE_URL}/api/customers/`;
    
    const method = editingCustomer ? 'put' : 'post';

    axios[method](url, { ...formData, shopkeeper_email: shopkeeper?.email })
      .then(() => {
        toast.success(editingCustomer ? 'Customer updated' : 'Customer added');
        setShowModal(false);
        fetchCustomers();
      })
      .catch(() => toast.error('Failed to save customer'));
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      axios.delete(`${API_BASE_URL}/api/customers/${id}/`)
        .then(() => {
          toast.success('Customer deleted');
          fetchCustomers();
        })
        .catch(() => toast.error('Failed to delete customer'));
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 sm:px-6 lg:px-10 lg:pt-9">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.04em] text-slate-950 sm:text-[34px]">Customers</h1>
          <p className="mt-2 text-sm text-slate-500">Manage your customer relationships.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3 font-bold sm:px-6">Customer</th>
                <th className="px-3 py-3 font-bold">Phone Number</th>
                <th className="px-5 py-3 text-right font-bold sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-slate-500">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-slate-500">No customers found. Add one above!</td></tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-50 last:border-0 transition hover:bg-slate-50/70">
                    <td className="px-5 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${avatarStyles[customer.tone] || avatarStyles['violet']}`}>
                          {customer.initials}
                        </div>
                        <span className="text-sm font-bold text-slate-800">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm font-semibold text-slate-600">{customer.phone}</td>
                    <td className="px-5 py-4 text-right sm:px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenModal(customer)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(customer.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-slate-900">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <input required value={formData.name} onChange={handleNameChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
                  <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700">{editingCustomer ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
