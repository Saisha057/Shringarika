import { ChevronLeft, Mail, Phone, Send, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import API from '../lib/api';
import { 
  validateEmail,
  validatePhone,
  validateName,
  sanitizeText,
  rateLimiter
} from '../utils/validation';

interface ContactUsPageProps {
  onNavigateHome: () => void;
  onNavigateFAQ?: () => void;
}

export function ContactUsPage({ onNavigateHome, onNavigateFAQ }: ContactUsPageProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateLimitError, setRateLimitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setRateLimitError('');

    // Rate limiting for contact form
    const rateLimitKey = `contact:${sanitizeText(formData.email)}`;
    if (!rateLimiter.isAllowed(rateLimitKey, 3, 600000)) { // 3 attempts per 10 minutes
      const retryAfter = rateLimiter.getRetryAfter(rateLimitKey, 600000);
      setRateLimitError(`Too many contact attempts. Please try again in ${Math.ceil(retryAfter)} seconds.`);
      return;
    }

    // Validate form
    const newErrors: Record<string, string> = {};

    const nameValidation = validateName(formData.name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.error || 'Invalid name';
    }

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      newErrors.email = emailValidation.error || 'Invalid email';
    }

    if (formData.phone) {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.valid) {
        newErrors.phone = phoneValidation.error || 'Invalid phone number';
      }
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.length < 3) {
      newErrors.subject = 'Subject must be at least 3 characters';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Send sanitized data to backend
    // IMPORTANT: email must NOT be passed through a generic HTML sanitizer
    // (e.g. DOMPurify) — just trim and lowercase it after validation.
    const sanitizedData = {
      name:    sanitizeText(formData.name),
      email:   formData.email.trim().toLowerCase(),  // raw email: trim + lowercase only
      phone:   formData.phone.trim(),                 // raw phone: trim only
      subject: sanitizeText(formData.subject),
      message: sanitizeText(formData.message),
    };
    
    try {
      const response = await API.post('/contact', sanitizedData);
      
      if (response.data.success) {
        console.log('✅ Contact form submitted successfully');
        rateLimiter.reset(rateLimitKey);
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
        }, 3000);
      }
    } catch (error: any) {
      console.error('❌ Failed to send contact form:', error);
      // Log the exact backend response so we can debug without guessing
      if (error.response) {
        console.error('   → Backend status :', error.response.status);
        console.error('   → Backend message:', error.response.data);
      }
      const backendMessage =
        error.response?.data?.message ||
        error.response?.data?.error  ||
        'Failed to send message. Please try again later.';
      setRateLimitError(backendMessage);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <h1 className="text-5xl tracking-wider mb-2">CONTACT US</h1>
          <p className="text-neutral-600">We'd love to hear from you</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl tracking-wider mb-6">SEND US A MESSAGE</h2>
            
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <p className="text-green-800 tracking-wider">
                  Thank you! Your message has been sent successfully.
                </p>
              </div>
            ) : null}

            {/* Rate Limit Error */}
            {rateLimitError && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-orange-600 text-sm">{rateLimitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm tracking-wider mb-2">NAME *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setErrors({ ...errors, name: '' });
                  }}
                  className={`w-full border ${errors.name ? 'border-red-500' : 'border-neutral-300'} rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors`}
                  placeholder="Your full name"
                />
                {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">EMAIL *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setErrors({ ...errors, email: '' });
                  }}
                  className={`w-full border ${errors.email ? 'border-red-500' : 'border-neutral-300'} rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors`}
                  placeholder="your.email@example.com"
                />
                {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">PHONE</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    setErrors({ ...errors, phone: '' });
                  }}
                  className={`w-full border ${errors.phone ? 'border-red-500' : 'border-neutral-300'} rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors`}
                  placeholder="Your phone number"
                />
                {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">SUBJECT *</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => {
                    setFormData({ ...formData, subject: e.target.value });
                    setErrors({ ...errors, subject: '' });
                  }}
                  className={`w-full border ${errors.subject ? 'border-red-500' : 'border-neutral-300'} rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors`}
                  placeholder="What is this about?"
                />
                {errors.subject && <p className="text-red-600 text-xs mt-1">{errors.subject}</p>}
              </div>

              <div>
                <label className="block text-sm tracking-wider mb-2">MESSAGE *</label>
                <textarea
                  required
                  value={formData.message}
                  onChange={(e) => {
                    setFormData({ ...formData, message: e.target.value });
                    setErrors({ ...errors, message: '' });
                  }}
                  rows={6}
                  className={`w-full border ${errors.message ? 'border-red-500' : 'border-neutral-300'} rounded px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors resize-none`}
                  placeholder="Tell us more about your inquiry..."
                />
                {errors.message && <p className="text-red-600 text-xs mt-1">{errors.message}</p>}
              </div>

              <button
                type="submit"
                className="bg-black text-white px-8 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                SEND MESSAGE
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-2xl tracking-wider mb-6">GET IN TOUCH</h2>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-start gap-4 p-6 bg-neutral-50 rounded-lg">
                <Mail className="w-6 h-6 text-black flex-shrink-0 mt-1" />
                <div>
                  <h3 className="tracking-wider mb-2">Email Us</h3>
                  <p className="text-neutral-600 mb-1">shringarika11@gmail.com</p>
                  <p className="text-sm text-neutral-500">We'll respond within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-neutral-50 rounded-lg">
                <Phone className="w-6 h-6 text-black flex-shrink-0 mt-1" />
                <div>
                  <h3 className="tracking-wider mb-2">Call Us</h3>
                  <p className="text-neutral-600 mb-1">+91 98765 43210</p>
                  <p className="text-sm text-neutral-500">Mon-Sat: 10 AM - 8 PM</p>
                </div>
              </div>
            </div>

            {/* FAQ Link */}
            <div className="p-6 bg-black text-white rounded-lg">
              <h3 className="tracking-wider mb-2">FREQUENTLY ASKED QUESTIONS</h3>
              <p className="text-sm text-neutral-300 mb-4">
                Find answers to common questions about orders, shipping, and returns.
              </p>
              <button
                onClick={onNavigateFAQ}
                className="text-sm underline hover:no-underline"
              >
                View FAQs →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
