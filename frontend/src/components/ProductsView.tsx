import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Edit2, Trash2, X, Camera, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../App';

export default function ProductsView() {
  const { shopkeeper } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    sold: '0',
    value: '₹0',
    width: '0%',
    color: 'bg-violet-500',
    barcode: ''
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProducts = () => {
    setLoading(true);
    axios.get('http://127.0.0.1:8000/api/products/', {
      params: { shopkeeper_email: shopkeeper?.email }
    })
      .then(res => {
        setProducts(res.data);
        setLoading(false);
      })
      .catch(err => {
        toast.error('Failed to load products');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, [shopkeeper?.email]);

  const handleOpenModal = (product: any = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sold: product.sold,
        value: product.value,
        width: product.width,
        color: product.color,
        barcode: product.barcode || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sold: '0',
        value: '₹0',
        width: '0%',
        color: 'bg-slate-500',
        barcode: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProduct
      ? `http://127.0.0.1:8000/api/products/${editingProduct.id}/`
      : 'http://127.0.0.1:8000/api/products/';

    const method = editingProduct ? 'put' : 'post';

    axios[method](url, { ...formData, shopkeeper_email: shopkeeper?.email })
      .then(() => {
        toast.success(editingProduct ? 'Product updated' : 'Product added');
        setShowModal(false);
        fetchProducts();
      })
      .catch((err) => toast.error(err.response?.data?.barcode?.[0] || 'Failed to save product'));
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    img.onload = async () => {
      try {
        // @ts-ignore
        const barcodeDetector = new BarcodeDetector();
        const barcodes = await barcodeDetector.detect(img);

        if (barcodes.length > 0) {
          setFormData(prev => ({ ...prev, barcode: barcodes[0].rawValue }));
          toast.success("Barcode scanned successfully!");
        } else {
          toast.error("No barcode detected in the image.");
        }
      } catch (err) {
        toast.error("Barcode scanning failed or is not supported by your browser.");
      }
      URL.revokeObjectURL(url);
    };
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      axios.delete(`http://127.0.0.1:8000/api/products/${id}/`)
        .then(() => {
          toast.success('Product deleted');
          fetchProducts();
        })
        .catch(() => toast.error('Failed to delete product'));
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 sm:px-6 lg:px-10 lg:pt-9">
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.04em] text-slate-950 sm:text-[34px]">Products</h1>
          <p className="mt-2 text-sm text-slate-500">Manage your store's inventory and items.</p>
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                <th className="px-5 py-3 font-bold sm:px-6">Product Name</th>
                <th className="px-3 py-3 font-bold">Value</th>
                <th className="px-3 py-3 font-bold">Sold</th>
                <th className="px-3 py-3 font-bold">Popularity</th>
                <th className="px-5 py-3 text-right font-bold sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-500">No products found. Add one above!</td></tr>
              ) : (
                (() => {
                  const parseSold = (s: string) => {
                    const str = String(s || '0').toLowerCase().replace('sold', '').replace(/,/g, '').trim();
                    if (str.endsWith('k')) return parseFloat(str) * 1000;
                    return parseInt(str) || 0;
                  };
                  const maxSold = Math.max(1, ...products.map(p => parseSold(p.sold)));

                  return products.map((product) => {
                    const soldNum = parseSold(product.sold);
                    const percent = Math.min(100, Math.max(0, (soldNum / maxSold) * 100));

                    let dynamicColor = 'bg-slate-300';
                    if (percent > 80) dynamicColor = 'bg-violet-500';
                    else if (percent > 50) dynamicColor = 'bg-blue-500';
                    else if (percent > 20) dynamicColor = 'bg-emerald-500';
                    else if (percent > 0) dynamicColor = 'bg-amber-500';

                    return (
                      <tr key={product.id} className="border-b border-slate-50 last:border-0 transition hover:bg-slate-50/70">
                        <td className="px-5 py-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                              <Package className="h-5 w-5" />
                            </div>
                            <span className="text-sm font-bold text-slate-800">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm font-bold text-slate-900">{product.value}</td>
                        <td className="px-3 py-4 text-xs font-semibold text-slate-600">{product.sold}</td>
                        <td className="px-3 py-4">
                          <div className="w-32 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${dynamicColor}`} style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right sm:px-6">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenModal(product)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(product.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}

            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-display text-lg font-bold text-slate-900">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Product Name</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">Barcode Number</label>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-800">
                      <Camera className="h-3 w-3" /> Scan Image
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageScan} />
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <ScanLine className="h-4 w-4 text-slate-400" />
                    </div>
                    <input value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} placeholder="Optional" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Value / Price (e.g., ₹1,500)</label>
                  <input required value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100" />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700">{editingProduct ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
