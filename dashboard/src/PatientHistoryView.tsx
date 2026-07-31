import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  ChevronRight, 
  FileText, 
  ShieldAlert, 
  CheckCircle, 
  Clock, 
  Download, 
  ArrowUpRight,
  Activity,
  Heart,
  TrendingUp,
  AlertTriangle,
  X,
  SlidersHorizontal
} from 'lucide-react';

export interface PatientRecord {
  id: number;
  patientId: string;
  name: string;
  age: number;
  sex: string;
  diagnosisDate: string;
  diagnosisTime: string;
  riskScore: number;
  category: 'High Risk' | 'Moderate Risk' | 'Low Risk';
  modelUsed: string;
  confidence: number;
  restingBP: number;
  cholesterol: number;
  maxHR: number;
  fastingBS: number;
  restingECG: string;
  chestPainType: string;
  exerciseAngina: string;
  stSlope: string;
  oldpeak: number;
  clinicalAction: string;
  doctorAssigned: string;
  notes: string;
}

// Generates realistic diagnosed patient history data
function generatePatientHistory(): PatientRecord[] {
  const names = [
    'Eleanor Vance', 'David Rodriguez', 'Sarah Jenkins', 'Michael Chang', 'Emily Watson',
    'Robert Martinez', 'Patricia Taylor', 'James Wilson', 'Linda Anderson', 'Thomas Wright',
    'Barbara Miller', 'Charles Davis', 'Susan Garcia', 'Joseph Hernandez', 'Jessica Lopez',
    'Richard Gonzalez', 'Karen Perez', 'Christopher Torres', 'Nancy Flores', 'Daniel Ramirez',
    'Margaret Scott', 'Matthew Rivera', 'Betty Coleman', 'Anthony Howard', 'Sandra Ward',
    'Mark Cox', 'Ashley Diaz', 'Steven Richardson', 'Kimberly Wood', 'Paul Morales',
    'Donna Long', 'Andrew Foster', 'Michelle Sanders', 'Joshua Ross', 'Amanda Morales'
  ];

  const models = [
    'XGBoost Classifier (91.8% AUC)',
    'Deep Neural Network (DNN)',
    'Random Forest (Ensemble)',
    'SVM (RBF Kernel)',
    'Logistic Regression (Baseline)'
  ];

  const actions = [
    'Referred to Interventional Cardiology',
    'Prescribed Statin & Beta-Blocker',
    'Scheduled 30-Day Follow-Up ECG',
    'Routine Annual Monitoring',
    'Admitted for Diagnostic Angiography',
    'Lifestyle Modification & Diet Plan',
    'Cardiac Rehabilitation Program'
  ];

  const doctors = ['Dr. Alex Carter', 'Dr. Sarah Lin', 'Dr. Marcus Vance', 'Dr. Elena Rostova'];

  return names.map((name, i) => {
    // Seeded determinism
    const pId = `P-2026-${String(i + 101).padStart(4, '0')}`;
    const age = 38 + ((i * 7) % 42);
    const sex = i % 2 === 0 ? 'Male' : 'Female';
    const riskScore = Math.min(98, Math.max(12, ((i * 19 + 23) % 87) + 10));
    
    let category: PatientRecord['category'] = 'Low Risk';
    if (riskScore >= 70) category = 'High Risk';
    else if (riskScore >= 40) category = 'Moderate Risk';

    const day = String((i % 28) + 1).padStart(2, '0');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'][(i % 7)];
    const year = '2026';
    const diagnosisDate = `${month} ${day}, ${year}`;
    const diagnosisTime = `${8 + (i % 9)}:${(i * 13) % 60 < 10 ? '0' : ''}${(i * 13) % 60} ${i % 2 === 0 ? 'AM' : 'PM'}`;

    const bp = 115 + ((i * 13) % 55);
    const chol = 175 + ((i * 29) % 150);
    const maxHR = 110 + ((i * 17) % 75);
    const fastingBS = riskScore > 65 ? (i % 2) : 0;
    const cp = ['ATA', 'NAP', 'ASY', 'TA'][i % 4];
    const ecg = ['Normal', 'ST', 'LVH'][i % 3];
    const angina = riskScore > 60 && i % 2 === 0 ? 'Yes' : 'No';
    const slope = ['Up', 'Flat', 'Down'][i % 3];
    const oldpeak = Math.round(((i * 0.4) % 3.8) * 10) / 10;

    return {
      id: i + 1,
      patientId: pId,
      name,
      age,
      sex,
      diagnosisDate,
      diagnosisTime,
      riskScore,
      category,
      modelUsed: models[i % models.length],
      confidence: Math.round((88 + (i % 11) * 1.1) * 10) / 10,
      restingBP: bp,
      cholesterol: chol,
      maxHR,
      fastingBS,
      restingECG: ecg,
      chestPainType: cp,
      exerciseAngina: angina,
      stSlope: slope,
      oldpeak,
      clinicalAction: actions[i % actions.length],
      doctorAssigned: doctors[i % doctors.length],
      notes: `Patient presented with ${cp} symptoms. Baseline ECG indicates ${ecg}. Risk score evaluated at ${riskScore}%.`
    };
  });
}

