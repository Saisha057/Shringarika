import React, { useState, useEffect } from "react"
import { 
  Users, Search, Eye, TrendingUp, ShoppingBag, 
  Calendar, DollarSign, Filter, X, ChevronDown,
  UserCheck, Clock, Package, Trash2
} from "lucide-react"
import { adminAPI } from '../services/api';

interface UserStats {
  totalOrders: number
  totalSpent: number
  lastOrderDate: string | null
  ordersByStatus: {
    pending: number
    confirmed: number
    processing: number
    packed: number
    shipped: number
    delivered: number
    cancelled: number
    returned: number
    refunded: number
  }
  codOrders: number
  prepaidOrders: number
}

interface User {
  id: string
  name: string
  email: string
  phone: string
  role: string
  created_at: string
  last_login: string | null
  stats: UserStats
}

interface UserDetailModalProps {
  user: User | null
  onClose: () => void
  onUserDeleted?: () => void
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, onClose, onUserDeleted }) => {
  const [detailedUser, setDetailedUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (user) {
      fetchUserDetails(user.id)
    }
  }, [user])

  const fetchUserDetails = async (userId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDetailedUser(data.data.user)
      }
    } catch (error) {
      console.error("Error fetching user details:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!user) return;

    try {
      setIsDeleting(true);
      await adminAPI.deleteUser(user.id);
      alert(`✅ User "${user.name}" has been deleted successfully!`);
      setShowDeleteConfirm(false);
      onClose();
      if (onUserDeleted) {
        onUserDeleted(); // Refresh users list
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('❌ Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never"
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Pending: "bg-yellow-100 text-yellow-800",
      Confirmed: "bg-blue-100 text-blue-800",
      Processing: "bg-purple-100 text-purple-800",
      Packed: "bg-indigo-100 text-indigo-800",
      Shipped: "bg-cyan-100 text-cyan-800",
      "Out for Delivery": "bg-teal-100 text-teal-800",
      Delivered: "bg-green-100 text-green-800",
      Cancelled: "bg-red-100 text-red-800",
      Returned: "bg-orange-100 text-orange-800",
      Refunded: "bg-pink-100 text-pink-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-sm text-neutral-600">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-neutral-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1">
                    <UserCheck className="w-4 h-4" />
                    <span>Joined</span>
                  </div>
                  <p className="font-semibold">{formatDate(user.created_at)}</p>
                  <p className="text-xs text-neutral-500">{formatTimeAgo(user.created_at)}</p>
                </div>

                <div className="bg-neutral-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span>Last Login</span>
                  </div>
                  <p className="font-semibold">{formatDate(user.last_login)}</p>
                  <p className="text-xs text-neutral-500">{formatTimeAgo(user.last_login)}</p>
                </div>

                <div className="bg-neutral-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1">
                    <Package className="w-4 h-4" />
                    <span>Last Order</span>
                  </div>
                  <p className="font-semibold">{formatDate(user.stats.lastOrderDate)}</p>
                  <p className="text-xs text-neutral-500">{formatTimeAgo(user.stats.lastOrderDate)}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-900">{user.stats.totalOrders}</p>
                  <p className="text-sm text-blue-700">Total Orders</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-900">₹{user.stats.totalSpent.toLocaleString()}</p>
                  <p className="text-sm text-green-700">Total Spent</p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-900">{user.stats.codOrders}</p>
                  <p className="text-sm text-purple-700">COD Orders</p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-900">{user.stats.prepaidOrders}</p>
                  <p className="text-sm text-orange-700">Prepaid Orders</p>
                </div>
              </div>

              {/* Order Status Breakdown */}
              <div className="bg-white border border-neutral-200 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Orders by Status
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {user?.stats?.ordersByStatus && Object.entries(user.stats.ordersByStatus).map(([status, count]) => (
                    count > 0 && (
                      <div key={status} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-neutral-600">{status}:</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    )
                  ))}
                  {!user?.stats?.ordersByStatus && (
                    <div className="col-span-3 text-sm text-neutral-500 text-center">
                      No order status data available
                    </div>
                  )}
                </div>
              </div>

              {/* Top Products Purchased */}
              {detailedUser?.stats?.topProducts && detailedUser.stats.topProducts.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Top Products Purchased
                  </h3>
                  <div className="space-y-2">
                    {detailedUser.stats.topProducts.map((product: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-neutral-50 p-2 rounded">
                        <span className="text-neutral-700">{product.name}</span>
                        <span className="font-semibold">{product.quantity}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order History */}
              {detailedUser?.orders && detailedUser.orders.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Order History ({detailedUser.orders.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detailedUser.orders.map((order: any) => (
                      <div key={order.id} className="flex items-center justify-between text-sm border-b border-neutral-100 pb-2">
                        <div className="flex-1">
                          <p className="font-semibold">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                          <p className="text-xs text-neutral-500">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right mr-3">
                          <p className="font-semibold">₹{Number(order.total_price).toFixed(2)}</p>
                          <p className="text-xs text-neutral-500">{order.payment_method || 'N/A'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status || 'Pending')}`}>
                          {order.order_status || 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-between items-center">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete User
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 rounded-md hover:bg-neutral-100 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <Trash2 className="w-8 h-8" />
                <h3 className="text-2xl tracking-wider">DELETE USER</h3>
              </div>
              <p className="mb-6 text-neutral-700">
                Are you sure you want to permanently delete <strong>{user.name}</strong>?
                <br /><br />
                This will delete:
                <ul className="list-disc ml-5 mt-2">
                  <li>User account and profile</li>
                  <li>All associated orders</li>
                  <li>Saved addresses</li>
                  <li>Wishlist items</li>
                </ul>
                <br />
                <strong className="text-red-600">This action cannot be undone!</strong>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 transition-colors disabled:opacity-50 tracking-wider"
                >
                  {isDeleting ? 'DELETING...' : 'YES, DELETE'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 border-2 border-neutral-300 py-3 rounded hover:bg-neutral-100 transition-colors tracking-wider"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [sortBy, setSortBy] = useState<"recent" | "spent" | "orders">("recent")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers();
  }, []);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const fetchUsers = async () => {
    setLoading(true)
    try {
      console.log('👥 [AdminUsers] Fetching users from /api/admin/users...');
      
      const response = await adminAPI.getAllUsers({
        role: filterRole !== 'all' ? filterRole : undefined,
        page: 1,
        limit: 100,
      });

      console.log('📡 [AdminUsers] API response:', response);

      if (response.status === 'success' && response.data && Array.isArray(response.data.users)) {
        // ✅ FIX: Use ONLY backend data - no localStorage enrichment
        const usersFromDB = response.data.users.map((user: any) => {
          return {
            ...user,
            // Ensure stats exist with defaults
            stats: {
              totalOrders: user.stats?.totalOrders || 0,
              totalSpent: user.stats?.totalSpent || 0,
              lastOrderDate: user.stats?.lastOrderDate || null,
              ordersByStatus: user.stats?.ordersByStatus || {
                pending: 0,
                confirmed: 0,
                processing: 0,
                packed: 0,
                shipped: 0,
                delivered: 0,
                cancelled: 0,
                returned: 0,
                refunded: 0
              },
              codOrders: user.stats?.codOrders || 0,
              prepaidOrders: user.stats?.prepaidOrders || 0,
            }
          };
        });
        
        setUsers(usersFromDB);
        console.log(`✅ [AdminUsers] Successfully loaded ${usersFromDB.length} users from database`);
        
        if (usersFromDB.length === 0) {
          console.warn('⚠️  [AdminUsers] API returned 0 users. Check if users exist in database.');
        }
      } else {
        console.error('❌ [AdminUsers] Unexpected response format:', response);
        setUsers([]);
      }
    } catch (error: any) {
      console.error("❌ [AdminUsers] Error fetching users:", error);
      console.error('❌ Backend connection failed. Check server is running on correct port.');
      setUsers([]);
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone && user.phone.includes(searchQuery))
      
      const matchesRole = filterRole === "all" || user.role === filterRole

      return matchesSearch && matchesRole
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "spent":
          return b.stats.totalSpent - a.stats.totalSpent
        case "orders":
          return b.stats.totalOrders - a.stats.totalOrders
        case "recent":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  const totalUsers = users.length
  const totalRevenue = users.reduce((sum, user) => sum + user.stats.totalSpent, 0)
  const totalOrders = users.reduce((sum, user) => sum + user.stats.totalOrders, 0)
  const activeUsers = users.filter(u => u.stats.lastOrderDate).length

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm tracking-wider text-neutral-600">TOTAL USERS</h3>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold">{totalUsers}</p>
          <p className="text-xs text-neutral-500 mt-1">{activeUsers} active shoppers</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm tracking-wider text-neutral-600">TOTAL REVENUE</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-neutral-500 mt-1">From all users</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm tracking-wider text-neutral-600">TOTAL ORDERS</h3>
            <ShoppingBag className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold">{totalOrders}</p>
          <p className="text-xs text-neutral-500 mt-1">All time</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm tracking-wider text-neutral-600">AVG PER USER</h3>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-3xl font-bold">
            ₹{totalUsers > 0 ? Math.round(totalRevenue / totalUsers) : 0}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Average spending</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">All Roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="recent">Recently Joined</option>
            <option value="spent">Highest Spending</option>
            <option value="orders">Most Orders</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold tracking-wider text-neutral-700">USER</th>
                  <th className="text-left p-4 text-sm font-semibold tracking-wider text-neutral-700">JOINED</th>
                  <th className="text-left p-4 text-sm font-semibold tracking-wider text-neutral-700">LAST LOGIN</th>
                  <th className="text-center p-4 text-sm font-semibold tracking-wider text-neutral-700">ORDERS</th>
                  <th className="text-center p-4 text-sm font-semibold tracking-wider text-neutral-700">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                    <td className="p-4">
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-neutral-600">{user.email}</p>
                        {user.phone && <p className="text-xs text-neutral-500">{user.phone}</p>}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{formatDate(user.created_at)}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{formatDate(user.last_login)}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                        {user.stats.totalOrders}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-black text-white rounded hover:bg-neutral-800 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAndSortedUsers.length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No users found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUserDeleted={fetchUsers}
        />
      )}
    </div>
  )
}
