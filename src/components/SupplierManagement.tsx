"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, X, Package, Mail, Phone, MapPin, Calendar, DollarSign } from "lucide-react"

interface Supplier {
  id: number
  name: string
  contactPerson: string
  email: string
  phone: string
  address: string
  productsSupplied: string[]
  paymentTerms: string
  leadTime: number // days
  minOrderQuantity: number
  rating: number
  notes: string
  createdAt: string
}

interface PurchaseOrder {
  id: number
  supplierId: number
  supplierName: string
  orderDate: string
  expectedDelivery: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  items: {
    productName: string
    quantity: number
    unitPrice: number
  }[]
  totalAmount: number
  notes: string
}

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [activeTab, setActiveTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null)

  // Form states
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    productsSupplied: '',
    paymentTerms: '',
    leadTime: 7,
    minOrderQuantity: 1,
    rating: 5,
    notes: '',
  })

  const [orderForm, setOrderForm] = useState({
    supplierId: 0,
    expectedDelivery: '',
    items: [{ productName: '', quantity: 1, unitPrice: 0 }],
    notes: '',
  })

  useEffect(() => {
    loadSuppliers()
    loadPurchaseOrders()
  }, [])

  const loadSuppliers = () => {
    const saved = localStorage.getItem('suppliers')
    if (saved) {
      setSuppliers(JSON.parse(saved))
    }
  }

  const loadPurchaseOrders = () => {
    const saved = localStorage.getItem('purchaseOrders')
    if (saved) {
      setPurchaseOrders(JSON.parse(saved))
    }
  }

  const saveSupplier = () => {
    if (!supplierForm.name || !supplierForm.email) {
      alert('Please fill in required fields (Name, Email)')
      return
    }

    const newSupplier: Supplier = {
      id: editingSupplier?.id || Date.now(),
      ...supplierForm,
      productsSupplied: supplierForm.productsSupplied.split(',').map(p => p.trim()).filter(Boolean),
      createdAt: editingSupplier?.createdAt || new Date().toISOString(),
    }

    let updatedSuppliers
    if (editingSupplier) {
      updatedSuppliers = suppliers.map(s => s.id === editingSupplier.id ? newSupplier : s)
    } else {
      updatedSuppliers = [...suppliers, newSupplier]
    }

    setSuppliers(updatedSuppliers)
    localStorage.setItem('suppliers', JSON.stringify(updatedSuppliers))
    resetSupplierForm()
  }

  const deleteSupplier = (id: number) => {
    if (confirm('Delete this supplier?')) {
      const updated = suppliers.filter(s => s.id !== id)
      setSuppliers(updated)
      localStorage.setItem('suppliers', JSON.stringify(updated))
    }
  }

  const savePurchaseOrder = () => {
    if (orderForm.supplierId === 0 || orderForm.items.length === 0) {
      alert('Please select a supplier and add items')
      return
    }

    const supplier = suppliers.find(s => s.id === orderForm.supplierId)
    if (!supplier) return

    const totalAmount = orderForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

    const newOrder: PurchaseOrder = {
      id: editingOrder?.id || Date.now(),
      supplierId: orderForm.supplierId,
      supplierName: supplier.name,
      orderDate: editingOrder?.orderDate || new Date().toISOString(),
      expectedDelivery: orderForm.expectedDelivery,
      status: editingOrder?.status || 'pending',
      items: orderForm.items.filter(item => item.productName && item.quantity > 0),
      totalAmount,
      notes: orderForm.notes,
    }

    let updatedOrders
    if (editingOrder) {
      updatedOrders = purchaseOrders.map(o => o.id === editingOrder.id ? newOrder : o)
    } else {
      updatedOrders = [...purchaseOrders, newOrder]
    }

    setPurchaseOrders(updatedOrders)
    localStorage.setItem('purchaseOrders', JSON.stringify(updatedOrders))
    resetOrderForm()
  }

  const updateOrderStatus = (orderId: number, status: PurchaseOrder['status']) => {
    const updated = purchaseOrders.map(o => o.id === orderId ? { ...o, status } : o)
    setPurchaseOrders(updated)
    localStorage.setItem('purchaseOrders', JSON.stringify(updated))
  }

  const deleteOrder = (id: number) => {
    if (confirm('Delete this purchase order?')) {
      const updated = purchaseOrders.filter(o => o.id !== id)
      setPurchaseOrders(updated)
      localStorage.setItem('purchaseOrders', JSON.stringify(updated))
    }
  }

  const resetSupplierForm = () => {
    setSupplierForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      productsSupplied: '',
      paymentTerms: '',
      leadTime: 7,
      minOrderQuantity: 1,
      rating: 5,
      notes: '',
    })
    setEditingSupplier(null)
    setShowSupplierForm(false)
  }

  const resetOrderForm = () => {
    setOrderForm({
      supplierId: 0,
      expectedDelivery: '',
      items: [{ productName: '', quantity: 1, unitPrice: 0 }],
      notes: '',
    })
    setEditingOrder(null)
    setShowOrderForm(false)
  }

  const editSupplier = (supplier: Supplier) => {
    setSupplierForm({
      ...supplier,
      productsSupplied: supplier.productsSupplied.join(', '),
    })
    setEditingSupplier(supplier)
    setShowSupplierForm(true)
  }

  const editOrder = (order: PurchaseOrder) => {
    setOrderForm({
      supplierId: order.supplierId,
      expectedDelivery: order.expectedDelivery,
      items: order.items,
      notes: order.notes,
    })
    setEditingOrder(order)
    setShowOrderForm(true)
  }

  const addOrderItem = () => {
    setOrderForm(prev => ({
      ...prev,
      items: [...prev.items, { productName: '', quantity: 1, unitPrice: 0 }],
    }))
  }

  const removeOrderItem = (index: number) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const updateOrderItem = (index: number, field: keyof typeof orderForm.items[0], value: any) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg border">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Supplier Management</h2>
        <p className="text-neutral-600">Manage suppliers and purchase orders</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'suppliers'
              ? 'border-b-2 border-black text-black'
              : 'text-neutral-500 hover:text-black'
          }`}
        >
          Suppliers ({suppliers.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'orders'
              ? 'border-b-2 border-black text-black'
              : 'text-neutral-500 hover:text-black'
          }`}
        >
          Purchase Orders ({purchaseOrders.length})
        </button>
      </div>

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowSupplierForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" />
              ADD SUPPLIER
            </button>
          </div>

          {suppliers.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No suppliers added yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {suppliers.map(supplier => (
                <div key={supplier.id} className="p-4 border rounded-lg hover:border-neutral-400 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{supplier.name}</h3>
                      <p className="text-sm text-neutral-600">{supplier.contactPerson}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => editSupplier(supplier)}
                        className="p-2 hover:bg-neutral-100 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteSupplier(supplier.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-neutral-400" />
                      {supplier.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-neutral-400" />
                      {supplier.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-neutral-400" />
                      {supplier.address}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-neutral-400" />
                      Lead Time: {supplier.leadTime} days
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {supplier.productsSupplied.map((product, i) => (
                      <span key={i} className="px-2 py-1 bg-neutral-100 text-xs rounded">
                        {product}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-between items-center text-sm text-neutral-600">
                    <span>MOQ: {supplier.minOrderQuantity} units</span>
                    <span>Rating: {'⭐'.repeat(supplier.rating)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Purchase Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowOrderForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
              disabled={suppliers.length === 0}
            >
              <Plus className="h-4 w-4" />
              CREATE ORDER
            </button>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No purchase orders created yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseOrders.map(order => (
                <div key={order.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold">PO-{order.id}</h3>
                      <p className="text-sm text-neutral-600">{order.supplierName}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => editOrder(order)}
                        className="p-2 hover:bg-neutral-100 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteOrder(order.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-3 space-y-2">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.productName}</span>
                        <span>{item.quantity} × ₹{item.unitPrice} = ₹{item.quantity * item.unitPrice}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-sm text-neutral-600">
                      <span>Order: {new Date(order.orderDate).toLocaleDateString()}</span>
                      <span className="mx-2">•</span>
                      <span>Expected: {new Date(order.expectedDelivery).toLocaleDateString()}</span>
                    </div>
                    <div className="font-bold">₹{order.totalAmount}</div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateOrderStatus(order.id, 'confirmed')}
                      className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'shipped')}
                      className="px-3 py-1 text-xs bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                    >
                      Ship
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200"
                    >
                      Deliver
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Supplier Form Modal */}
      {showSupplierForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={resetSupplierForm} className="p-2 hover:bg-neutral-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Products Supplied (comma-separated)</label>
                <input
                  type="text"
                  value={supplierForm.productsSupplied}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, productsSupplied: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Silk Sarees, Cotton Fabrics, Embroidery"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Lead Time (days)</label>
                  <input
                    type="number"
                    value={supplierForm.leadTime}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, leadTime: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min Order Qty</label>
                  <input
                    type="number"
                    value={supplierForm.minOrderQuantity}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, minOrderQuantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rating</label>
                  <select
                    value={supplierForm.rating}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded"
                  >
                    {[1,2,3,4,5].map(r => (
                      <option key={r} value={r}>{'⭐'.repeat(r)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={supplierForm.paymentTerms}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Net 30, 50% advance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveSupplier}
                  className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
                >
                  {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                </button>
                <button
                  onClick={resetSupplierForm}
                  className="px-4 py-2 border rounded hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Form Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingOrder ? 'Edit Purchase Order' : 'Create Purchase Order'}
              </h3>
              <button onClick={resetOrderForm} className="p-2 hover:bg-neutral-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier *</label>
                  <select
                    value={orderForm.supplierId}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, supplierId: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value={0}>Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Delivery *</label>
                  <input
                    type="date"
                    value={orderForm.expectedDelivery}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Order Items</label>
                <div className="space-y-2">
                  {orderForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateOrderItem(index, 'productName', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded"
                        placeholder="Product name"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                        className="w-24 px-3 py-2 border rounded"
                        placeholder="Qty"
                        min="1"
                      />
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateOrderItem(index, 'unitPrice', Number(e.target.value))}
                        className="w-32 px-3 py-2 border rounded"
                        placeholder="Unit Price"
                        min="0"
                      />
                      <button
                        onClick={() => removeOrderItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        disabled={orderForm.items.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addOrderItem}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Item
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={savePurchaseOrder}
                  className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
                >
                  {editingOrder ? 'Update Order' : 'Create Order'}
                </button>
                <button
                  onClick={resetOrderForm}
                  className="px-4 py-2 border rounded hover:bg-neutral-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
