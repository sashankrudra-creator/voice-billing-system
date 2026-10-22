import { useState } from "react";
import { useAuth } from "../App";
import { toast } from "sonner";
import axios from "axios";
import { User, Store, Mail, Phone, Lock, Save, Shield, Bell, Palette } from "lucide-react";

export default function SettingsView() {
  const { shopkeeper, login } = useAuth();
  
  const [formData, setFormData] = useState({
    name: shopkeeper?.name || "",
    email: shopkeeper?.email || "",
    storeName: shopkeeper?.store_name || "",
    phone: shopkeeper?.phone || "",
    password: "",
  });

  const [activeTab, setActiveTab] = useState("profile");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      const payload = {
        current_email: shopkeeper?.email || formData.email,
        ...formData
      };
      
      const res = await axios.post("http://127.0.0.1:8000/api/update-profile/", payload);
      
      if (res.data.success) {
        // Update the auth context with the new shopkeeper details
        login(res.data.shopkeeper);
        
        toast.success("Settings saved successfully!", {
          description: "Your changes have been applied to your account.",
        });
        
        // Clear password after save
        setFormData(prev => ({ ...prev, password: "" }));
      }
    } catch (err: any) {
      toast.error("Failed to save settings", {
        description: err.response?.data?.error || "An unknown error occurred.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight text-slate-950 sm:text-[34px]">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your account, store details, and preferences.</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700">
          <Save className="h-4 w-4" /> Save Changes
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <div className="flex flex-col gap-2">
          <button onClick={() => setActiveTab("profile")} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === "profile" ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <User className="h-4 w-4" /> Profile Details
          </button>
          <button onClick={() => setActiveTab("store")} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === "store" ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Store className="h-4 w-4" /> Store Settings
          </button>
          <button onClick={() => setActiveTab("security")} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === "security" ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Shield className="h-4 w-4" /> Security
          </button>
          <button onClick={() => setActiveTab("preferences")} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${activeTab === "preferences" ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Palette className="h-4 w-4" /> Preferences
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/40 sm:p-8">
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
                <p className="mt-1 text-sm text-slate-500">Update your personal details and contact info.</p>
              </div>
              
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="name" value={formData.name} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" placeholder="John Doe" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="email" value={formData.email} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" placeholder="john@example.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="phone" value={formData.phone} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" placeholder="+91 9876543210" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "store" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-lg font-bold text-slate-900">Store Settings</h2>
                <p className="mt-1 text-sm text-slate-500">Update the name and details of your business.</p>
              </div>
              
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Store Name</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input name="storeName" value={formData.storeName} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" placeholder="My Awesome Store" />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Store Address (Optional)</label>
                  <textarea name="address" value={formData.address || ''} onChange={handleChange} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" placeholder="Enter store address..." rows={3}></textarea>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-lg font-bold text-slate-900">Security</h2>
                <p className="mt-1 text-sm text-slate-500">Update your password to keep your account secure.</p>
              </div>
              
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70" placeholder="••••••••" />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <button onClick={handleSave} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b border-slate-100 pb-5">
                <h2 className="text-lg font-bold text-slate-900">App Preferences</h2>
                <p className="mt-1 text-sm text-slate-500">Customize how the dashboard looks and behaves.</p>
              </div>
              
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Email Notifications</p>
                      <p className="text-xs text-slate-500">Receive daily summary reports</p>
                    </div>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" defaultChecked />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:border-gray-600 dark:bg-gray-700"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
