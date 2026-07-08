"use client"

import { useState, useEffect } from "react"
import { Layers, Plus, Edit2, Trash2, Calendar, Tag, TrendingUp, Gift } from "lucide-react"
import { useAdmin } from "../context/AdminContext"

interface Campaign {
  id: string
  name: string
  description: string
  type: 'sale' | 'new_arrival' | 'clearance' | 'festival' | 'seasonal'
  discountPercentage: number
  startDate: string
  endDate: string
  status: 'active' | 'scheduled' | 'ended'
  productIds: Array<string | number>
  bannerImage?: string
  priority: number
}

interface Collection {
  id: string
  name: string
  description: string
  slug: string
  productIds: Array<string | number>
  isActive: boolean
  createdAt: string
}

interface CollectionsCampaignsManagerProps {
  onClose: () => void
}

export function CollectionsCampaignsManager({ onClose }: CollectionsCampaignsManagerProps) {
  const { products } = useAdmin()
  const [activeTab, setActiveTab] = useState<'collections' | 'campaigns'>('collections')
  const [collections, setCollections] = useState<Collection[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCollectionForm, setShowCollectionForm] = useState(false)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  const [collectionForm, setCollectionForm] = useState({
    name: '',
    description: '',
    slug: '',
    productIds: [] as Array<string | number>,
    isActive: true
  })

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    type: 'sale' as Campaign['type'],
    discountPercentage: 0,
    startDate: '',
    endDate: '',
    productIds: [] as Array<string | number>,
    bannerImage: '',
    priority: 5
  })

  useEffect(() => {
    loadCollections()
    loadCampaigns()
  }, [])

  const loadCollections = () => {
    const stored = localStorage.getItem('productCollections')
    if (stored) {
      setCollections(JSON.parse(stored))
    } else {
      // Sample collections
      const samples: Collection[] = [
        {
          id: 'COL001',
          name: 'Summer Collection 2025',
          description: 'Light and breezy outfits for summer',
          slug: 'summer-2025',
          productIds: [],
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ]
      setCollections(samples)
      localStorage.setItem('productCollections', JSON.stringify(samples))
    }
  }

  const loadCampaigns = () => {
    const stored = localStorage.getItem('marketingCampaigns')
    if (stored) {
      setCampaigns(JSON.parse(stored))
    } else {
      // Sample campaigns
      const samples: Campaign[] = [
        {
          id: 'CAMP001',
          name: 'Diwali Festival Sale',
          description: 'Big discounts for Diwali celebrations',
          type: 'festival',
          discountPercentage: 30,
          startDate: '2025-10-20',
          endDate: '2025-10-25',
          status: 'scheduled',
          productIds: [],
          priority: 10
        }
      ]
      setCampaigns(samples)
      localStorage.setItem('marketingCampaigns', JSON.stringify(samples))
    }
  }

  const saveCollection = () => {
    if (!collectionForm.name || !collectionForm.slug) {
      alert('Name and slug are required')
      return
    }

    const newCollection: Collection = {
      id: editingCollection?.id || `COL${Date.now()}`,
      ...collectionForm,
      createdAt: editingCollection?.createdAt || new Date().toISOString()
    }

    let updated: Collection[]
    if (editingCollection) {
      updated = collections.map(c => c.id === editingCollection.id ? newCollection : c)
    } else {
      updated = [...collections, newCollection]
    }

    setCollections(updated)
    localStorage.setItem('productCollections', JSON.stringify(updated))
    resetCollectionForm()
  }

  const saveCampaign = () => {
    if (!campaignForm.name || !campaignForm.startDate || !campaignForm.endDate) {
      alert('Name, start date, and end date are required')
      return
    }

    const today = new Date().toISOString().split('T')[0]
    let status: Campaign['status'] = 'scheduled'
    if (campaignForm.startDate <= today && campaignForm.endDate >= today) {
      status = 'active'
    } else if (campaignForm.endDate < today) {
      status = 'ended'
    }

    const newCampaign: Campaign = {
      id: editingCampaign?.id || `CAMP${Date.now()}`,
      ...campaignForm,
      status
    }

    let updated: Campaign[]
    if (editingCampaign) {
      updated = campaigns.map(c => c.id === editingCampaign.id ? newCampaign : c)
    } else {
      updated = [...campaigns, newCampaign]
    }

    setCampaigns(updated)
    localStorage.setItem('marketingCampaigns', JSON.stringify(updated))
    resetCampaignForm()
  }

  const deleteCollection = (id: string) => {
    if (confirm('Delete this collection?')) {
      const updated = collections.filter(c => c.id !== id)
      setCollections(updated)
      localStorage.setItem('productCollections', JSON.stringify(updated))
    }
  }

  const deleteCampaign = (id: string) => {
    if (confirm('Delete this campaign?')) {
      const updated = campaigns.filter(c => c.id !== id)
      setCampaigns(updated)
      localStorage.setItem('marketingCampaigns', JSON.stringify(updated))
    }
  }

  const editCollection = (collection: Collection) => {
    setEditingCollection(collection)
    setCollectionForm({
      name: collection.name,
      description: collection.description,
      slug: collection.slug,
      productIds: collection.productIds,
      isActive: collection.isActive
    })
    setShowCollectionForm(true)
  }

  const editCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setCampaignForm({
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      discountPercentage: campaign.discountPercentage,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      productIds: campaign.productIds,
      bannerImage: campaign.bannerImage || '',
      priority: campaign.priority
    })
    setShowCampaignForm(true)
  }

  const resetCollectionForm = () => {
    setCollectionForm({
      name: '',
      description: '',
      slug: '',
      productIds: [],
      isActive: true
    })
    setEditingCollection(null)
    setShowCollectionForm(false)
  }

  const resetCampaignForm = () => {
    setCampaignForm({
      name: '',
      description: '',
      type: 'sale',
      discountPercentage: 0,
      startDate: '',
      endDate: '',
      productIds: [],
      bannerImage: '',
      priority: 5
    })
    setEditingCampaign(null)
    setShowCampaignForm(false)
  }

  const toggleProductInCollection = (productId: string | number) => {
    setCollectionForm(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId]
    }))
  }

  const toggleProductInCampaign = (productId: string | number) => {
    setCampaignForm(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId]
    }))
  }

  const getCampaignTypeColor = (type: Campaign['type']) => {
    switch (type) {
      case 'sale': return 'bg-red-100 text-red-800'
      case 'new_arrival': return 'bg-green-100 text-green-800'
      case 'clearance': return 'bg-orange-100 text-orange-800'
      case 'festival': return 'bg-purple-100 text-purple-800'
      case 'seasonal': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCampaignStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-yellow-100 text-yellow-800'
      case 'ended': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto">
      <div className="bg-white w-full max-w-7xl m-4 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-wider flex items-center gap-3">
                <Layers className="w-8 h-8" />
                COLLECTIONS & CAMPAIGNS
              </h2>
              <p className="text-purple-100 mt-1">Organize products and create marketing campaigns</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('collections')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'collections'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-5 h-5 inline mr-2" />
            Collections
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'campaigns'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline mr-2" />
            Campaigns
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {activeTab === 'collections' ? (
            <div>
              {/* Collections Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Product Collections</h3>
                <button
                  onClick={() => setShowCollectionForm(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Collection
                </button>
              </div>

              {/* Collections List */}
              {collections.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No collections yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collections.map(collection => (
                    <div key={collection.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{collection.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{collection.description}</p>
                          <p className="text-xs text-gray-500 mt-2">Slug: /{collection.slug}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          collection.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {collection.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <span>{collection.productIds.length} products</span>
                        <span>Created: {new Date(collection.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => editCollection(collection)}
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCollection(collection.id)}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Campaigns Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Marketing Campaigns</h3>
                <button
                  onClick={() => setShowCampaignForm(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </button>
              </div>

              {/* Campaigns List */}
              {campaigns.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No campaigns yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-lg">{campaign.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getCampaignTypeColor(campaign.type)}`}>
                              {campaign.type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getCampaignStatusColor(campaign.status)}`}>
                              {campaign.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{campaign.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Discount:</span>
                              <span className="font-semibold text-red-600 ml-2">{campaign.discountPercentage}% OFF</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Start:</span>
                              <span className="font-medium ml-2">{new Date(campaign.startDate).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">End:</span>
                              <span className="font-medium ml-2">{new Date(campaign.endDate).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Products:</span>
                              <span className="font-medium ml-2">{campaign.productIds.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                        <button
                          onClick={() => editCampaign(campaign)}
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCampaign(campaign.id)}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Collection Form Modal */}
      {showCollectionForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingCollection ? 'Edit Collection' : 'Create New Collection'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Collection Name *</label>
                <input
                  type="text"
                  value={collectionForm.name}
                  onChange={(e) => setCollectionForm({ ...collectionForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Summer Collection 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Slug *</label>
                <input
                  type="text"
                  value={collectionForm.slug}
                  onChange={(e) => setCollectionForm({ ...collectionForm, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="summer-2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={collectionForm.description}
                  onChange={(e) => setCollectionForm({ ...collectionForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Describe this collection..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={collectionForm.isActive}
                  onChange={(e) => setCollectionForm({ ...collectionForm, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm font-medium">Active</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Products</label>
                <div className="border border-gray-300 rounded p-3 max-h-48 overflow-y-auto">
                  {products.map(product => (
                    <label key={product.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectionForm.productIds.includes(product.id)}
                        onChange={() => toggleProductInCollection(product.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{product.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">{collectionForm.productIds.length} products selected</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveCollection}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
              >
                {editingCollection ? 'Update' : 'Create'} Collection
              </button>
              <button
                onClick={resetCollectionForm}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Form Modal */}
      {showCampaignForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Diwali Sale 2025"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={campaignForm.type}
                    onChange={(e) => setCampaignForm({ ...campaignForm, type: e.target.value as Campaign['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="sale">Sale</option>
                    <option value="new_arrival">New Arrival</option>
                    <option value="clearance">Clearance</option>
                    <option value="festival">Festival</option>
                    <option value="seasonal">Seasonal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="Campaign description..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Discount % *</label>
                  <input
                    type="number"
                    value={campaignForm.discountPercentage}
                    onChange={(e) => setCampaignForm({ ...campaignForm, discountPercentage: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={campaignForm.startDate}
                    onChange={(e) => setCampaignForm({ ...campaignForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    value={campaignForm.endDate}
                    onChange={(e) => setCampaignForm({ ...campaignForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority (1-10)</label>
                <input
                  type="number"
                  value={campaignForm.priority}
                  onChange={(e) => setCampaignForm({ ...campaignForm, priority: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="1"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Products</label>
                <div className="border border-gray-300 rounded p-3 max-h-48 overflow-y-auto">
                  {products.map(product => (
                    <label key={product.id} className="flex items-center gap-2 py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaignForm.productIds.includes(product.id)}
                        onChange={() => toggleProductInCampaign(product.id)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{product.name} - ₹{product.price}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-1">{campaignForm.productIds.length} products selected</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveCampaign}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
              >
                {editingCampaign ? 'Update' : 'Create'} Campaign
              </button>
              <button
                onClick={resetCampaignForm}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
