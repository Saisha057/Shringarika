"use client"

import type React from "react"

import { useState } from "react"
import { X, Bell } from "lucide-react"
import { useAdmin } from "../context/AdminContext"

interface RestockNotificationModalProps {
  productId: string | number
  size: string
  isOpen: boolean
  onClose: () => void
}

export function RestockNotificationModal({ productId, size, isOpen, onClose }: RestockNotificationModalProps) {
  const { addRestockNotification } = useAdmin()
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    if (email) {
      addRestockNotification(email, productId, size)
      setSubmitted(true)
      setTimeout(() => {
        setEmail("")
        setSubmitted(false)
        onClose()
      }, 2500)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <h2 className="text-base md:text-lg tracking-wider font-semibold">Notify Me</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-700 font-semibold text-sm md:text-base mb-2">Success!</p>
              <p className="text-green-600 text-xs md:text-sm">
                We'll send you an email notification at <strong>{email}</strong> when this size is back in stock.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs md:text-sm text-neutral-600">
              Enter your email and we'll notify you when size <strong>{size}</strong> is available again.
            </p>

            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError("")
                }}
                placeholder="your@email.com"
                className={`w-full px-3 md:px-4 py-2 md:py-3 border rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base ${
                  error ? "border-red-300 bg-red-50" : "border-neutral-300"
                }`}
                required
              />
              {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
            </div>

            <div className="flex gap-2 md:gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 md:px-4 py-2 md:py-3 border border-neutral-300 rounded hover:bg-neutral-100 transition-colors text-xs md:text-sm tracking-wider font-semibold"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-black text-white rounded hover:bg-neutral-900 transition-colors text-xs md:text-sm tracking-wider font-semibold"
              >
                NOTIFY ME
              </button>
            </div>

            <p className="text-xs text-neutral-500 text-center">We'll never spam. Only restock notifications.</p>
          </form>
        )}
      </div>
    </div>
  )
}
