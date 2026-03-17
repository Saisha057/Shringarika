"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, X, TrendingUp, Calendar, Users, ShoppingCart, Clock } from "lucide-react"
import type { Product } from "../data/products"

interface PricingRule {
  id: string
  name: string
  type: 'time-based' | 'quantity-based' | 'user-based' | 'seasonal' | 'clearance'
  enabled: boolean
  priority: number // Higher priority rules apply first
  conditions: {
    // Time-based
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
    daysOfWeek?: number[] // 0 = Sunday, 6 = Saturday
    
    // Quantity-based
    minQuantity?: number
    maxQuantity?: number
    
    // User-based
    userTiers?: ('new' | 'regular' | 'premium' | 'vip')[]
    minPurchaseHistory?: number // minimum previous purchases
    
    // Product-based
    categories?: string[]
    productIds?: number[]
    minPrice?: number
    maxPrice?: number
  }
  discount: {
    type: 'percentage' | 'fixed' | 'buy-x-get-y'
    value: number // percentage or fixed amount
    buyQuantity?: number // for buy-x-get-y
    getQuantity?: number // for buy-x-get-y
    maxDiscount?: number // cap for percentage discounts
  }
  createdAt: string
}

export function DynamicPricingManager() {
  const [rules, setRules] = useState<PricingRule[]>([])
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null)
  const [formData, setFormData] = useState<Partial<PricingRule>>({
    name: '',
    type: 'time-based',
    enabled: true,
    priority: 1,
    conditions: {},
    discount: { type: 'percentage', value: 10 },
  })

  useEffect(() => {
    loadRules()
  }, [])

  const loadRules = () => {
    const saved = localStorage.getItem('pricingRules')
    if (saved) {
      setRules(JSON.parse(saved))
    } else {
      // Load default rules
      const defaultRules: PricingRule[] = [
        {
          id: '1',
          name: 'Happy Hour Sale',
          type: 'time-based',
          enabled: true,
          priority: 5,
          conditions: {
            startTime: '14:00',
            endTime: '17:00',
            daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
          },
          discount: { type: 'percentage', value: 15, maxDiscount: 500 },
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Bulk Purchase Discount',
          type: 'quantity-based',
          enabled: true,
          priority: 3,
          conditions: { minQuantity: 5 },
          discount: { type: 'percentage', value: 10 },
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'VIP Member Discount',
          type: 'user-based',
          enabled: true,
          priority: 4,
          conditions: { userTiers: ['vip'], minPurchaseHistory: 5 },
          discount: { type: 'percentage', value: 20, maxDiscount: 1000 },
          createdAt: new Date().toISOString(),
        },
      ]
      setRules(defaultRules)
      localStorage.setItem('pricingRules', JSON.stringify(defaultRules))
    }
  }

  const saveRule = () => {
    if (!formData.name || !formData.type) {
      alert('Please fill in required fields')
      return
    }

    const newRule: PricingRule = {
      id: editingRule?.id || Date.now().toString(),
      name: formData.name!,
      type: formData.type!,
      enabled: formData.enabled ?? true,
      priority: formData.priority ?? 1,
      conditions: formData.conditions ?? {},
      discount: formData.discount ?? { type: 'percentage', value: 10 },
      createdAt: editingRule?.createdAt || new Date().toISOString(),
    }

    let updatedRules
    if (editingRule) {
      updatedRules = rules.map(r => r.id === editingRule.id ? newRule : r)
    } else {
      updatedRules = [...rules, newRule]
    }

    // Sort by priority (descending)
    updatedRules.sort((a, b) => b.priority - a.priority)

    setRules(updatedRules)
    localStorage.setItem('pricingRules', JSON.stringify(updatedRules))
    resetForm()
  }

  const deleteRule = (id: string) => {
    if (confirm('Delete this pricing rule?')) {
      const updated = rules.filter(r => r.id !== id)
      setRules(updated)
      localStorage.setItem('pricingRules', JSON.stringify(updated))
    }
  }

  const toggleRule = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r)
    setRules(updated)
    localStorage.setItem('pricingRules', JSON.stringify(updated))
  }

  const editRule = (rule: PricingRule) => {
    setFormData(rule)
    setEditingRule(rule)
    setShowRuleForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'time-based',
      enabled: true,
      priority: 1,
      conditions: {},
      discount: { type: 'percentage', value: 10 },
    })
    setEditingRule(null)
    setShowRuleForm(false)
  }

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'time-based': return <Clock className="h-4 w-4" />
      case 'quantity-based': return <ShoppingCart className="h-4 w-4" />
      case 'user-based': return <Users className="h-4 w-4" />
      case 'seasonal': return <Calendar className="h-4 w-4" />
      default: return <TrendingUp className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'time-based': return 'bg-blue-100 text-blue-800'
      case 'quantity-based': return 'bg-green-100 text-green-800'
      case 'user-based': return 'bg-purple-100 text-purple-800'
      case 'seasonal': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatConditions = (rule: PricingRule): string => {
    const parts = []
    
    if (rule.conditions.startTime && rule.conditions.endTime) {
      parts.push(`${rule.conditions.startTime} - ${rule.conditions.endTime}`)
    }
    if (rule.conditions.minQuantity) {
      parts.push(`Min Qty: ${rule.conditions.minQuantity}`)
    }
    if (rule.conditions.userTiers && rule.conditions.userTiers.length > 0) {
      parts.push(`Tiers: ${rule.conditions.userTiers.join(', ')}`)
    }
    if (rule.conditions.categories && rule.conditions.categories.length > 0) {
      parts.push(`Categories: ${rule.conditions.categories.join(', ')}`)
    }

    return parts.join(' • ') || 'No conditions'
  }

  const formatDiscount = (rule: PricingRule): string => {
    if (rule.discount.type === 'percentage') {
      return `${rule.discount.value}% off${rule.discount.maxDiscount ? ` (max ₹${rule.discount.maxDiscount})` : ''}`
    } else if (rule.discount.type === 'fixed') {
      return `₹${rule.discount.value} off`
    } else if (rule.discount.type === 'buy-x-get-y') {
      return `Buy ${rule.discount.buyQuantity} Get ${rule.discount.getQuantity} Free`
    }
    return 'Unknown discount'
  }

  return (
    <div className="p-6 bg-white rounded-lg border">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Dynamic Pricing</h2>
        <p className="text-neutral-600">Create and manage automated pricing rules</p>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-neutral-600">
          {rules.filter(r => r.enabled).length} of {rules.length} rules active
        </div>
        <button
          onClick={() => setShowRuleForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
          CREATE RULE
        </button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No pricing rules created yet</p>
          <p className="text-sm mt-1">Create rules to automate discounts and pricing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`p-4 border rounded-lg ${rule.enabled ? 'bg-white' : 'bg-neutral-50 opacity-60'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded ${getTypeColor(rule.type)}`}>
                    {getRuleIcon(rule.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold">{rule.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs ${getTypeColor(rule.type)}`}>
                        {rule.type.replace('-', ' ').toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-xs">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600 mb-1">{formatConditions(rule)}</p>
                    <p className="text-sm font-medium text-green-600">{formatDiscount(rule)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                  <button
                    onClick={() => editRule(rule)}
                    className="p-2 hover:bg-neutral-100 rounded"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rule Form Modal */}
      {showRuleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingRule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-neutral-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Weekend Sale"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rule Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="time-based">Time-Based</option>
                    <option value="quantity-based">Quantity-Based</option>
                    <option value="user-based">User-Based</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="clearance">Clearance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority (1-10, higher = first)</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded"
                  min="1"
                  max="10"
                />
              </div>

              {/* Conditions based on type */}
              <div className="p-4 border rounded bg-neutral-50">
                <h4 className="font-medium mb-3">Conditions</h4>

                {(formData.type === 'time-based' || formData.type === 'seasonal') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Start Date</label>
                        <input
                          type="date"
                          value={formData.conditions?.startDate || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, startDate: e.target.value }
                          }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">End Date</label>
                        <input
                          type="date"
                          value={formData.conditions?.endDate || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, endDate: e.target.value }
                          }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs mb-1">Start Time</label>
                        <input
                          type="time"
                          value={formData.conditions?.startTime || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, startTime: e.target.value }
                          }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1">End Time</label>
                        <input
                          type="time"
                          value={formData.conditions?.endTime || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            conditions: { ...prev.conditions, endTime: e.target.value }
                          }))}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {formData.type === 'quantity-based' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Minimum Quantity</label>
                      <input
                        type="number"
                        value={formData.conditions?.minQuantity || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, minQuantity: Number(e.target.value) }
                        }))}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Maximum Quantity (optional)</label>
                      <input
                        type="number"
                        value={formData.conditions?.maxQuantity || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, maxQuantity: Number(e.target.value) || undefined }
                        }))}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                    </div>
                  </div>
                )}

                {formData.type === 'user-based' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs mb-2">User Tiers</label>
                      <div className="flex gap-2 flex-wrap">
                        {['new', 'regular', 'premium', 'vip'].map(tier => (
                          <button
                            key={tier}
                            onClick={() => {
                              const current = formData.conditions?.userTiers || []
                              const updated = current.includes(tier as any)
                                ? current.filter(t => t !== tier)
                                : [...current, tier as any]
                              setFormData(prev => ({
                                ...prev,
                                conditions: { ...prev.conditions, userTiers: updated }
                              }))
                            }}
                            className={`px-3 py-1 rounded text-sm ${
                              formData.conditions?.userTiers?.includes(tier as any)
                                ? 'bg-black text-white'
                                : 'bg-white border hover:border-black'
                            }`}
                          >
                            {tier.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Min Purchase History</label>
                      <input
                        type="number"
                        value={formData.conditions?.minPurchaseHistory || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, minPurchaseHistory: Number(e.target.value) }
                        }))}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="0"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Discount Settings */}
              <div className="p-4 border rounded bg-blue-50">
                <h4 className="font-medium mb-3">Discount</h4>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs mb-1">Discount Type</label>
                    <select
                      value={formData.discount?.type}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        discount: { ...prev.discount!, type: e.target.value as any }
                      }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                      <option value="buy-x-get-y">Buy X Get Y</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">
                      {formData.discount?.type === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      value={formData.discount?.value || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        discount: { ...prev.discount!, value: Number(e.target.value) }
                      }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      min="0"
                    />
                  </div>
                </div>

                {formData.discount?.type === 'percentage' && (
                  <div>
                    <label className="block text-xs mb-1">Max Discount Cap (₹, optional)</label>
                    <input
                      type="number"
                      value={formData.discount?.maxDiscount || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        discount: { ...prev.discount!, maxDiscount: Number(e.target.value) || undefined }
                      }))}
                      className="w-full px-2 py-1 border rounded text-sm"
                      min="0"
                    />
                  </div>
                )}

                {formData.discount?.type === 'buy-x-get-y' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs mb-1">Buy Quantity</label>
                      <input
                        type="number"
                        value={formData.discount?.buyQuantity || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          discount: { ...prev.discount!, buyQuantity: Number(e.target.value) }
                        }))}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs mb-1">Get Quantity Free</label>
                      <input
                        type="number"
                        value={formData.discount?.getQuantity || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          discount: { ...prev.discount!, getQuantity: Number(e.target.value) }
                        }))}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={saveRule}
                  className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
                >
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
                <button
                  onClick={resetForm}
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
