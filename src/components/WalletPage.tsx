import { ChevronLeft, Wallet, Plus, TrendingUp, TrendingDown, IndianRupee, Gift, ArrowUpRight, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  orderId?: string;
}

interface WalletPageProps {
  onNavigateBack: () => void;
}

export function WalletPage({ onNavigateBack }: WalletPageProps) {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');

  const STORAGE_KEY = user?.id ? `storeCredit_${user.id}` : 'storeCredit_guest';
  const TRANSACTIONS_KEY = user?.id ? `walletTransactions_${user.id}` : 'walletTransactions_guest';

  useEffect(() => {
    loadWalletData();
  }, [user]);

  const loadWalletData = () => {
    // Load balance
    const savedBalance = localStorage.getItem(STORAGE_KEY);
    setBalance(savedBalance ? parseFloat(savedBalance) : 0);

    // Load transactions
    const savedTransactions = localStorage.getItem(TRANSACTIONS_KEY);
    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    } else {
      // Initialize with welcome bonus if first time
      const welcomeTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'credit',
        amount: 100,
        description: '🎉 Welcome Bonus',
        date: new Date().toISOString(),
      };
      setTransactions([welcomeTransaction]);
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([welcomeTransaction]));
      
      // Add welcome bonus to balance
      const newBalance = 100;
      setBalance(newBalance);
      localStorage.setItem(STORAGE_KEY, newBalance.toString());
    }
  };

  const handleAddCredit = () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Create new transaction
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      type: 'credit',
      amount: amount,
      description: 'Added to wallet',
      date: new Date().toISOString(),
    };

    // Update balance
    const newBalance = balance + amount;
    setBalance(newBalance);
    localStorage.setItem(STORAGE_KEY, newBalance.toString());

    // Update transactions
    const newTransactions = [newTransaction, ...transactions];
    setTransactions(newTransactions);
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(newTransactions));

    // Close modal and reset
    setShowAddCreditModal(false);
    setCreditAmount('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalCredits = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalDebits = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
          <button 
            onClick={onNavigateBack}
            className="flex items-center gap-2 text-sm hover:underline mb-4 text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO ACCOUNT</span>
          </button>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl tracking-wider mb-2">MY WALLET</h1>
              <p className="text-green-100">Store credit & transaction history</p>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 md:-mt-12">
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm md:text-base text-neutral-400 mb-2">AVAILABLE BALANCE</p>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-6 h-6 md:w-8 md:h-8" />
                <h2 className="text-4xl md:text-5xl font-bold">{balance.toFixed(2)}</h2>
              </div>
            </div>
            <button
              onClick={() => setShowAddCreditModal(true)}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-white text-black rounded-full text-sm tracking-wider hover:bg-neutral-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">ADD CREDIT</span>
              <span className="md:hidden">ADD</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-neutral-700">
            <div>
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-xs md:text-sm">Total Credits</span>
              </div>
              <p className="text-xl md:text-2xl font-bold">₹{totalCredits.toFixed(2)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <TrendingDown className="w-5 h-5" />
                <span className="text-xs md:text-sm">Total Spent</span>
              </div>
              <p className="text-xl md:text-2xl font-bold">₹{totalDebits.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Use Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 md:p-6 mb-8">
          <div className="flex items-start gap-3">
            <Gift className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">How to use your wallet?</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Use store credit at checkout to pay for your orders</li>
                <li>• Receive refunds directly to your wallet for returns</li>
                <li>• Get special bonuses and rewards credited automatically</li>
                <li>• Wallet credit never expires</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-2xl md:text-3xl tracking-wider mb-6">TRANSACTION HISTORY</h2>
          
          {transactions.length === 0 ? (
            <div className="text-center py-16 md:py-20 border border-neutral-200 rounded-lg">
              <Clock className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <h3 className="text-xl tracking-wider mb-2">NO TRANSACTIONS YET</h3>
              <p className="text-neutral-600">
                Your wallet transactions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 md:p-6 border border-neutral-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 ${
                      transaction.type === 'credit' 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                    }`}>
                      {transaction.type === 'credit' ? (
                        <TrendingUp className={`w-5 h-5 md:w-6 md:h-6 text-green-600`} />
                      ) : (
                        <TrendingDown className={`w-5 h-5 md:w-6 md:h-6 text-red-600`} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm md:text-base font-medium mb-1">{transaction.description}</p>
                      <p className="text-xs md:text-sm text-neutral-600">{formatDate(transaction.date)}</p>
                      {transaction.orderId && (
                        <p className="text-xs text-neutral-500 mt-1">Order #{transaction.orderId}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg md:text-xl font-bold ${
                      transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Credit Modal */}
      {showAddCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
          <div className="bg-white rounded-lg max-w-md w-full animate-slideUp">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl tracking-wider">ADD CREDIT</h2>
              <p className="text-green-100 text-sm mt-1">Add money to your wallet</p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-sm tracking-wider mb-2">AMOUNT (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-neutral-300 rounded-lg text-lg focus:outline-none focus:border-green-600"
                    placeholder="Enter amount"
                    min="1"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCreditAmount(amount.toString())}
                    className="py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50 transition-colors"
                  >
                    +₹{amount}
                  </button>
                ))}
              </div>

              {/* Payment Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <ArrowUpRight className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    <strong>Demo Mode:</strong> In production, this would redirect to a payment gateway.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddCredit}
                  disabled={!creditAmount || parseFloat(creditAmount) <= 0}
                  className={`flex-1 py-3 rounded-full text-sm tracking-wider transition-colors ${
                    creditAmount && parseFloat(creditAmount) > 0
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  ADD ₹{creditAmount || '0'}
                </button>
                <button
                  onClick={() => {
                    setShowAddCreditModal(false);
                    setCreditAmount('');
                  }}
                  className="px-6 py-3 border border-neutral-300 rounded-full text-sm tracking-wider hover:bg-neutral-50 transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
