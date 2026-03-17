"use client"

import { useState, useEffect } from "react"
import { FileText, Plus, Edit2, Trash2, Eye, Save, Image as ImageIcon, Megaphone, Menu } from "lucide-react"

interface StaticPage {
  id: string
  title: string
  slug: string
  content: string
  isPublished: boolean
  lastUpdated: string
}

interface Banner {
  id: string
  title: string
  imageUrl: string
  linkUrl: string
  position: 'hero' | 'middle' | 'footer'
  isActive: boolean
  priority: number
}

interface Announcement {
  id: string
  text: string
  type: 'info' | 'warning' | 'success' | 'sale'
  isActive: boolean
  startDate: string
  endDate: string
}

interface ContentManagementSystemProps {
  onClose: () => void
}

export function ContentManagementSystem({ onClose }: ContentManagementSystemProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'banners' | 'announcements'>('pages')
  const [pages, setPages] = useState<StaticPage[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  
  const [editingPage, setEditingPage] = useState<StaticPage | null>(null)
  const [showPageEditor, setShowPageEditor] = useState(false)
  const [pageForm, setPageForm] = useState({ title: '', slug: '', content: '', isPublished: true })

  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [showBannerForm, setShowBannerForm] = useState(false)
  const [bannerForm, setBannerForm] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    position: 'hero' as Banner['position'],
    isActive: true,
    priority: 5
  })

  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState({
    text: '',
    type: 'info' as Announcement['type'],
    isActive: true,
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = () => {
    // Load Pages
    const storedPages = localStorage.getItem('cmsPages')
    if (storedPages) {
      setPages(JSON.parse(storedPages))
    } else {
      const defaultPages: StaticPage[] = [
        {
          id: 'about',
          title: 'About Us',
          slug: 'about',
          content: 'Welcome to Shringarika - Your destination for authentic Indian ethnic wear...',
          isPublished: true,
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'shipping',
          title: 'Shipping Policy',
          slug: 'shipping',
          content: 'We offer free shipping on orders above ₹5,000...',
          isPublished: true,
          lastUpdated: new Date().toISOString()
        }
      ]
      setPages(defaultPages)
      localStorage.setItem('cmsPages', JSON.stringify(defaultPages))
    }

    // Load Banners
    const storedBanners = localStorage.getItem('cmsBanners')
    if (storedBanners) {
      setBanners(JSON.parse(storedBanners))
    } else {
      const defaultBanners: Banner[] = [
        {
          id: 'banner1',
          title: 'Summer Sale',
          imageUrl: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=1200',
          linkUrl: '/products?category=sale',
          position: 'hero',
          isActive: true,
          priority: 10
        }
      ]
      setBanners(defaultBanners)
      localStorage.setItem('cmsBanners', JSON.stringify(defaultBanners))
    }

    // Load Announcements
    const storedAnnouncements = localStorage.getItem('cmsAnnouncements')
    if (storedAnnouncements) {
      setAnnouncements(JSON.parse(storedAnnouncements))
    } else {
      const defaultAnnouncements: Announcement[] = [
        {
          id: 'ann1',
          text: 'Free shipping on orders above ₹5,000! 🎉',
          type: 'sale',
          isActive: true,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ]
      setAnnouncements(defaultAnnouncements)
      localStorage.setItem('cmsAnnouncements', JSON.stringify(defaultAnnouncements))
    }
  }

  // Page Management
  const savePage = () => {
    if (!pageForm.title || !pageForm.slug) {
      alert('Title and slug are required')
      return
    }

    const newPage: StaticPage = {
      id: editingPage?.id || `page_${Date.now()}`,
      ...pageForm,
      lastUpdated: new Date().toISOString()
    }

    let updated: StaticPage[]
    if (editingPage) {
      updated = pages.map(p => p.id === editingPage.id ? newPage : p)
    } else {
      updated = [...pages, newPage]
    }

    setPages(updated)
    localStorage.setItem('cmsPages', JSON.stringify(updated))
    resetPageForm()
  }

  const deletePage = (id: string) => {
    if (confirm('Delete this page?')) {
      const updated = pages.filter(p => p.id !== id)
      setPages(updated)
      localStorage.setItem('cmsPages', JSON.stringify(updated))
    }
  }

  const editPage = (page: StaticPage) => {
    setEditingPage(page)
    setPageForm({
      title: page.title,
      slug: page.slug,
      content: page.content,
      isPublished: page.isPublished
    })
    setShowPageEditor(true)
  }

  const resetPageForm = () => {
    setPageForm({ title: '', slug: '', content: '', isPublished: true })
    setEditingPage(null)
    setShowPageEditor(false)
  }

  // Banner Management
  const saveBanner = () => {
    if (!bannerForm.title || !bannerForm.imageUrl) {
      alert('Title and image URL are required')
      return
    }

    const newBanner: Banner = {
      id: editingBanner?.id || `banner_${Date.now()}`,
      ...bannerForm
    }

    let updated: Banner[]
    if (editingBanner) {
      updated = banners.map(b => b.id === editingBanner.id ? newBanner : b)
    } else {
      updated = [...banners, newBanner]
    }

    setBanners(updated)
    localStorage.setItem('cmsBanners', JSON.stringify(updated))
    resetBannerForm()
  }

  const deleteBanner = (id: string) => {
    if (confirm('Delete this banner?')) {
      const updated = banners.filter(b => b.id !== id)
      setBanners(updated)
      localStorage.setItem('cmsBanners', JSON.stringify(updated))
    }
  }

  const editBanner = (banner: Banner) => {
    setEditingBanner(banner)
    setBannerForm({
      title: banner.title,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl,
      position: banner.position,
      isActive: banner.isActive,
      priority: banner.priority
    })
    setShowBannerForm(true)
  }

  const resetBannerForm = () => {
    setBannerForm({
      title: '',
      imageUrl: '',
      linkUrl: '',
      position: 'hero',
      isActive: true,
      priority: 5
    })
    setEditingBanner(null)
    setShowBannerForm(false)
  }

  // Announcement Management
  const saveAnnouncement = () => {
    if (!announcementForm.text) {
      alert('Announcement text is required')
      return
    }

    const newAnnouncement: Announcement = {
      id: editingAnnouncement?.id || `ann_${Date.now()}`,
      ...announcementForm
    }

    let updated: Announcement[]
    if (editingAnnouncement) {
      updated = announcements.map(a => a.id === editingAnnouncement.id ? newAnnouncement : a)
    } else {
      updated = [...announcements, newAnnouncement]
    }

    setAnnouncements(updated)
    localStorage.setItem('cmsAnnouncements', JSON.stringify(updated))
    resetAnnouncementForm()
  }

  const deleteAnnouncement = (id: string) => {
    if (confirm('Delete this announcement?')) {
      const updated = announcements.filter(a => a.id !== id)
      setAnnouncements(updated)
      localStorage.setItem('cmsAnnouncements', JSON.stringify(updated))
    }
  }

  const editAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setAnnouncementForm({
      text: announcement.text,
      type: announcement.type,
      isActive: announcement.isActive,
      startDate: announcement.startDate,
      endDate: announcement.endDate
    })
    setShowAnnouncementForm(true)
  }

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      text: '',
      type: 'info',
      isActive: true,
      startDate: '',
      endDate: ''
    })
    setEditingAnnouncement(null)
    setShowAnnouncementForm(false)
  }

  const getAnnouncementTypeColor = (type: Announcement['type']) => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'success': return 'bg-green-100 text-green-800'
      case 'sale': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto">
      <div className="bg-white w-full max-w-7xl m-4 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-wider flex items-center gap-3">
                <FileText className="w-8 h-8" />
                CONTENT MANAGEMENT SYSTEM
              </h2>
              <p className="text-teal-100 mt-1">Manage pages, banners, and announcements</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-teal-200 text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'pages'
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-5 h-5 inline mr-2" />
            Static Pages
          </button>
          <button
            onClick={() => setActiveTab('banners')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'banners'
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ImageIcon className="w-5 h-5 inline mr-2" />
            Banners
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 px-6 py-4 font-medium transition-colors ${
              activeTab === 'announcements'
                ? 'border-b-2 border-teal-600 text-teal-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Megaphone className="w-5 h-5 inline mr-2" />
            Announcements
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {activeTab === 'pages' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Static Pages</h3>
                <button
                  onClick={() => setShowPageEditor(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Page
                </button>
              </div>

              <div className="space-y-3">
                {pages.map(page => (
                  <div key={page.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-lg">{page.title}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            page.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {page.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">Slug: /{page.slug}</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{page.content}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Last updated: {new Date(page.lastUpdated).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => editPage(page)}
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => deletePage(page.id)}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'banners' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Website Banners</h3>
                <button
                  onClick={() => setShowBannerForm(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Banner
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map(banner => (
                  <div key={banner.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <img src={banner.imageUrl} alt={banner.title} className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{banner.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {banner.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Position: {banner.position} | Priority: {banner.priority}</p>
                      {banner.linkUrl && (
                        <p className="text-xs text-gray-500">Link: {banner.linkUrl}</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => editBanner(banner)}
                          className="flex-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteBanner(banner.id)}
                          className="flex-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Announcement Bar</h3>
                <button
                  onClick={() => setShowAnnouncementForm(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Announcement
                </button>
              </div>

              <div className="space-y-3">
                {announcements.map(announcement => (
                  <div key={announcement.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getAnnouncementTypeColor(announcement.type)}`}>
                            {announcement.type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            announcement.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {announcement.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-2">{announcement.text}</p>
                        <p className="text-xs text-gray-600">
                          {announcement.startDate} to {announcement.endDate}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => editAnnouncement(announcement)}
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(announcement.id)}
                          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page Editor Modal */}
      {showPageEditor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingPage ? 'Edit Page' : 'Create New Page'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Page Title *</label>
                  <input
                    type="text"
                    value={pageForm.title}
                    onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Slug *</label>
                  <input
                    type="text"
                    value={pageForm.slug}
                    onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Page Content *</label>
                <textarea
                  value={pageForm.content}
                  onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={12}
                  placeholder="Enter page content (supports HTML)..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublished"
                  checked={pageForm.isPublished}
                  onChange={(e) => setPageForm({ ...pageForm, isPublished: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="isPublished" className="text-sm font-medium">Publish this page</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={savePage}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingPage ? 'Update' : 'Create'} Page
              </button>
              <button
                onClick={resetPageForm}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner Form Modal */}
      {showBannerForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingBanner ? 'Edit Banner' : 'Create New Banner'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Banner Title *</label>
                <input
                  type="text"
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Image URL *</label>
                <input
                  type="text"
                  value={bannerForm.imageUrl}
                  onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Link URL</label>
                <input
                  type="text"
                  value={bannerForm.linkUrl}
                  onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="/products"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Position</label>
                  <select
                    value={bannerForm.position}
                    onChange={(e) => setBannerForm({ ...bannerForm, position: e.target.value as Banner['position'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="hero">Hero</option>
                    <option value="middle">Middle</option>
                    <option value="footer">Footer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority (1-10)</label>
                  <input
                    type="number"
                    value={bannerForm.priority}
                    onChange={(e) => setBannerForm({ ...bannerForm, priority: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bannerActive"
                  checked={bannerForm.isActive}
                  onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="bannerActive" className="text-sm font-medium">Active</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveBanner}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded"
              >
                {editingBanner ? 'Update' : 'Create'} Banner
              </button>
              <button
                onClick={resetBannerForm}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Form Modal */}
      {showAnnouncementForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-bold mb-4">{editingAnnouncement ? 'Edit Announcement' : 'Create New Announcement'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Announcement Text *</label>
                <input
                  type="text"
                  value={announcementForm.text}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Free shipping on orders above ₹5,000!"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={announcementForm.type}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, type: e.target.value as Announcement['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="sale">Sale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={announcementForm.startDate}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={announcementForm.endDate}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="announcementActive"
                  checked={announcementForm.isActive}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, isActive: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="announcementActive" className="text-sm font-medium">Active</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveAnnouncement}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded"
              >
                {editingAnnouncement ? 'Update' : 'Create'} Announcement
              </button>
              <button
                onClick={resetAnnouncementForm}
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
