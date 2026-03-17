import { ChevronLeft, MapPin, Plus, Edit, Trash2, Star, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Address {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
}

interface AddressBookPageProps {
  onNavigateBack: () => void;
}

export function AddressBookPage({ onNavigateBack }: AddressBookPageProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState<Omit<Address, 'id' | 'isDefault'>>({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pinCode: '',
  });

  const STORAGE_KEY = user?.id ? `savedAddresses_${user.id}` : 'savedAddresses_guest';

  useEffect(() => {
    loadAddresses();
  }, [user]);

  const loadAddresses = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setAddresses(JSON.parse(saved));
    }
  };

  const saveAddresses = (newAddresses: Address[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAddresses));
    setAddresses(newAddresses);
  };

  const handleAddAddress = () => {
    const newAddress: Address = {
      ...formData,
      id: Date.now().toString(),
      isDefault: addresses.length === 0, // First address is default
    };
    saveAddresses([...addresses, newAddress]);
    setShowAddModal(false);
    resetForm();
  };

  const handleUpdateAddress = () => {
    if (!editingAddress) return;
    const updated = addresses.map(addr => 
      addr.id === editingAddress.id 
        ? { ...formData, id: addr.id, isDefault: addr.isDefault }
        : addr
    );
    saveAddresses(updated);
    setEditingAddress(null);
    resetForm();
  };

  const handleDeleteAddress = (id: string) => {
    if (confirm('Are you sure you want to delete this address?')) {
      const filtered = addresses.filter(addr => addr.id !== id);
      // If deleted address was default, make first address default
      if (filtered.length > 0) {
        const deletedWasDefault = addresses.find(a => a.id === id)?.isDefault;
        if (deletedWasDefault) {
          filtered[0].isDefault = true;
        }
      }
      saveAddresses(filtered);
    }
  };

  const handleSetDefault = (id: string) => {
    const updated = addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id,
    }));
    saveAddresses(updated);
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      pinCode: '',
    });
  };

  const openAddModal = () => {
    resetForm();
    setEditingAddress(null);
    setShowAddModal(true);
  };

  const openEditModal = (address: Address) => {
    setFormData({
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
    });
    setEditingAddress(address);
    setShowAddModal(true);
  };

  const validateForm = () => {
    return formData.fullName && formData.phone && formData.addressLine1 && 
           formData.city && formData.state && formData.pinCode;
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <button 
            onClick={onNavigateBack}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO ACCOUNT</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-5xl tracking-wider mb-2">ADDRESS BOOK</h1>
              <p className="text-neutral-600">Manage your saved delivery addresses</p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-black text-white rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">ADD ADDRESS</span>
              <span className="md:hidden">ADD</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {addresses.length === 0 ? (
          <div className="text-center py-16 md:py-20">
            <MapPin className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h2 className="text-2xl tracking-wider mb-2">NO SAVED ADDRESSES</h2>
            <p className="text-neutral-600 mb-6">
              Add your first address to make checkout faster.
            </p>
            <button
              onClick={openAddModal}
              className="bg-black text-white px-6 md:px-8 py-2 md:py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              ADD YOUR FIRST ADDRESS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`relative p-4 md:p-6 border-2 rounded-lg transition-all ${
                  address.isDefault 
                    ? 'border-black shadow-md' 
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                {/* Default Badge */}
                {address.isDefault && (
                  <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-1 px-2 py-1 bg-black text-white text-xs rounded-full">
                    <Star className="w-3 h-3 fill-white" />
                    <span>DEFAULT</span>
                  </div>
                )}

                {/* Address Content */}
                <div className="mb-4">
                  <h3 className="text-lg md:text-xl tracking-wider mb-2">{address.fullName}</h3>
                  <p className="text-sm text-neutral-600 mb-1">{address.phone}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    {address.addressLine1}
                    {address.addressLine2 && <>, {address.addressLine2}</>}
                    <br />
                    {address.city}, {address.state} - {address.pinCode}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openEditModal(address)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-neutral-300 rounded-full text-xs tracking-wider hover:bg-neutral-50 transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    <span>EDIT</span>
                  </button>
                  <button
                    onClick={() => handleDeleteAddress(address.id)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-full text-xs tracking-wider hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>DELETE</span>
                  </button>
                  {!address.isDefault && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-neutral-300 rounded-full text-xs tracking-wider hover:bg-neutral-50 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      <span>SET DEFAULT</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Address Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
            <div className="sticky top-0 bg-white border-b border-neutral-300 p-4 md:p-6">
              <h2 className="text-xl md:text-2xl tracking-wider">
                {editingAddress ? 'EDIT ADDRESS' : 'ADD NEW ADDRESS'}
              </h2>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (validateForm()) {
                  editingAddress ? handleUpdateAddress() : handleAddAddress();
                }
              }}
              className="p-4 md:p-6 space-y-4"
            >
              {/* Full Name */}
              <div>
                <label className="block text-sm tracking-wider mb-2">FULL NAME *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm tracking-wider mb-2">PHONE NUMBER *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  required
                />
              </div>

              {/* Address Line 1 */}
              <div>
                <label className="block text-sm tracking-wider mb-2">ADDRESS LINE 1 *</label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="House No., Building Name"
                  required
                />
              </div>

              {/* Address Line 2 */}
              <div>
                <label className="block text-sm tracking-wider mb-2">ADDRESS LINE 2 (Optional)</label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                  placeholder="Road Name, Area, Colony"
                />
              </div>

              {/* City, State, PIN Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm tracking-wider mb-2">CITY *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                    placeholder="Mumbai"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm tracking-wider mb-2">STATE *</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                    placeholder="Maharashtra"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm tracking-wider mb-2">PIN CODE *</label>
                  <input
                    type="text"
                    value={formData.pinCode}
                    onChange={(e) => setFormData({ ...formData, pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:border-black"
                    placeholder="400001"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={!validateForm()}
                  className={`flex-1 py-3 rounded-full text-sm tracking-wider transition-colors ${
                    validateForm()
                      ? 'bg-black text-white hover:bg-neutral-800'
                      : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  {editingAddress ? 'UPDATE ADDRESS' : 'SAVE ADDRESS'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingAddress(null);
                    resetForm();
                  }}
                  className="px-6 py-3 border border-neutral-300 rounded-full text-sm tracking-wider hover:bg-neutral-50 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
