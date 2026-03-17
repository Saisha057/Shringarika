"use client"

import { useState, useEffect } from "react"
import { Users, Search, Mail, Phone, MapPin, ShoppingBag, CreditCard, Edit, Trash2, Ban, CheckCircle } from "lucide-react"

interface UserData {
  id: string
  name: string
  email: string
  phone?: string
  role: 'customer' | 'admin'
  status: 'active' | 'suspended' | 'banned'
  createdAt: string
  lastLogin?: string
  totalOrders: number
  totalSpent: number
  storeCredit: number
  addresses: Array<{
    street: string
    city: string
    state: string
    pinCode: string
    isDefault: boolean
  }>
}

interface UserManagementPanelProps {
  onClose: () => void
}

export function UserManagementPanel({ onClose }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [editingCredit, setEditingCredit] = useState<string | null>(null)
  const [creditAmount, setCreditAmount] = useState("")

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchQuery, roleFilter, statusFilter])

  const loadUsers = () => {
    // Load users from localStorage
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]')
    
    const usersData: UserData[] = registeredUsers.map((user: any) => {
      // Calculate user stats
      const userOrders = getUserOrders(user.id)
      const totalSpent = userOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total || 0), 0)

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role || 'customer',
        status: user.status || 'active',
        createdAt: user.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin,
        totalOrders: userOrders.length,
        totalSpent,
        storeCredit: user.storeCredit || 0,
        addresses: user.addresses || []
      }
    })

    setUsers(usersData)
  }

  const getUserOrders = (userId: string) => {
    const ordersKey = `fashionOrders_user_${userId}`
    return JSON.parse(localStorage.getItem(ordersKey) || '[]')
  }

  const filterUsers = () => {
    let filtered = [...users]

    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(user => user.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query)
      )
    }

    setFilteredUsers(filtered)
  }

  const updateUserStatus = (userId: string, newStatus: UserData['status']) => {
    const updatedUsers = users.map(user => {
      if (user.id === userId) {
        return { ...user, status: newStatus }
      }
      return user
    })

    setUsers(updatedUsers)

    // Update in localStorage
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]')
    const updatedRegistered = registeredUsers.map((user: any) => {
      if (user.id === userId) {
        return { ...user, status: newStatus }
      }
      return user
    })
    localStorage.setItem('registeredUsers', JSON.stringify(updatedRegistered))
  }

  const updateStoreCredit = (userId: string) => {
    const amount = parseFloat(creditAmount)
    if (isNaN(amount)) {
      alert('Please enter a valid amount')
      return
    }

    const updatedUsers = users.map(user => {
      if (user.id === userId) {
        return { ...user, storeCredit: user.storeCredit + amount }
      }
      return user
    })

    setUsers(updatedUsers)

    // Update in localStorage
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]')
    const updatedRegistered = registeredUsers.map((user: any) => {
      if (user.id === userId) {
        return { ...user, storeCredit: (user.storeCredit || 0) + amount }
      }
      return user
    })
    localStorage.setItem('registeredUsers', JSON.stringify(updatedRegistered))

    setEditingCredit(null)
    setCreditAmount("")
  }

  const makeAdmin = (userId: string) => {
    if (confirm('Make this user an admin? They will have full access to the admin panel.')) {
      const updatedUsers = users.map(user => {
        if (user.id === userId) {
          return { ...user, role: 'admin' as const }
        }
        return user
      })

      setUsers(updatedUsers)

      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]')
      const updatedRegistered = registeredUsers.map((user: any) => {
        if (user.id === userId) {
          return { ...user, role: 'admin' }
        }
        return user
      })
      localStorage.setItem('registeredUsers', JSON.stringify(updatedRegistered))
    }
  }

  const deleteUser = (userId: string) => {
    if (confirm('Delete this user? This action cannot be undone.')) {
      const updatedUsers = users.filter(user => user.id !== userId)
      setUsers(updatedUsers)

      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]')
      const updatedRegistered = registeredUsers.filter((user: any) => user.id !== userId)
      localStorage.setItem('registeredUsers', JSON.stringify(updatedRegistered))

      // Delete user orders
      localStorage.removeItem(`fashionOrders_user_${userId}`)
      localStorage.removeItem(`fashionWishlist_${userId}`)
    }
  }

  const viewUserOrders = (user: UserData) => {
    setSelectedUser(user)
  }

  const getStatusColor = (status: UserData['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'suspended': return 'bg-yellow-100 text-yellow-800'
      case 'banned': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    admins: users.filter(u => u.role === 'admin').length,
    totalRevenue: users.reduce((sum, u) => sum + u.totalSpent, 0),
    totalOrders: users.reduce((sum, u) => sum + u.totalOrders, 0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-auto">
      <div className="bg-white w-full max-w-7xl m-4 rounded-lg shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-wider flex items-center gap-3">
                <Users className="w-8 h-8" />
                USER MANAGEMENT
              </h2>
              <p className="text-blue-100 mt-1">Manage customers and administrators</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 text-2xl font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-6 bg-gray-50">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-600">Total Users</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.suspended}</div>
            <div className="text-xs text-gray-600">Suspended</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-indigo-200">
            <div className="text-2xl font-bold text-indigo-600">{stats.admins}</div>
            <div className="text-xs text-gray-600">Admins</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.totalOrders}</div>
            <div className="text-xs text-gray-600">Total Orders</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">₹{stats.totalRevenue.toFixed(0)}</div>
            <div className="text-xs text-gray-600">Revenue</div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customers</option>
              <option value="admin">Admins</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No users found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {user.name}
                            {user.role === 'admin' && (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded">ADMIN</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </span>
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 p-3 bg-gray-50 rounded">
                        <div>
                          <div className="text-xs text-gray-600">Total Orders</div>
                          <div className="font-semibold flex items-center gap-1">
                            <ShoppingBag className="w-4 h-4 text-blue-600" />
                            {user.totalOrders}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Total Spent</div>
                          <div className="font-semibold text-green-600">₹{user.totalSpent.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Store Credit</div>
                          <div className="font-semibold flex items-center gap-1">
                            <CreditCard className="w-4 h-4 text-purple-600" />
                            ₹{user.storeCredit.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Addresses</div>
                          <div className="font-semibold flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-orange-600" />
                            {user.addresses.length}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-gray-600">
                        <span>Joined: {new Date(user.createdAt).toLocaleDateString()}</span>
                        {user.lastLogin && (
                          <span className="ml-4">Last Login: {new Date(user.lastLogin).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                        {user.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                    <button
                      onClick={() => viewUserOrders(user)}
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      View Orders
                    </button>

                    {editingCredit === user.id ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => updateStoreCredit(user.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setEditingCredit(null)
                            setCreditAmount("")
                          }}
                          className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingCredit(user.id)}
                        className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-sm flex items-center gap-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        Add Credit
                      </button>
                    )}

                    {user.role !== 'admin' && (
                      <button
                        onClick={() => makeAdmin(user.id)}
                        className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded text-sm"
                      >
                        Make Admin
                      </button>
                    )}

                    {user.status === 'active' ? (
                      <button
                        onClick={() => updateUserStatus(user.id, 'suspended')}
                        className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" />
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => updateUserStatus(user.id, 'active')}
                        className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Activate
                      </button>
                    )}

                    <button
                      onClick={() => deleteUser(user.id)}
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
      </div>

      {/* User Orders Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              Orders by {selectedUser.name}
            </h3>
            <div className="space-y-3">
              {getUserOrders(selectedUser.id).map((order: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold">#{order.orderId}</div>
                      <div className="text-sm text-gray-600">{order.orderDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">₹{order.total}</div>
                      <div className="text-xs text-gray-600">{order.status || 'pending'}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700">
                    {order.items.map((item: any, i: number) => (
                      <div key={i}>{item.name} x{item.quantity}</div>
                    ))}
                  </div>
                </div>
              ))}
              {getUserOrders(selectedUser.id).length === 0 && (
                <p className="text-center text-gray-600 py-8">No orders yet</p>
              )}
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
