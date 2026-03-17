"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Bell, X, Settings } from "lucide-react"
import { useAdmin } from "../context/AdminContext"

interface LowStockAlert {
  productId: number
  productName: string
  category: string
  currentStock: number
  threshold: number
  severity: 'critical' | 'warning' | 'low'
}

export function LowStockAlerts() {
  const { products, getProductStock } = useAdmin()
  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [thresholds, setThresholds] = useState({
    critical: 5,
    warning: 15,
    low: 30,
  })
  const [isMinimized, setIsMinimized] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)

  useEffect(() => {
    // Load thresholds from localStorage
    const savedThresholds = localStorage.getItem('stockAlertThresholds')
    if (savedThresholds) {
      setThresholds(JSON.parse(savedThresholds))
    }
    
    checkStock()
    
    // Check every 5 minutes
    const interval = setInterval(checkStock, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [products])

  const checkStock = () => {
    const lowStockProducts: LowStockAlert[] = []

    products.forEach(product => {
      const stock = getProductStock(product.id)
      const currentStock = stock?.stock ?? product.stock ?? 0

      let severity: 'critical' | 'warning' | 'low' | null = null
      if (currentStock <= thresholds.critical) {
        severity = 'critical'
      } else if (currentStock <= thresholds.warning) {
        severity = 'warning'
      } else if (currentStock <= thresholds.low) {
        severity = 'low'
      }

      if (severity) {
        lowStockProducts.push({
          productId: product.id,
          productName: product.name,
          category: product.category,
          currentStock,
          threshold: thresholds[severity],
          severity,
        })
      }
    })

    setAlerts(lowStockProducts)

    // Show notification if there are critical alerts
    const criticalAlerts = lowStockProducts.filter(a => a.severity === 'critical')
    if (criticalAlerts.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('⚠️ Critical Stock Alert', {
        body: `${criticalAlerts.length} product(s) are critically low on stock!`,
        icon: '/alert-icon.png',
      })
    }
  }

  const handleSaveThresholds = () => {
    localStorage.setItem('stockAlertThresholds', JSON.stringify(thresholds))
    setShowSettings(false)
    checkStock()
  }

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-900'
      case 'warning':
        return 'bg-orange-50 border-orange-200 text-orange-900'
      case 'low':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴'
      case 'warning':
        return '🟠'
      case 'low':
        return '🟡'
      default:
        return '⚪'
    }
  }

  if (!showAlerts) {
    return (
      <button
        onClick={() => setShowAlerts(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        title="Stock Alerts"
      >
        <Bell className="h-5 w-5" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-white text-red-500 text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {alerts.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 bg-white rounded-lg shadow-2xl border border-neutral-200 transition-all ${
      isMinimized ? 'w-80 h-14' : 'w-96 max-h-[600px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-neutral-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${alerts.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
          <span className="font-medium">Stock Alerts</span>
          {alerts.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            <span className="text-sm">−</span>
          </button>
          <button
            onClick={() => setShowAlerts(false)}
            className="p-1 hover:bg-neutral-200 rounded transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Settings */}
          {showSettings && (
            <div className="p-4 border-b bg-neutral-50">
              <p className="text-sm font-medium mb-3">Alert Thresholds</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-neutral-600 block mb-1">
                    🔴 Critical (≤)
                  </label>
                  <input
                    type="number"
                    value={thresholds.critical}
                    onChange={(e) => setThresholds(prev => ({ ...prev, critical: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 block mb-1">
                    🟠 Warning (≤)
                  </label>
                  <input
                    type="number"
                    value={thresholds.warning}
                    onChange={(e) => setThresholds(prev => ({ ...prev, warning: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-600 block mb-1">
                    🟡 Low (≤)
                  </label>
                  <input
                    type="number"
                    value={thresholds.low}
                    onChange={(e) => setThresholds(prev => ({ ...prev, low: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    min="0"
                  />
                </div>
                <button
                  onClick={handleSaveThresholds}
                  className="w-full px-4 py-2 bg-black text-white rounded hover:bg-neutral-800 transition-colors text-sm"
                >
                  Save Thresholds
                </button>
              </div>
            </div>
          )}

          {/* Alerts List */}
          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  ✓
                </div>
                <p className="text-sm">All products are well-stocked!</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.productId}
                    className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{getSeverityIcon(alert.severity)}</span>
                          <p className="font-medium text-sm">{alert.productName}</p>
                        </div>
                        <p className="text-xs opacity-75 mb-1">{alert.category}</p>
                        <p className="text-xs font-medium">
                          Stock: {alert.currentStock} units
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 bg-white/50 rounded">
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          {alerts.length > 0 && (
            <div className="p-4 border-t bg-neutral-50 text-xs text-neutral-600 space-y-1">
              <p>Critical: {alerts.filter(a => a.severity === 'critical').length}</p>
              <p>Warning: {alerts.filter(a => a.severity === 'warning').length}</p>
              <p>Low: {alerts.filter(a => a.severity === 'low').length}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
