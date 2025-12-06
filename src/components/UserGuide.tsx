import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Book,
  Pill,
  ClipboardList,
  Package,
  Users,
  Search,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserGuide({ isOpen, onClose }: UserGuideProps) {
  interface FAQItem {
    question: string;
    answer: string;
    category: string;
  }

  const [activeTab, setActiveTab] = useState<'guide' | 'faq'>('guide');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const guideSteps = [
    {
      icon: Users,
      title: '1. Getting Started',
      description: 'Log in with your credentials provided by the administrator.',
      tips: [
        'First-time users need admin approval',
        'Your role determines what features you can access',
        'Contact admin if you forget your password',
      ],
    },
    {
      icon: Search,
      title: '2. Searching Medications',
      description: 'Use the search bar to find medications quickly.',
      tips: [
        'Search by medication name or category',
        'Filter by availability status',
        'Click any medication card for detailed information',
      ],
    },
    {
      icon: Pill,
      title: '3. Dispensing Medication',
      description: 'Click a medication, then the "Dispense" button to record dispensing.',
      tips: [
        'Fill in patient ID (required)',
        'Select the lot number from available inventory',
        'Enter dose instructions clearly',
        'Add physician and student names if applicable',
      ],
    },
    {
      icon: Package,
      title: '4. Managing Inventory',
      description: 'Keep track of medication lots and expiration dates.',
      tips: [
        'Add new lots when stock arrives',
        'Update quantities after dispensing',
        'Check expiration dates regularly',
        'Low stock items are highlighted in red',
      ],
    },
    {
      icon: ClipboardList,
      title: '5. Viewing Dispensing Logs',
      description: 'Access the complete history of all dispensed medications.',
      tips: [
        'Use filters to find specific records',
        'Export data for reports if needed',
        'Withdrawal option available for 10 seconds after dispensing',
      ],
    },
  ];

  const faqs: FAQItem[] = [
    // Getting Started
    {
      category: 'Getting Started',
      question: 'How do I create an account?',
      answer:
        'Click "Register" on the login page, fill in your information, and wait for admin approval. You\'ll receive a notification once your account is approved.',
    },
    {
      category: 'Getting Started',
      question: "Why can't I log in?",
      answer:
        "Make sure your account has been approved by an administrator. Check your email for caps lock, and ensure you're using the correct password. If issues persist, contact your administrator.",
    },
    {
      category: 'Getting Started',
      question: 'What do the different user roles mean?',
      answer:
        'Admin: Full access to all features. Staff: Can dispense medications and manage inventory. Physician/Student: Can view and dispense medications.',
    },

    // Dispensing
    {
      category: 'Dispensing',
      question: 'What is a Patient ID?',
      answer:
        'A Patient ID is a unique identifier for each patient, typically in the format "YYYY-XXX" (e.g., "2025-196"). This ensures patient privacy while tracking dispensing records.',
    },
    {
      category: 'Dispensing',
      question: 'Can I undo a dispensing record?',
      answer:
        'Yes! Immediately after dispensing, you\'ll see a "Withdraw" button on the success notification. This is available for 10 seconds. After that, contact an administrator to correct the record.',
    },
    {
      category: 'Dispensing',
      question: 'What if I select the wrong lot number?',
      answer:
        'You can use the withdrawal feature within 10 seconds, or create a new dispensing record with the correct lot. The system tracks all changes in the audit log.',
    },
    {
      category: 'Dispensing',
      question: "Why can't I dispense a medication?",
      answer:
        'Check that: 1) The medication has available inventory, 2) You have the correct permissions, 3) All required fields are filled in. If issues persist, check your network connection.',
    },

    // Inventory
    {
      category: 'Inventory',
      question: 'How do I add new medication stock?',
      answer:
        'Go to a medication\'s detail page and click "Add Lot". Enter the lot number, expiration date, and quantity. This creates a new inventory entry.',
    },
    {
      category: 'Inventory',
      question: 'What happens when inventory runs out?',
      answer:
        'The medication will show as "Out of Stock" in the formulary. You won\'t be able to dispense it until new inventory is added. Add a new lot to restore availability.',
    },
    {
      category: 'Inventory',
      question: 'How are expiration dates tracked?',
      answer:
        'Each lot has its own expiration date. The system displays expiration dates when selecting lots for dispensing. Expired lots are highlighted in red.',
    },
    {
      category: 'Inventory',
      question: 'Can I edit an existing lot?',
      answer:
        'Yes, click the edit icon on any lot to update its quantity or other details. Changes are tracked in the audit log for accountability.',
    },

    // Searching
    {
      category: 'Searching',
      question: 'How do I find a specific medication?',
      answer:
        'Use the search bar at the top of the formulary page. You can search by medication name, category, or filter by availability status.',
    },
    {
      category: 'Searching',
      question: 'What do the color indicators mean?',
      answer:
        'Green: In stock. Yellow: Low stock (running out soon). Red: Out of stock or expired. These help you quickly identify inventory status.',
    },

    // Technical
    {
      category: 'Technical',
      question: 'Can I use this app offline?',
      answer:
        'Yes! The app caches data so you can view information offline. However, dispensing and inventory updates require an internet connection to sync with the database.',
    },
    {
      category: 'Technical',
      question: 'What browsers are supported?',
      answer:
        'MediTrack works best on modern browsers: Chrome, Firefox, Safari, and Edge (latest versions). For mobile use, we recommend Chrome or Safari.',
    },
    {
      category: 'Technical',
      question: 'Why is the app loading slowly?',
      answer:
        'Slow loading can be due to weak internet connection or server issues. Try refreshing the page. If the issue persists, the app will load cached data automatically.',
    },
    {
      category: 'Technical',
      question: 'Is my data secure?',
      answer:
        'Yes! All data is encrypted in transit (HTTPS) and at rest. We follow HIPAA guidelines for patient data protection. Only authenticated users can access the system.',
    },

    // Administration
    {
      category: 'Administration',
      question: 'How do I approve new users?',
      answer:
        'Admins can view pending users in the Admin panel. Review their information and click "Approve" to grant access, or "Reject" to deny.',
    },
    {
      category: 'Administration',
      question: 'Can I generate reports?',
      answer:
        'Yes, the Dispensing Log tab shows all records. You can filter by date, medication, or patient, and export data for external reporting tools.',
    },
    {
      category: 'Administration',
      question: 'How do I add a new medication to the formulary?',
      answer:
        'Currently, new medications must be added through the database administrator. Contact your technical support team to add new medications to the system.',
    },
  ];

  const categories = ['all', ...Array.from(new Set(faqs.map((faq) => faq.category)))];

  const filteredFAQs =
    selectedCategory === 'all' ? faqs : faqs.filter((faq) => faq.category === selectedCategory);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-[90vw] max-w-4xl p-0 flex flex-col gap-0 overflow-hidden"
        style={{ height: 'calc(100vh - 8rem)' }}
      >
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-6 w-6 text-primary" />
            Help Center
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0">
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'guide'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Book className="h-4 w-4" />
              User Guide
            </div>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              activeTab === 'faq'
                ? 'text-primary border-b-2 border-primary'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <HelpCircle className="h-4 w-4" />
              FAQ
            </div>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <p className="text-gray-600 mb-8">
                Welcome to MediTrack! This guide will help you navigate the medication tracking
                system.
              </p>

              {guideSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                        <p className="text-gray-700 mb-3">{step.description}</p>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-900">Tips:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                            {step.tips.map((tip, tipIndex) => (
                              <li key={tipIndex}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
                <h3 className="font-semibold text-blue-900 mb-2">Need More Help?</h3>
                <p className="text-blue-800 text-sm">
                  Check the FAQ section for answers to common questions, or contact your
                  administrator for additional support.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div>
              {/* Category Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              {/* FAQ List */}
              <div className="space-y-3">
                {filteredFAQs.map((faq, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                      className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex-1">
                        <span className="text-xs font-medium text-primary mb-1 block">
                          {faq.category}
                        </span>
                        <span className="font-medium text-gray-900">{faq.question}</span>
                      </div>
                      {expandedFAQ === index ? (
                        <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 ml-4" />
                      )}
                    </button>
                    {expandedFAQ === index && (
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <p className="text-gray-700">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {filteredFAQs.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No FAQs found in this category.
                </div>
              )}
            </div>
          )}
        </div>

        
      </DialogContent>
    </Dialog>
  );
}