const HISTORICAL_RECORDS = generatePatientHistory();

interface PatientHistoryViewProps {
  onSelectPatientReport?: (patient: any) => void;
}

export default function PatientHistoryView({ onSelectPatientReport }: PatientHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'High Risk' | 'Moderate Risk' | 'Low Risk'>('All');
  const [selectedRecord, setSelectedRecord] = useState<PatientRecord | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'riskScore' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredRecords = useMemo(() => {
    let result = HISTORICAL_RECORDS;

    if (selectedCategory !== 'All') {
      result = result.filter(r => r.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(q) ||
        r.patientId.toLowerCase().includes(q) ||
        r.modelUsed.toLowerCase().includes(q) ||
        r.clinicalAction.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'riskScore') cmp = a.riskScore - b.riskScore;
      else if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = new Date(a.diagnosisDate).getTime() - new Date(b.diagnosisDate).getTime();
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [selectedCategory, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const total = HISTORICAL_RECORDS.length;
    const high = HISTORICAL_RECORDS.filter(r => r.category === 'High Risk').length;
    const mod = HISTORICAL_RECORDS.filter(r => r.category === 'Moderate Risk').length;
    const low = HISTORICAL_RECORDS.filter(r => r.category === 'Low Risk').length;
    const avgRisk = Math.round(HISTORICAL_RECORDS.reduce((acc, r) => acc + r.riskScore, 0) / total);
    return { total, high, mod, low, avgRisk };
  }, []);

  const getBadgeStyle = (category: PatientRecord['category']) => {
    if (category === 'High Risk') return { bg: '#fef2f2', color: '#be123c', border: '#fecaca' };
    if (category === 'Moderate Risk') return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
    return { bg: '#f0fdf4', color: '#047857', border: '#bbf7d0' };
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
            Patient Diagnostic History
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', margin: 0 }}>
            Archive of all previously diagnosed patient records, AI predictions, and clinical telemetry logs.
          </p>
        </div>

        <button 
          onClick={() => {
            const csvContent = "data:text/csv;charset=utf-8," 
              + ["Patient ID,Name,Age,Sex,Diagnosis Date,Risk Score,Category,Model Used,BP,Cholesterol,Action"]
                .concat(HISTORICAL_RECORDS.map(r => `"${r.patientId}","${r.name}",${r.age},"${r.sex}","${r.diagnosisDate}",${r.riskScore}%,"${r.category}","${r.modelUsed}",${r.restingBP},${r.cholesterol},"${r.clinicalAction}"`))
                .join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `patient_history_export_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#1e293b',
            padding: '9px 16px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <Download size={14} /> Export History CSV
        </button>
      </div>

      {/* ── High-Level Statistics Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Records Logged</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>{stats.total} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>patients</span></div>
          <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} /> Complete diagnostic telemetry
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', color: '#be123c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Risk Diagnoses</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#be123c', marginTop: '6px' }}>{stats.high} <span style={{ fontSize: '12px', color: '#9f1239', fontWeight: 500 }}>({Math.round((stats.high/stats.total)*100)}%)</span></div>
          <div style={{ fontSize: '11px', color: '#9f1239', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldAlert size={12} /> Referred to Cardiology
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Moderate Risk Diagnoses</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', marginTop: '6px' }}>{stats.mod} <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 500 }}>({Math.round((stats.mod/stats.total)*100)}%)</span></div>
          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> Under Active Monitoring
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', color: '#0891b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Cohort Risk Score</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0891b2', marginTop: '6px' }}>{stats.avgRisk}%</div>
          <div style={{ fontSize: '11px', color: '#0891b2', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={12} /> Multi-model AI Consensus
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls Bar ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        alignItems: 'center',
        justify: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '300px', flex: '1' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search patient by name, ID (e.g. P-2026), or AI model..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              height: '38px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              paddingLeft: '36px',
              paddingRight: '12px',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
        </div>

        {/* Category filter pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {(['All', 'High Risk', 'Moderate Risk', 'Low Risk'] as const).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); setPage(1); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${active ? '#0891b2' : '#cbd5e1'}`,
                  background: active ? '#ecfeff' : '#ffffff',
                  color: active ? '#0891b2' : '#64748b',
                  fontSize: '11px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Sort selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
          <SlidersHorizontal size={14} />
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none', background: '#fff', color: '#1e293b' }}
          >
            <option value="date">Diagnosis Date</option>
            <option value="riskScore">Risk Score</option>
            <option value="name">Patient Name</option>
          </select>
          <button
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
          >
            {sortOrder === 'desc' ? '↓ Desc' : '↑ Asc'}
          </button>
        </div>
      </div>

      {/* ── Main Diagnosed Patient History Table ── */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Patient Details</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnosis Date & Time</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnostic Result</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vitals Summary</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', color: '#64748b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No patient records match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r) => {
                  const bStyle = getBadgeStyle(r.category);
                  return (
                    <tr 
                      key={r.id} 
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                      onClick={() => setSelectedRecord(r)}
                    >
                      {/* Patient Name & ID */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.patientId}</span> · {r.age}y / {r.sex}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={12} style={{ color: '#0891b2' }} />
                          {r.diagnosisDate}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{r.diagnosisTime}</div>
                      </td>

                      {/* Diagnostic Result */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: bStyle.bg,
                            color: bStyle.color,
                            border: `1px solid ${bStyle.border}`,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {r.riskScore}% · {r.category}
                          </span>
                        </div>
                      </td>

                      {/* Vitals Summary */}
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '11px' }}>
                        <div>BP: <strong style={{ color: r.restingBP >= 140 ? '#be123c' : '#0f172a' }}>{r.restingBP}</strong> mmHg · Chol: <strong style={{ color: r.cholesterol > 240 ? '#be123c' : '#0f172a' }}>{r.cholesterol}</strong> mg/dL</div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>MaxHR: {r.maxHR} bpm · ECG: {r.restingECG}</div>
                      </td>

                      {/* Action Button */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectPatientReport) {
                              onSelectPatientReport({
                                Age: r.age,
                                Sex: r.sex,
                                ChestPainType: r.chestPainType,
                                RestingBP: r.restingBP,
                                Cholesterol: r.cholesterol,
                                FastingBS: r.fastingBS,
                                RestingECG: r.restingECG,
                                MaxHR: r.maxHR,
                                ExerciseAngina: r.exerciseAngina,
                                Oldpeak: r.oldpeak,
                                ST_Slope: r.stSlope,
                                name: r.name
                              });
                            }
                          }}
                          style={{
                            background: '#ecfeff',
                            border: '1px solid #a5f3fc',
                            color: '#0891b2',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Report <ArrowUpRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '11px',
            color: '#64748b'
          }}>
            <div>Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length} records</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  cursor: page === 1 ? 'default' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  cursor: page === totalPages ? 'default' : 'pointer',
                  opacity: page === totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Slide-Over Patient Diagnostic Detail Modal / Drawer ── */}
      {selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          justify: 'flex-end',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            width: '460px',
            height: '100%',
            background: '#ffffff',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '24px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', pb: '16px', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Diagnostic Record Log</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0 0' }}>{selectedRecord.name}</h2>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Patient ID: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedRecord.patientId}</span></div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Diagnostic Result Banner */}
            {(() => {
              const bStyle = getBadgeStyle(selectedRecord.category);
              return (
                <div style={{
                  background: bStyle.bg,
                  border: `1px solid ${bStyle.border}`,
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: bStyle.color, fontWeight: 700, textTransform: 'uppercase' }}>Diagnosis Outcome</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: bStyle.color, marginTop: '2px' }}>{selectedRecord.riskScore}% Risk</div>
                    <div style={{ fontSize: '11px', color: bStyle.color, fontWeight: 600 }}>{selectedRecord.category} Classification</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Assessed On</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{selectedRecord.diagnosisDate}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{selectedRecord.diagnosisTime}</div>
                  </div>
                </div>
              );
            })()}

            {/* AI Model & Evaluation Info */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>AI Model Evaluation</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{selectedRecord.modelUsed}</div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Model Precision Confidence: <strong>{selectedRecord.confidence}%</strong></div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Assigned Cardiologist: <strong>{selectedRecord.doctorAssigned}</strong></div>
            </div>

            {/* Logged Clinical Vitals Grid */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '10px' }}>Logged Clinical Telemetry</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Resting BP</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: selectedRecord.restingBP >= 140 ? '#be123c' : '#0f172a' }}>{selectedRecord.restingBP} mmHg</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Cholesterol</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: selectedRecord.cholesterol > 240 ? '#be123c' : '#0f172a' }}>{selectedRecord.cholesterol} mg/dL</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Max HR</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{selectedRecord.maxHR} bpm</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>ST Depression</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{selectedRecord.oldpeak} mm</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Resting ECG</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{selectedRecord.restingECG}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>ST Slope</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{selectedRecord.stSlope}</div>
                </div>
              </div>
            </div>

            {/* Clinical Action Plan & Notes */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Clinical Action Plan</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0891b2', marginBottom: '8px' }}>{selectedRecord.clinicalAction}</div>
              <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>{selectedRecord.notes}</div>
            </div>

            {/* Action Button to generate full report */}
            <button
              onClick={() => {
                if (onSelectPatientReport) {
                  onSelectPatientReport({
                    Age: selectedRecord.age,
                    Sex: selectedRecord.sex,
                    ChestPainType: selectedRecord.chestPainType,
                    RestingBP: selectedRecord.restingBP,
                    Cholesterol: selectedRecord.cholesterol,
                    FastingBS: selectedRecord.fastingBS,
                    RestingECG: selectedRecord.restingECG,
                    MaxHR: selectedRecord.maxHR,
                    ExerciseAngina: selectedRecord.exerciseAngina,
                    Oldpeak: selectedRecord.oldpeak,
                    ST_Slope: selectedRecord.stSlope,
                    name: selectedRecord.name
                  });
                }
                setSelectedRecord(null);
              }}
              style={{
                marginTop: 'auto',
                width: '100%',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                gap: '8px'
              }}
            >
              Open Full Patient Report →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
