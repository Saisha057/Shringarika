"use client"

import { useState, useEffect, useRef } from "react"
import { X, Send, Bot, Minimize2, RefreshCw } from "lucide-react"
import { useAuth } from "../context/AuthContext"

interface ChatMessage {
  id: string
  text: string
  isBot: boolean
  timestamp: string
  options?: string[]
}

const BOT_RESPONSES = {
  greeting: [
    "Hello! 👋 I'm your shopping assistant. How can I help you today?",
    "Hi there! Welcome to Shringarika. What can I assist you with?",
    "Hey! I'm here to help with your shopping. What do you need?",
  ],
  products: [
    "We have a beautiful collection of traditional Indian wear! Would you like to see:\n• Sarees\n• Lehengas\n• Suits\n• Accessories",
    "Our product range includes ethnic wear for all occasions. What are you looking for?",
  ],
  orders: [
    "To track your order, please visit the 'My Orders' section in your account. You'll need your order ID.",
    "I can help with orders! Do you want to:\n• Track an order\n• Cancel an order\n• Check delivery status",
  ],
  shipping: [
    "We offer free shipping on orders above ₹999. Standard delivery takes 5-7 business days.",
    "Shipping information:\n• Free shipping: Orders ₹999+\n• Standard: 5-7 days\n• Express: 2-3 days (₹199)",
  ],
  returns: [
    "We have a 7-day easy return policy. Items must be unused with tags attached.",
    "Returns are simple! Just:\n1. Go to My Orders\n2. Select the item\n3. Click 'Return'\n4. We'll arrange pickup",
  ],
  payment: [
    "We accept:\n• Credit/Debit Cards\n• UPI\n• Net Banking\n• Cash on Delivery\n• Wallets",
    "All major payment methods are supported including cards, UPI, and COD.",
  ],
  size: [
    "Need help with sizing? Check our size guide or use our AI size recommender tool!",
    "For size assistance:\n• Check size chart on product page\n• Use our size recommendation tool\n• Contact support for personalized help",
  ],
  contact: [
    "You can reach us at:\n📧 support@shringarika.com\n📞 +91-1234567890\n⏰ Mon-Sat: 9AM-7PM",
    "Contact our support team via email or phone. We're here to help!",
  ],
  help: [
    "I can help you with:\n• Product information\n• Order tracking\n• Shipping & delivery\n• Returns & refunds\n• Size guide\n• Payment methods",
    "How can I assist you? I can help with products, orders, shipping, returns, or general questions.",
  ],
  default: [
    "I'm not sure I understand. Could you rephrase that?",
    "I didn't quite get that. Try asking about products, orders, shipping, or returns.",
    "Hmm, I'm still learning! Can you ask something else?",
  ],
}

const QUICK_REPLIES = [
  "Track my order",
  "Return policy",
  "Shipping info",
  "Size guide",
  "Browse products",
  "Payment methods",
  "Contact support",
]

export function Chatbot() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Welcome message
      addBotMessage(getRandomResponse('greeting'))
    }
  }, [isOpen])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const getRandomResponse = (category: keyof typeof BOT_RESPONSES): string => {
    const responses = BOT_RESPONSES[category]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  const detectIntent = (message: string): keyof typeof BOT_RESPONSES => {
    const lowerMessage = message.toLowerCase()
    
    if (/\b(hi|hello|hey|greetings)\b/i.test(lowerMessage)) return 'greeting'
    if (/\b(product|saree|lehenga|dress|buy|shop|collection)\b/i.test(lowerMessage)) return 'products'
    if (/\b(order|track|delivery|status|where.*order)\b/i.test(lowerMessage)) return 'orders'
    if (/\b(ship|shipping|delivery time|how long)\b/i.test(lowerMessage)) return 'shipping'
    if (/\b(return|refund|exchange|cancel)\b/i.test(lowerMessage)) return 'returns'
    if (/\b(pay|payment|cod|upi|card)\b/i.test(lowerMessage)) return 'payment'
    if (/\b(size|fit|measurement|too big|too small)\b/i.test(lowerMessage)) return 'size'
    if (/\b(contact|support|help|call|email)\b/i.test(lowerMessage)) return 'contact'
    if (/\b(help|assist|guide)\b/i.test(lowerMessage)) return 'help'
    
    return 'default'
  }

  const addBotMessage = (text: string, options?: string[]) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      isBot: true,
      timestamp: new Date().toISOString(),
      options,
    }
    setMessages(prev => [...prev, newMessage])
  }

  const handleSendMessage = (text?: string) => {
    const messageText = text || inputValue.trim()
    if (!messageText) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      isBot: false,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue("")

    // Show typing indicator
    setIsTyping(true)

    // Simulate bot thinking
    setTimeout(() => {
      setIsTyping(false)
      const intent = detectIntent(messageText)
      const response = getRandomResponse(intent)
      addBotMessage(response)
    }, 800 + Math.random() * 1200)
  }

  const handleQuickReply = (reply: string) => {
    handleSendMessage(reply)
  }

  const handleReset = () => {
    setMessages([])
    addBotMessage(getRandomResponse('greeting'))
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-40 p-4 bg-purple-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform"
        title="Chat with AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </button>
    )
  }

  return (
    <div className={`fixed bottom-24 right-6 z-40 bg-white rounded-lg shadow-2xl border border-purple-200 flex flex-col transition-all ${
      isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <span className="font-medium">AI Shopping Assistant</span>
          <span className="h-2 w-2 rounded-full bg-green-400"></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-1 hover:bg-purple-500 rounded transition-colors"
            title="Reset conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-purple-500 rounded transition-colors"
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-purple-500 rounded transition-colors"
            title="Close chatbot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-purple-50 to-white">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.isBot ? 'justify-start' : 'justify-end'
                }`}
              >
                {message.isBot && (
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[75%] ${message.isBot ? '' : 'order-1'}`}>
                  <div className={`rounded-lg p-3 whitespace-pre-line ${
                    message.isBot
                      ? 'bg-white text-neutral-900 shadow-sm border border-purple-100'
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                  }`}>
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.isBot ? 'text-neutral-400' : 'text-purple-200'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-2 items-center">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm border border-purple-100">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t bg-purple-50">
              <p className="text-xs text-neutral-600 mb-2">Quick options:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.slice(0, 4).map((reply) => (
                  <button
                    key={reply}
                    onClick={() => handleQuickReply(reply)}
                    className="px-3 py-1 text-xs bg-white border border-purple-200 rounded-full hover:bg-purple-100 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
