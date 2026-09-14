import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Download,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PaymentMode, ExpenseCategory } from '../../types';
import { generateReceiptPDF } from '../../utils/pdfGenerator';

export const FinanceView: React.FC = () => {
  const {
    filteredProjects,
    filteredPayments,
    filteredExpenses,
    companies,
    clients,
    createPayment,
    createExpense,
    canManageFinance,
    brandFilter,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'expenses'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // New Payment Form
  const [payProjectId, setPayProjectId] = useState(filteredProjects[0]?.id || '');
  const [payAmount, setPayAmount] = useState(2500);
  const [payMode, setPayMode] = useState<PaymentMode>('Bank Transfer');
  const [payDesc, setPayDesc] = useState('Milestone Retainer Payment');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // New Expense Form
  const [expProjectId, setExpProjectId] = useState(filteredProjects[0]?.id || '');
  const [expAmount, setExpAmount] = useState(450);
  const [expCat, setExpCat] = useState<ExpenseCategory>('Crew Travel');
  const [expDesc, setExpDesc] = useState('Airfare and local transport');
  const [expPaidTo, setExpPaidTo] = useState('Delta Airlines');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  if (!canManageFinance) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 space-y-3">
        <div className="w-16 h-16 rounded-full bg-[#F1D099]/30 border border-[#F1D099]/50 flex items-center justify-center mx-auto text-[#8c672b]">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          The Financial Accounting module is only available to Studio Admins and Managers. Please switch user roles in the top bar to inspect finance operations.
        </p>
      </div>
    );
  }

  // Financial calculations
  const totalPipeline = filteredProjects.reduce((sum, p) => sum + p.total_amount, 0);
  const totalReceived = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const pendingReceivables = Math.max(0, totalPipeline - totalReceived);
  const netMargin = totalReceived - totalExpenses;
  const marginPercentage = totalReceived > 0 ? Math.round((netMargin / totalReceived) * 100) : 0;

  // Project by Project Profit Breakdown
  const projectProfits = filteredProjects.map(p => {
    const pPayments = filteredPayments.filter(pm => pm.project_id === p.id);
    const pExpenses = filteredExpenses.filter(pe => pe.project_id === p.id);
    const received = pPayments.reduce((s, pm) => s + pm.amount, 0);
    const cost = pExpenses.reduce((s, pe) => s + pe.amount, 0);
    const profit = received - cost;
    const balance = Math.max(0, p.total_amount - received);

    return {
      project: p,
      contract: p.total_amount,
      received,
      cost,
      profit,
      balance,
    };
  });

  const handleDownloadReceipt = (payment: any) => {
    const project = filteredProjects.find(p => p.id === payment.project_id);
    const client = clients.find(c => c.id === project?.client_id);
    const company = companies.find(c => c.id === payment.company_id) || companies[0];

    const doc = generateReceiptPDF(payment, project, client, company);
    doc.save(`Receipt_${company.code.toUpperCase()}_${payment.receipt_number}.pdf`);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = filteredProjects.find(p => p.id === payProjectId);
    if (!proj) return;

    await createPayment({
      project_id: proj.id,
      company_id: proj.company_id,
      amount: payAmount,
      payment_mode: payMode,
      description: payDesc,
      payment_date: payDate,
      receipt_number: `REC-${proj.company_id.toUpperCase()}-${Date.now().toString().slice(-4)}`,
    });

    setShowPaymentModal(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const proj = filteredProjects.find(p => p.id === expProjectId);
    if (!proj) return;

    await createExpense({
      project_id: proj.id,
      company_id: proj.company_id,
      amount: expAmount,
      category: expCat,
      description: expDesc,
      paid_to: expPaidTo,
      expense_date: expDate,
    });

    setShowExpenseModal(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Financial Ledger & Profitability
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time revenues, project profit margins, client receipts, and production expenses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* 5 Financial Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Gross Contract Pipeline</div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
            ${totalPipeline.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{filteredProjects.length} weddings committed</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Cleared Inflow (Collected)</div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2">
            ${totalReceived.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {totalPipeline > 0 ? Math.round((totalReceived / totalPipeline) * 100) : 0}% collected
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Awaiting Collection</div>
          <div className="text-xl sm:text-2xl font-bold text-[#8c672b] mt-2">
            ${pendingReceivables.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#8c672b] mt-1">Scheduled installments</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Direct Cost of Production</div>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 mt-2">
            ${totalExpenses.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Crew, travel, gear, edit fees</div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-slate-900 text-white p-4 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Net Collected Margin</span>
            <Sparkles className="w-4 h-4 text-[#F1D099]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#F1D099] mt-2">
            ${netMargin.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-300 mt-1">
            {marginPercentage}% operational margin
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Project Profitability Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'payments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Payment Receipts Ledger ({filteredPayments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'expenses'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Expense Log (${totalExpenses.toLocaleString()})</span>
        </button>
      </div>

      {/* TAB 1: PROJECT PROFITABILITY TABLE */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Project Profit Margins & Balances
            </h3>
            <span className="text-xs text-slate-500">
              Live calculations based on verified receipts and logged vendor vouchers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Wedding Project</th>
                  <th className="p-3.5">Brand</th>
                  <th className="p-3.5 text-right">Contract Fee</th>
                  <th className="p-3.5 text-right">Collected</th>
                  <th className="p-3.5 text-right">Pending Balance</th>
                  <th className="p-3.5 text-right">Expenses</th>
                  <th className="p-3.5 text-right font-bold text-slate-900">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectProfits.map(({ project, contract, received, cost, profit, balance }) => {
                  const isTWB = project.company_id === 'twb';
                  return (
                    <tr key={project.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-900">
                        {project.name}
                        <div className="text-[11px] text-slate-400 font-normal">
                          {project.wedding_date_start} • {project.venue}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            isTWB ? 'bg-blue-100 text-blue-800' : 'bg-[#F1D099]/25 text-[#5e430c] border border-[#F1D099]/40'
                          }`}
                        >
                          {isTWB ? 'TWB' : 'Golden June'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-800">
                        ${contract.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-semibold text-emerald-700">
                        ${received.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right text-[#8c672b] font-medium">
                        ${balance.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right text-rose-600">
                        ${cost.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-bold text-blue-900">
                        ${profit.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENTS & RECEIPT GENERATOR */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recorded Client Receipts & Bank Transfers
            </h3>
            <span className="text-xs text-slate-500">
              Click 'Receipt PDF' to generate on-demand formal payment vouchers.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Receipt #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Wedding Project</th>
                  <th className="p-3.5">Payment Method</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5 text-right">Amount Paid</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map(p => {
                  const project = filteredProjects.find(pr => pr.id === p.project_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-mono text-[11px] font-bold text-slate-900">
                        {p.receipt_number}
                      </td>
                      <td className="p-3.5 text-slate-600">{p.payment_date}</td>
                      <td className="p-3.5 font-semibold text-slate-900">
                        {project?.name || 'Wedding'}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border">
                          {p.payment_mode}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">{p.description}</td>
                      <td className="p-3.5 text-right font-bold text-emerald-700 text-sm">
                        +${p.amount.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleDownloadReceipt(p)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-md border border-blue-200 transition-colors inline-flex items-center gap-1"
                          title="Generate printable Receipt PDF"
                        >
                          <Download className="w-3 h-3" />
                          <span>Receipt PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Itemized Production Expenses & Vendor Payouts
            </h3>
            <span className="text-xs text-slate-500">
              Total Logged: ${totalExpenses.toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Project</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Vendor / Payee</th>
                  <th className="p-3.5">Expense Details</th>
                  <th className="p-3.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(e => {
                  const project = filteredProjects.find(pr => pr.id === e.project_id);
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 text-slate-600">{e.expense_date}</td>
                      <td className="p-3.5 font-semibold text-slate-900">
                        {project?.name || 'Studio General'}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border">
                          {e.category}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium text-slate-800">{e.paid_to}</td>
                      <td className="p-3.5 text-slate-600">{e.description}</td>
                      <td className="p-3.5 text-right font-bold text-rose-600 text-sm">
                        -${e.amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 my-8">
            <h2 className="text-base font-bold text-slate-900 mb-4">Record Client Payment Receipt</h2>
            <form onSubmit={handleAddPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Wedding Project</label>
                <select
                  value={payProjectId}
                  onChange={e => setPayProjectId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Balance: ${(p.total_amount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={payMode}
                    onChange={e => setPayMode(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Bank Transfer">Bank Transfer / Wire</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  required
                  value={payDesc}
                  onChange={e => setPayDesc(e.target.value)}
                  placeholder="e.g. 50% Milestone Retainer"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs"
                >
                  Confirm & Log Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 my-8">
            <h2 className="text-base font-bold text-slate-900 mb-4">Record Production Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Wedding Project</label>
                <select
                  value={expProjectId}
                  onChange={e => setExpProjectId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {filteredProjects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Amount ($)</label>
                  <input
                    type="number"
                    required
                    value={expAmount}
                    onChange={e => setExpAmount(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={expCat}
                    onChange={e => setExpCat(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Crew Travel">Crew Travel</option>
                    <option value="Equipment Rental">Equipment Rental</option>
                    <option value="Editor Fee">Editor Fee</option>
                    <option value="Accommodations">Accommodations</option>
                    <option value="Studio Gear">Studio Gear</option>
                    <option value="Music Licensing">Music Licensing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  required
                  value={expPaidTo}
                  onChange={e => setExpPaidTo(e.target.value)}
                  placeholder="e.g. LensRentals, Airbnb, Delta"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  placeholder="e.g. Sony Cinema lenses rental for wedding"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
