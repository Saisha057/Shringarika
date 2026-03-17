"use client"

import { useState, useEffect } from "react"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { TrendingUp, DollarSign, ShoppingCart, Users, Package, Eye } from "lucide-react"
import { adminAPI } from '../services/api';
import { productAPI } from '../services/api';

interface AnalyticsData {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalCustomers: number
  avgOrderValue: number
  conversionRate: number
  topProducts: Array<{ name: string; sales: number; revenue: number }>
  salesByCategory: Array<{ category: string; value: number }>
  revenueByMonth: Array<{ month: string; revenue: number; orders: number }>
  recentActivity: Array<{ type: string; description: string; timestamp: string }>
}

interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  newUsers: number;
  avgOrderValue: number;
  completionRate: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
}

interface AdminAnalyticsProps {
  onClose: () => void
}

const COLORS = ["#000000", "#404040", "#737373", "#a3a3a3", "#d4d4d4"]

export function AdminAnalytics({ onClose }: AdminAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<any>({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
    fulfillmentRate: 0,
    revenueChange: null,
    ordersChange: null,
    topProducts: [],
    salesByCategory: [],
    revenueByMonth: [],
    recentActivity: [],
    periodLabel: 'Last 30 days',
    pendingOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d")

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      console.log('📊 [AdminAnalytics] Fetching analytics for range:', timeRange);

      const safeNum = (val: any): number => {
        const n = Number(val);
        return isNaN(n) ? 0 : n;
      };

      const endDate = new Date();
      const startDate = new Date();

      let daysBack = 30;
      switch (timeRange) {
        case '7d':
          daysBack = 7;
          break;
        case '30d':
          daysBack = 30;
          break;
        case '90d':
          daysBack = 90;
          break;
        case '1y':
          daysBack = 365;
          break;
      }
      startDate.setDate(endDate.getDate() - daysBack);

      const prevEndDate = new Date(startDate);
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - daysBack);

      console.log('📅 Current period:', startDate.toISOString(), '→', endDate.toISOString());
      console.log('📅 Previous period:', prevStartDate.toISOString(), '→', prevEndDate.toISOString());

      const [currentResponse, productAnalytics] = await Promise.all([
        adminAPI.getDashboardAnalytics({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
        adminAPI.getAnalytics('products', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      ]);

      console.log('✅ [AdminAnalytics] Current period response:', currentResponse);
      console.log('✅ [AdminAnalytics] Product analytics:', productAnalytics);

      let prevRevenue = 0;
      let prevOrders = 0;
      try {
        const prevResponse = await adminAPI.getDashboardAnalytics({
          startDate: prevStartDate.toISOString(),
          endDate: prevEndDate.toISOString(),
        });
        if (prevResponse?.data?.metrics) {
          prevRevenue = safeNum(prevResponse.data.metrics.totalRevenue);
          prevOrders = safeNum(prevResponse.data.metrics.totalOrders);
          console.log('✅ [AdminAnalytics] Previous period:', { prevRevenue, prevOrders });
        }
      } catch (prevErr) {
        console.warn('[AdminAnalytics] Previous period fetch failed (non-blocking):', prevErr);
      }

      // Catalog count is intentionally all-time and not filtered by selected date range.
      let totalProducts = 0;
      try {
        const productsResponse = await productAPI.getAll();
        const productsArray = Array.isArray(productsResponse?.data)
          ? productsResponse.data
          : Array.isArray(productsResponse)
            ? productsResponse
            : [];
        totalProducts = productsArray.length;
        console.log('✅ [AdminAnalytics] Total products in catalog:', totalProducts);
      } catch (err) {
        console.warn('[AdminAnalytics] Products count fetch failed:', err);
      }

      if (currentResponse?.status === 'success' && currentResponse?.data?.metrics) {
        const metrics = currentResponse.data.metrics;

        const currentRevenue = safeNum(metrics.totalRevenue);
        const currentOrders = safeNum(metrics.totalOrders);

        const revenueChange = prevRevenue > 0
          ? (((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
          : null;

        const ordersChange = prevOrders > 0
          ? (((currentOrders - prevOrders) / prevOrders) * 100).toFixed(1)
          : null;

        console.log('📈 [AdminAnalytics] Revenue change:', revenueChange + '%');
        console.log('📈 [AdminAnalytics] Orders change:', ordersChange + '%');

        const rawChartData = currentResponse.data.charts?.ordersByDate || [];
        const chartData = rawChartData
          .filter((item: any) => item && item.date)
          .map((item: any) => ({
            month: new Date(item.date).toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
            }),
            revenue: safeNum(item.revenue),
            orders: safeNum(item.orders),
          }));
        console.log('📊 [AdminAnalytics] Chart data points:', chartData.length);

        const rawTopProducts = productAnalytics?.data?.topSelling || [];
        const topProducts = rawTopProducts
          .filter((item: any) => item && item.name)
          .map((item: any) => ({
            name: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
            sales: safeNum(item.sold),
            revenue: safeNum(item.revenue),
          }))
          .filter((item: any) => item.sales > 0 || item.revenue > 0);
        console.log('📊 [AdminAnalytics] Top products:', topProducts.length);

        const rawCategoryData = productAnalytics?.data?.byCategory || {};
        const categoryData = Object.entries(rawCategoryData)
          .map(([category, data]: [string, any]) => ({
            category: category || 'Uncategorized',
            value: safeNum(data?.revenue),
            count: safeNum(data?.count),
            sold: safeNum(data?.sold),
          }))
          .filter((item: any) => item.value > 0)
          .sort((a: any, b: any) => b.value - a.value);
        console.log('📊 [AdminAnalytics] Category data:', categoryData.length, 'categories');

        const recentOrders = (currentResponse.data.recentOrders || [])
          .filter((order: any) => {
            if (!order.created_at) return true;
            const orderDate = new Date(order.created_at);
            return orderDate >= startDate && orderDate <= endDate;
          })
          .slice(0, 5)
          .map((order: any) => ({
            type: 'order',
            description: `Order #${(order.id || '').slice(0, 8)} — ₹${safeNum(order.total_amount).toLocaleString('en-IN')}`,
            timestamp: order.created_at
              ? new Date(order.created_at).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Unknown time',
          }));

        const calculatedAvg = currentOrders > 0 ? currentRevenue / currentOrders : 0;
        const fulfillmentRate = safeNum(metrics.completionRate);

        console.log('✅ [AdminAnalytics] Final metrics:', {
          revenue: currentRevenue,
          orders: currentOrders,
          products: totalProducts,
          customers: metrics.totalUsers,
          avgOrder: calculatedAvg.toFixed(2),
          fulfillment: fulfillmentRate,
        });

        setAnalyticsData({
          totalRevenue: currentRevenue,
          totalOrders: currentOrders,
          totalProducts: totalProducts,
          totalCustomers: safeNum(metrics.totalUsers),
          avgOrderValue: calculatedAvg,
          fulfillmentRate: fulfillmentRate,
          revenueChange: revenueChange,
          ordersChange: ordersChange,
          topProducts: topProducts,
          salesByCategory: categoryData,
          revenueByMonth: chartData,
          recentActivity: recentOrders,
          periodLabel: `Last ${daysBack} day${daysBack === 1 ? '' : 's'}`,
          pendingOrders: safeNum(metrics.pendingOrders),
          deliveredOrders: safeNum(metrics.deliveredOrders),
          cancelledOrders: safeNum(metrics.cancelledOrders),
        });
      } else {
        console.error('❌ [AdminAnalytics] Bad response structure:', currentResponse);
        setAnalyticsData({
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          totalCustomers: 0,
          avgOrderValue: 0,
          fulfillmentRate: 0,
          revenueChange: null,
          ordersChange: null,
          topProducts: [],
          salesByCategory: [],
          revenueByMonth: [],
          recentActivity: [],
          periodLabel: `Last ${daysBack} days`,
          pendingOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
        });
      }
    } catch (error: any) {
      console.error('❌ [AdminAnalytics] Fatal error:', error?.message || error);
      setAnalyticsData({
        totalRevenue: 0,
        totalOrders: 0,
        totalProducts: 0,
        totalCustomers: 0,
        avgOrderValue: 0,
        fulfillmentRate: 0,
        revenueChange: null,
        ordersChange: null,
        topProducts: [],
        salesByCategory: [],
        revenueByMonth: [],
        recentActivity: [],
        periodLabel: '',
        pendingOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  const safeNum = (val: any, decimals = 0) => {
    const n = Number(val);
    return isNaN(n) ? '0' : n.toFixed(decimals);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-sm tracking-wider">LOADING ANALYTICS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-8 gap-3 sm:gap-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl tracking-wider">ANALYTICS DASHBOARD</h1>
          <div className="flex gap-2 sm:gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="flex-1 sm:flex-none px-2 sm:px-4 py-2 bg-white border border-neutral-300 rounded tracking-wider text-xs sm:text-sm"
            >
              <option value="7d">LAST 7 DAYS</option>
              <option value="30d">LAST 30 DAYS</option>
              <option value="90d">LAST 90 DAYS</option>
              <option value="1y">LAST YEAR</option>
            </select>
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-2 bg-neutral-300 hover:bg-neutral-400 rounded transition-colors text-xs sm:text-sm tracking-wider"
            >
              CLOSE
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-4 md:gap-6 mb-4 sm:mb-8">
          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs tracking-wider text-neutral-600">TOTAL REVENUE</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2">₹{Number(safeNum(analyticsData.totalRevenue, 0)).toLocaleString('en-IN')}</p>
            <p className="text-xs text-neutral-500 mt-1 sm:mt-2 flex items-center gap-1" style={{
              color: analyticsData.revenueChange === null ? '#737373'
                : Number(analyticsData.revenueChange) >= 0 ? '#16a34a' : '#dc2626'
            }}>
              <TrendingUp className="w-3 h-3" />
              <span>
                {analyticsData.revenueChange === null
                  ? 'No previous period data'
                  : `${Number(analyticsData.revenueChange) >= 0 ? '+' : ''}${analyticsData.revenueChange}% vs previous ${analyticsData.periodLabel}`
                }
              </span>
            </p>
          </div>

          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs tracking-wider text-neutral-600">TOTAL ORDERS</h3>
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2">{safeNum(analyticsData.totalOrders, 0)}</p>
            <p className="text-xs text-neutral-500 mt-1 sm:mt-2">
              {analyticsData.ordersChange === null
                ? `${analyticsData.periodLabel || ''}`
                : `${Number(analyticsData.ordersChange) >= 0 ? '+' : ''}${analyticsData.ordersChange}% vs prev period`
              }
            </p>
          </div>

          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs tracking-wider text-neutral-600">TOTAL USERS</h3>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2">{safeNum(analyticsData.totalCustomers, 0)}</p>
            <p className="text-xs text-neutral-500 mt-1 sm:mt-2">
              Total registered users (all time)
            </p>
          </div>

          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs tracking-wider text-neutral-600">TOTAL PRODUCTS</h3>
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2">{safeNum(analyticsData.totalProducts, 0)}</p>
            <p className="text-xs text-neutral-500 mt-1 sm:mt-2">Active in catalog</p>
          </div>

          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs tracking-wider text-neutral-600">AVG ORDER VALUE</h3>
              <DollarSign className="w-5 h-5 text-teal-600" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2">
              ₹{isNaN(Number(analyticsData.avgOrderValue))
                ? '0.00'
                : Number(analyticsData.avgOrderValue).toFixed(2)}
            </p>
            <p className="text-xs text-neutral-500 mt-1 sm:mt-2">
              Calculated from {analyticsData.periodLabel || 'selected period'} orders
            </p>
          </div>

          <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs tracking-wider text-neutral-600">
                ORDER FULFILLMENT
              </h3>
              <Eye className="w-5 h-5 text-pink-600" />
            </div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2">
              {isNaN(Number(analyticsData.fulfillmentRate))
                ? '0'
                : Number(analyticsData.fulfillmentRate).toFixed(1)}%
            </p>
            <p className="text-xs text-neutral-500 mt-1 sm:mt-2">
              Orders delivered / total orders
            </p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue Chart */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg tracking-wider mb-4">REVENUE & ORDERS TREND</h3>
            {analyticsData.revenueByMonth.length === 0 ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3', fontSize: '14px' }}>
                No revenue data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" stroke="#737373" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#737373" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e5e5", borderRadius: "4px" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#000" strokeWidth={2} name="Revenue (₹)" />
                  <Line type="monotone" dataKey="orders" stroke="#737373" strokeWidth={2} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sales by Category */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg tracking-wider mb-4">SALES BY CATEGORY</h3>
            {analyticsData.salesByCategory.length === 0 ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3', fontSize: '14px' }}>
                No category data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analyticsData.salesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, value }) => {
                      const safeVal = isNaN(Number(value)) ? 0 : Number(value);
                      return safeVal > 0 ? `${category}: ₹${safeVal.toFixed(0)}` : '';
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.salesByCategory.map((entry: any, index: any) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, props: any) => [
                      `₹${safeNum(value, 2)}`,
                      `Revenue (${safeNum(props?.payload?.sold, 0)} sold)`
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg tracking-wider mb-4">TOP SELLING PRODUCTS</h3>
            {analyticsData.topProducts.length === 0 ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3', fontSize: '14px' }}>
                No product sales data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.topProducts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="name" stroke="#737373" style={{ fontSize: "11px" }} angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#737373" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e5e5", borderRadius: "4px" }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#000" name="Units Sold" />
                  <Bar dataKey="revenue" fill="#737373" name="Revenue (₹)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg tracking-wider mb-4">RECENT ACTIVITY</h3>
            <div className="space-y-4">
              {analyticsData.recentActivity.map((activity: any, index: any) => (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-neutral-200 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${
                    activity.type === "order" ? "bg-blue-500" :
                    activity.type === "product" ? "bg-green-500" :
                    "bg-purple-500"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-neutral-900">{activity.description}</p>
                    <p className="text-xs text-neutral-500 mt-1">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
              {analyticsData.recentActivity.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">
                  No orders in this period
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
