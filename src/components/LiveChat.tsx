"use client"

import { useState, useEffect, useRef } from "react"
import { X, Send, MessageCircle, User, Minimize2 } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { io, Socket } from "socket.io-client"

interface Message {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: string
  isAdmin?: boolean
}

export function LiveChat() {
  const { user } = useAuth()
  const socketOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '')
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (isOpen && !socketRef.current) {
      // Connect to Socket.io server
      const socket = io(socketOrigin, {
        query: {
          userId: user?.id || 'guest',
          userName: user?.name || 'Guest',
        },
      })

      socket.on('connect', () => {
        console.log('✅ Connected to chat server')
        setIsConnected(true)
      })

      socket.on('disconnect', () => {
        console.log('❌ Disconnected from chat server')
        setIsConnected(false)
      })

      socket.on('message', (message: Message) => {
        console.log('📨 Received message:', message)
        setMessages(prev => [...prev, message])
        
        // Increment unread count if chat is minimized
        if (isMinimized || !isOpen) {
          setUnreadCount(prev => prev + 1)
        }
      })

      socket.on('user_typing', (data: { userId: string; userName: string }) => {
        if (data.userId !== user?.id) {
          setIsTyping(true)
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
          }
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000)
        }
      })

      socket.on('chat_history', (history: Message[]) => {
        console.log('📚 Received chat history:', history.length, 'messages')
        setMessages(history)
      })

      socketRef.current = socket
    }

    return () => {
      if (socketRef.current && !isOpen) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [isOpen, user?.id, user?.name, socketOrigin])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Reset unread count when chat is opened
    if (isOpen && !isMinimized) {
      setUnreadCount(0)
    }
  }, [isOpen, isMinimized])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !socketRef.current) return

    const message: Message = {
      id: Date.now().toString(),
      senderId: user?.id || 'guest',
      senderName: user?.name || 'Guest',
      text: newMessage,
      timestamp: new Date().toISOString(),
      isAdmin: false,
    }

    socketRef.current.emit('send_message', message)
    setMessages(prev => [...prev, message])
    setNewMessage("")
  }

  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', {
        userId: user?.id || 'guest',
        userName: user?.name || 'Guest',
      })
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
    if (!isMinimized) {
      setUnreadCount(0)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-black text-white rounded-full shadow-lg hover:scale-110 transition-transform"
        title="Chat with us"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 bg-white rounded-lg shadow-2xl border border-neutral-200 flex flex-col transition-all ${
      isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-black text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">Live Chat</span>
          {isConnected && <span className="h-2 w-2 rounded-full bg-green-400"></span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMinimize}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-neutral-700 rounded transition-colors"
            title="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-neutral-500 py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Start a conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${
                    message.senderId === user?.id ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.senderId !== user?.id && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center">
                        {message.isAdmin ? (
                          <span className="text-xs font-medium">A</span>
                        ) : (
                          <User className="h-4 w-4 text-neutral-600" />
                        )}
                      </div>
                    </div>
                  )}
                  <div className={`max-w-[70%] ${
                    message.senderId === user?.id ? 'order-1' : ''
                  }`}>
                    <div className={`text-xs text-neutral-500 mb-1 ${
                      message.senderId === user?.id ? 'text-right' : ''
                    }`}>
                      {message.senderName}
                    </div>
                    <div className={`rounded-lg p-3 ${
                      message.senderId === user?.id
                        ? 'bg-black text-white'
                        : 'bg-neutral-100 text-neutral-900'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                      <p className={`text-xs mt-1 ${
                        message.senderId === user?.id
                          ? 'text-neutral-400'
                          : 'text-neutral-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isTyping && (
              <div className="flex gap-2 items-center text-neutral-500 text-sm">
                <div className="flex gap-1">
                  <div className="h-2 w-2 bg-neutral-400 rounded-full animate-bounce"></div>
                  <div className="h-2 w-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="h-2 w-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span>Someone is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  handleTyping()
                }}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-sm"
                disabled={!isConnected}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !isConnected}
                className="px-4 py-2 bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {!isConnected && (
              <p className="text-xs text-red-500 mt-2">Connecting to chat server...</p>
            )}
          </form>
        </>
      )}
    </div>
  )
}
