import React, { useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';

// ── Types ──
export interface Assessment {
  id: number;
  patientId: number;
  date: string;
  riskScore: number;
  restingBP: number;
  cholesterol: number;
  maxHR: number;
  stDepression: number;
  stSlope: string;
  restingEcg: string;
  exerciseAngina: string;
  fastingBloodSugar: number;
  chestPainType: string;
  referralStatus: 'none' | 'pending' | 'referred' | 'seen';
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  sex: string;
  assessments: Assessment[];
}

// ── Mock Data Generator ──
function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

const firstNames = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Daniel','Lisa','Matthew','Nancy','Anthony','Betty','Mark','Margaret','Donald','Sandra','Steven','Ashley','Paul','Dorothy','Andrew','Kimberly','Joshua','Emily','Kenneth','Donna','Kevin','Michelle','Brian','Carol','George','Amanda','Timothy','Melissa','Ronald','Deborah','Edward','Stephanie','Jason','Rebecca','Jeffrey','Sharon','Ryan','Laura','Jacob','Cynthia'];
const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts'];

function generateMockData(): Patient[] {
  const rng = seededRandom(42);
  const patients: Patient[] = [];
  const patientCount = 52;

  for (let i = 0; i < patientCount; i++) {
    const id = i + 1;
    const age = Math.floor(rng() * 50) + 25;
    const sex = rng() > 0.45 ? 'Male' : 'Female';
    const assessmentCount = Math.floor(rng() * 5) + 1;
    const assessments: Assessment[] = [];

    const baseRisk = 20 + rng() * 60;
    const riskTrend = (rng() - 0.4) * 8;
    const baseBP = 110 + rng() * 50;
    const baseChol = 160 + rng() * 120;
    const baseMaxHR = 120 + rng() * 60;

    for (let j = 0; j < assessmentCount; j++) {
      const daysBack = (assessmentCount - j - 1) * (30 + Math.floor(rng() * 90));
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      const dateStr = d.toISOString().split('T')[0];

      const riskScore = Math.min(99, Math.max(5, Math.round(baseRisk + riskTrend * j + (rng() - 0.5) * 12)));
      const restingBP = Math.round(baseBP + (rng() - 0.5) * 16);
      const cholesterol = Math.round(baseChol + (rng() - 0.5) * 30);
      const maxHR = Math.round(baseMaxHR + (rng() - 0.5) * 20);
      const stDepression = Math.round((rng() * 3.5) * 10) / 10;
      const stSlope = rng() > 0.6 ? 'Up' : rng() > 0.3 ? 'Flat' : 'Down';
      const restingEcg = rng() > 0.7 ? 'Normal' : rng() > 0.4 ? 'ST' : 'LVH';
      const exerciseAngina = rng() > 0.5 ? 'Yes' : 'No';
      const fastingBS = Math.round(80 + rng() * 80);
      const chestPainTypes = ['ATA', 'TA', 'NAP', 'ASY'];
      const chestPainType = chestPainTypes[Math.floor(rng() * 4)];

      let referralStatus: Assessment['referralStatus'] = 'none';
      if (riskScore >= 70) {
        const r = rng();
        if (r < 0.3) referralStatus = 'pending';
        else if (r < 0.5) referralStatus = 'referred';
        else if (r < 0.6) referralStatus = 'seen';
      } else if (riskScore >= 50 && rng() > 0.7) {
        referralStatus = 'pending';
      }

      assessments.push({
        id: i * 10 + j + 1,
        patientId: id,
        date: dateStr,
        riskScore,
        restingBP,
        cholesterol,
        maxHR,
        stDepression,
        stSlope,
        restingEcg,
        exerciseAngina,
        fastingBloodSugar: fastingBS,
        chestPainType,
        referralStatus,
      });
    }

    patients.push({
      id,
      name: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`,
      age,
      sex,
      assessments,
    });
  }

  return patients;
}

const MOCK_PATIENTS = generateMockData();

function getLatestAssessment(p: Patient): Assessment {
  return p.assessments[p.assessments.length - 1];
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function relativeDate(dateStr: string): string {
  const d = daysSince(dateStr);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  if (d < 365) return `${Math.floor(d / 30)} months ago`;
  return `${Math.floor(d / 365)} years ago`;
}

function riskBadgeColor(score: number): { color: string; bg: string } {
  if (score >= 70) return { color: '#dc2626', bg: '#fef2f2' };
  if (score >= 40) return { color: '#d97706', bg: '#fffbeb' };
  return { color: '#059669', bg: '#ecfdf5' };
}

function riskLevel(score: number): 'high' | 'moderate' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

// ── Component ──
interface AnalyticsViewProps {
  onNavigateToPatient: (patient: any) => void;
}

export default function AnalyticsView({ onNavigateToPatient }: AnalyticsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sortField, setSortField] = useState<'riskScore' | 'name' | 'age' | 'lastAssessed'>('riskScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterRisk, setFilterRisk] = useState<string[]>([]);
  const [filterSex, setFilterSex] = useState<string[]>([]);
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [filterNeedsReferral, setFilterNeedsReferral] = useState(false);
  const [filterAssessedWeek, setFilterAssessedWeek] = useState(false);
  const [filterVitalsTag, setFilterVitalsTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchDropdown, setSearchDropdown] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const PAGE_SIZE = 15;
  const [showBP, setShowBP] = useState(false);
  const [showChol, setShowChol] = useState(false);
  const [showHR, setShowHR] = useState(false);

  const patients = MOCK_PATIENTS;

  const filteredPatients = useMemo(() => {
    let list = patients;
    if (filterRisk.length > 0) list = list.filter(p => filterRisk.includes(riskLevel(getLatestAssessment(p).riskScore)));
    if (filterSex.length > 0) list = list.filter(p => filterSex.includes(p.sex));
    if (filterAgeMin) list = list.filter(p => p.age >= Number(filterAgeMin));
    if (filterAgeMax) list = list.filter(p => p.age <= Number(filterAgeMax));
    if (filterNeedsReferral) list = list.filter(p => getLatestAssessment(p).referralStatus === 'pending' || getLatestAssessment(p).referralStatus === 'referred');
    if (filterAssessedWeek) list = list.filter(p => daysSince(getLatestAssessment(p).date) <= 7);
    if (filterVitalsTag) {
      list = list.filter(p => {
        const a = getLatestAssessment(p);
        if (filterVitalsTag === 'hypertension') return a.restingBP >= 160;
        if (filterVitalsTag === 'highChol') return a.cholesterol > 240;
        if (filterVitalsTag === 'abnormalECG') return a.restingEcg !== 'Normal';
        if (filterVitalsTag === 'lowSpO2') return a.maxHR < 100;
        if (filterVitalsTag === 'highFBS') return a.fastingBloodSugar > 126;
        return true;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
    }
    list.sort((a, b) => {
      const aA = getLatestAssessment(a);
      const bA = getLatestAssessment(b);
      let cmp = 0;
      if (sortField === 'riskScore') cmp = aA.riskScore - bA.riskScore;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'age') cmp = a.age - b.age;
      else if (sortField === 'lastAssessed') cmp = new Date(aA.date).getTime() - new Date(bA.date).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [patients, filterRisk, filterSex, filterAgeMin, filterAgeMax, filterNeedsReferral, filterAssessedWeek, filterVitalsTag, searchQuery, sortField, sortDir]);

  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const pagedPatients = filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = (filterRisk.length > 0 ? 1 : 0) + (filterSex.length > 0 ? 1 : 0) + (filterAgeMin ? 1 : 0) + (filterAgeMax ? 1 : 0) + (filterNeedsReferral ? 1 : 0) + (filterAssessedWeek ? 1 : 0) + (filterVitalsTag ? 1 : 0);

  const clearFilters = useCallback(() => {
    setFilterRisk([]); setFilterSex([]); setFilterAgeMin(''); setFilterAgeMax('');
    setFilterNeedsReferral(false); setFilterAssessedWeek(false); setFilterVitalsTag(null);
    setSearchQuery(''); setPage(1);
  }, []);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // ── Summary metrics ──
  const totalPatients = patients.length;
  const highRiskCount = patients.filter(p => getLatestAssessment(p).riskScore >= 70).length;
  const needsReferral = patients.filter(p => { const a = getLatestAssessment(p); return a.referralStatus === 'pending' || a.referralStatus === 'referred'; }).length;
  const hypertensive = patients.filter(p => getLatestAssessment(p).restingBP >= 140).length;
  const notReassessed6mo = patients.filter(p => daysSince(getLatestAssessment(p).date) > 180).length;

  // ── Vitals out of range ──
  const stage2Hyp = patients.filter(p => getLatestAssessment(p).restingBP >= 160).length;
  const highChol = patients.filter(p => getLatestAssessment(p).cholesterol > 240).length;
  const abnormalECG = patients.filter(p => getLatestAssessment(p).restingEcg !== 'Normal').length;
  const lowSpO2 = patients.filter(p => getLatestAssessment(p).maxHR < 100).length;
  const highFBS = patients.filter(p => getLatestAssessment(p).fastingBloodSugar > 126).length;

  // ── Demographics ──
  const ageBuckets = ['<40', '40-49', '50-59', '60-69', '70+'];
  const ageData = ageBuckets.map((label, i) => {
    const min = i === 0 ? 0 : i * 10 + 30;
    const max = i === 4 ? 200 : (i + 1) * 10 + 30;
    const pts = patients.filter(p => p.age >= min && p.age < max);
    return {
      label,
      low: pts.filter(p => riskLevel(getLatestAssessment(p).riskScore) === 'low').length,
      moderate: pts.filter(p => riskLevel(getLatestAssessment(p).riskScore) === 'moderate').length,
      high: pts.filter(p => riskLevel(getLatestAssessment(p).riskScore) === 'high').length,
    };
  });
  const maxAgeBar = Math.max(...ageData.map(d => d.low + d.moderate + d.high), 1);

  const sexData = ['Male', 'Female'].map(s => {
    const pts = patients.filter(p => p.sex === s);
    return {
      label: s,
      low: pts.filter(p => riskLevel(getLatestAssessment(p).riskScore) === 'low').length,
      moderate: pts.filter(p => riskLevel(getLatestAssessment(p).riskScore) === 'moderate').length,
      high: pts.filter(p => riskLevel(getLatestAssessment(p).riskScore) === 'high').length,
    };
  });
  const maxSexBar = Math.max(...sexData.map(d => d.low + d.moderate + d.high), 1);

  // ── Comorbidity co-occurrence ──
  const comorbidityMap = new Map<string, number>();
  patients.forEach(p => {
    const a = getLatestAssessment(p);
    const flags: string[] = [];
    if (a.exerciseAngina === 'Yes') flags.push('Exercise Angina');
    if (a.stDepression > 1) flags.push('High ST Depression');
    if (a.restingBP >= 140) flags.push('Hypertension');
    if (a.cholesterol > 240) flags.push('High Cholesterol');
    if (a.fastingBloodSugar > 126) flags.push('Diabetes');
    if (a.restingEcg !== 'Normal') flags.push('Abnormal ECG');
    for (let i = 0; i < flags.length; i++) {
      for (let j = i + 1; j < flags.length; j++) {
        const key = `${flags[i]} + ${flags[j]}`;
        comorbidityMap.set(key, (comorbidityMap.get(key) || 0) + 1);
      }
    }
  });
  const comorbidities = [...comorbidityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // ── Monthly risk trend ──
  const monthlyTrend = useMemo(() => {
    const monthMap = new Map<string, { high: number; moderate: number; low: number; totalRisk: number; count: number }>();
    patients.forEach(p => {
      p.assessments.forEach(a => {
        const key = a.date.slice(0, 7); // YYYY-MM
        if (!monthMap.has(key)) monthMap.set(key, { high: 0, moderate: 0, low: 0, totalRisk: 0, count: 0 });
        const m = monthMap.get(key)!;
        m.count++;
        m.totalRisk += a.riskScore;
        const lvl = riskLevel(a.riskScore);
        if (lvl === 'high') m.high++;
        else if (lvl === 'moderate') m.moderate++;
        else m.low++;
      });
    });
    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        month: key,
        label: key.slice(5), // MM
        avgRisk: Math.round(v.totalRisk / v.count),
        high: v.high,
        moderate: v.moderate,
        low: v.low,
        total: v.count,
      }));
  }, [patients]);

  // ── Vitals trend (avg BP, avg Chol, avg HR per month) ──
  const vitalsTrend = useMemo(() => {
    const monthMap = new Map<string, { bpSum: number; cholSum: number; hrSum: number; count: number }>();
    patients.forEach(p => {
      p.assessments.forEach(a => {
        const key = a.date.slice(0, 7);
        if (!monthMap.has(key)) monthMap.set(key, { bpSum: 0, cholSum: 0, hrSum: 0, count: 0 });
        const m = monthMap.get(key)!;
        m.count++;
        m.bpSum += a.restingBP;
        m.cholSum += a.cholesterol;
        m.hrSum += a.maxHR;
      });
    });
    return [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        month: key,
        label: key.slice(5),
        avgBP: Math.round(v.bpSum / v.count),
        avgChol: Math.round(v.cholSum / v.count),
        avgHR: Math.round(v.hrSum / v.count),
      }));
  }, [patients]);

  // ── Referral tracking ──
  const referralPatients = patients
    .filter(p => { const a = getLatestAssessment(p); return a.referralStatus === 'pending' || a.referralStatus === 'referred'; })
    .sort((a, b) => daysSince(getLatestAssessment(b).date) - daysSince(getLatestAssessment(a).date));

  // ── Header search results ──
  const headerResults = headerSearch.length >= 2
    ? patients.filter(p => p.name.toLowerCase().includes(headerSearch.toLowerCase()) || String(p.id).includes(headerSearch)).slice(0, 8)
    : [];

  const handleUpdateReferral = (patientId: number, newStatus: Assessment['referralStatus']) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      const latest = getLatestAssessment(patient);
      latest.referralStatus = newStatus;
    }
  };

  const MetricCard = ({ label, value, onClick, active }: { label: string; value: number; onClick?: () => void; active?: boolean }) => (
    <div onClick={onClick} style={{
      padding: '14px 16px', borderRadius: '10px', border: `1px solid ${active ? '#2563eb' : '#e5e7eb'}`,
      background: active ? '#eff6ff' : '#ffffff', cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}
      onMouseOver={e => { if (onClick) { e.currentTarget.style.borderColor = '#93c5fd'; } }}
      onMouseOut={e => { if (onClick) { e.currentTarget.style.borderColor = active ? '#2563eb' : '#e5e7eb'; } }}
    >
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>of {totalPatients} patients</div>
    </div>
  );

  const SortHeader = ({ field, children }: { field: typeof sortField; children: React.ReactNode }) => (
    <th onClick={() => toggleSort(field)} style={{
      textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700,
      padding: '8px 10px', borderBottom: '2px solid #e5e7eb', cursor: 'pointer',
      userSelect: 'none', whiteSpace: 'nowrap', letterSpacing: '0.3px', textTransform: 'uppercase',
    }}>
      {children} {sortField === field ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  const SectionCard = ({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', ...style }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 16px 0' }}>{title}</h3>
      {children}
    </div>
  );

  // ── Patient Detail View ──
  if (selectedPatient) {
    const assessments = [...selectedPatient.assessments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = assessments[assessments.length - 1];

    const chartWidth = 600;
    const chartHeight = 240;
    const padL = 40; const padR = 20; const padT = 20; const padB = 30;
    const plotW = chartWidth - padL - padR;
    const plotH = chartHeight - padT - padB;

    const riskPoints = assessments.map((a, i) => ({
      x: padL + (assessments.length === 1 ? plotW / 2 : (i / (assessments.length - 1)) * plotW),
      y: padT + (1 - a.riskScore / 100) * plotH,
      score: a.riskScore,
      date: a.date,
    }));

    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>← Back to Analytics</button>
        </div>
        <SectionCard title={`Patient Profile — ${selectedPatient.name}`}>
          <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: '#374151' }}>
            <span>ID: P-{String(selectedPatient.id).padStart(4, '0')}</span>
            <span>Age: {selectedPatient.age}</span>
            <span>Sex: {selectedPatient.sex}</span>
            <span>Assessments: {assessments.length}</span>
          </div>
        </SectionCard>

        <SectionCard title="Risk History">
          {assessments.length < 2 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>Only one assessment on record — trend will appear after a second visit</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '11px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showBP} onChange={e => setShowBP(e.target.checked)} /> Resting BP
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showChol} onChange={e => setShowChol(e.target.checked)} /> Cholesterol
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showHR} onChange={e => setShowHR(e.target.checked)} /> Max HR
                </label>
              </div>
              <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible' }}>
                {[0, 25, 50, 75, 100].map(v => (
                  <g key={v}>
                    <line x1={padL} y1={padT + (1 - v / 100) * plotH} x2={padL + plotW} y2={padT + (1 - v / 100) * plotH} stroke="#f3f4f6" strokeWidth="1" />
                    <text x={padL - 6} y={padT + (1 - v / 100) * plotH + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}%</text>
                  </g>
                ))}
                <polyline fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" points={riskPoints.map(p => `${p.x},${p.y}`).join(' ')} />
                {riskPoints.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                    <text x={p.x} y={padT + plotH + 16} textAnchor="middle" fontSize="8" fill="#6b7280">{p.date.slice(5)}</text>
                  </g>
                ))}
                {showBP && (
                  <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,3" points={assessments.map((a, i) => `${padL + (i / (assessments.length - 1)) * plotW},${padT + (1 - a.restingBP / 200) * plotH}`).join(' ')} />
                )}
                {showChol && (
                  <polyline fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4,3" points={assessments.map((a, i) => `${padL + (i / (assessments.length - 1)) * plotW},${padT + (1 - a.cholesterol / 400) * plotH}`).join(' ')} />
                )}
                {showHR && (
                  <polyline fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeDasharray="4,3" points={assessments.map((a, i) => `${padL + (i / (assessments.length - 1)) * plotW},${padT + (1 - a.maxHR / 200) * plotH}`).join(' ')} />
                )}
              </svg>
            </>
          )}
        </SectionCard>

        <SectionCard title="Assessment History">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>Risk</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>BP</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>Cholesterol</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>Max HR</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>ST Dep.</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>ECG</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>Angina</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a, i) => {
                  const prev = i > 0 ? assessments[i - 1] : null;
                  const rc = riskBadgeColor(a.riskScore);
                  return (
                    <tr key={a.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.date}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ background: rc.bg, color: rc.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '10px' }}>{a.riskScore}%</span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.restingBP}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.cholesterol}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.maxHR}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.stDepression}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.restingEcg}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{a.exerciseAngina}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    );
  }

  // ── Main Analytics View ──
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Section 1: Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0 }}>Analytics</h1>
          <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>Patient panel overview and risk monitoring</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search patients by name or ID..."
            value={headerSearch}
            onChange={e => { setHeaderSearch(e.target.value); setSearchDropdown(e.target.value.length >= 2); }}
            onBlur={() => setTimeout(() => setSearchDropdown(false), 200)}
            onFocus={() => { if (headerSearch.length >= 2) setSearchDropdown(true); }}
            style={{ width: '280px', height: '36px', border: '1px solid #e5e7eb', borderRadius: '8px', paddingLeft: '32px', fontSize: '12px', outline: 'none', color: '#111827', background: '#ffffff' }}
          />
          {searchDropdown && headerResults.length > 0 && (
            <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '280px', overflow: 'auto' }}>
              {headerResults.map(p => {
                const a = getLatestAssessment(p);
                const rc = riskBadgeColor(a.riskScore);
                return (
                  <div key={p.id} onClick={() => { setSelectedPatient(p); setSearchDropdown(false); setHeaderSearch(''); }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
                  >
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Age {p.age} · P-{String(p.id).padStart(4, '0')}</div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: rc.color, background: rc.bg, padding: '2px 8px', borderRadius: '4px' }}>{a.riskScore}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <MetricCard label="Total Patients" value={totalPatients} active={filterRisk.length === 0 && filterSex.length === 0 && !filterNeedsReferral && !filterAssessedWeek && !filterVitalsTag} onClick={clearFilters} />
        <MetricCard label="High Risk" value={highRiskCount} onClick={() => { clearFilters(); setFilterRisk(['high']); }} active={filterRisk.length === 1 && filterRisk[0] === 'high'} />
        <MetricCard label="Needs Referral" value={needsReferral} onClick={() => { clearFilters(); setFilterNeedsReferral(true); }} active={filterNeedsReferral} />
        <MetricCard label="Hypertensive" value={hypertensive} onClick={() => { clearFilters(); setFilterVitalsTag('hypertension'); }} active={filterVitalsTag === 'hypertension'} />
        <MetricCard label="Not Reassessed 6mo+" value={notReassessed6mo} onClick={() => { clearFilters(); setFilterAssessedWeek(false); }} />
      </div>

      {/* Section 2.5: Analytics Trend Graphs */}
      {monthlyTrend.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* ── Average Risk Score Trend ── Clean single-series risk trend ── */}
          <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '24px 24px 18px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.2px' }}>
                  Average Risk Score Trend
                </h3>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Monthly average across all patient assessments</div>
              </div>
              <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '18px', alignItems: 'center' }}>
                {/* Risk score legend item */}
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="24" height="12">
                    <line x1="0" y1="6" x2="24" y2="6" stroke="#0891b2" strokeWidth="2.5" />
                    <circle cx="12" cy="6" r="3.5" fill="#ffffff" stroke="#0891b2" strokeWidth="2" />
                  </svg>
                  <span style={{ color: '#334155', fontWeight: 600 }}>Avg Risk score</span>
                </span>
              </div>
            </div>

            {(() => {
              const data = monthlyTrend;
              const W = 540; const H = 220;
              const padL = 48; const padR = 16; const padT = 24; const padB = 32;
              const plotW = W - padL - padR; const plotH = H - padT - padB;

              // Fixed Y-ticks 20 to 90 matching graph scale
              const yMin = 20;
              const yMax = 90;
              const yTicks = [20, 30, 40, 50, 60, 70, 80, 90];

              const toY = (val: number) => padT + (1 - (val - yMin) / (yMax - yMin)) * plotH;

              // Risk score points
              const pts = data.map((d, i) => ({
                x: padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
                y: toY(d.avgRisk),
                avg: d.avgRisk,
                label: d.label,
              }));

              // Smooth bezier path for risk line
              const riskPath = pts.reduce((acc, p, i) => {
                if (i === 0) return `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                const prev = pts[i - 1];
                const cpx = (prev.x + p.x) / 2;
                return acc + ` C${cpx.toFixed(1)},${prev.y.toFixed(1)} ${cpx.toFixed(1)},${p.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              }, '');

              // Translucent area fill block extending down to bottom of plot
              const areaPath = riskPath + ` L${pts[pts.length - 1].x},${padT + plotH} L${pts[0].x},${padT + plotH} Z`;

              return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Rotated Y-axis label */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, color: '#0891b2',
                      whiteSpace: 'nowrap', transform: 'rotate(-90deg)',
                      transformOrigin: 'center', display: 'block'
                    }}>Risk score (%)</span>
                  </div>

                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block', flex: 1 }}>
                    <defs>
                      <linearGradient id="exactTealFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0891b2" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="#0891b2" stopOpacity="0.04" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Y gridlines & labels */}
                    {yTicks.map((v) => {
                      const ty = toY(v);
                      return (
                        <g key={v}>
                          <line x1={padL} y1={ty} x2={padL + plotW} y2={ty} stroke="#f1f5f9" strokeWidth="1" />
                          <text x={padL - 10} y={ty + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="system-ui, sans-serif">{v}</text>
                        </g>
                      );
                    })}

                    {/* Y-axis left vertical border line */}
                    <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#e2e8f0" strokeWidth="1" />

                    {/* X-axis bottom baseline line */}
                    <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#e2e8f0" strokeWidth="1" />

                    {/* Translucent teal background fill */}
                    <path d={areaPath} fill="url(#exactTealFill)" />

                    {/* Risk score teal line */}
                    <path d={riskPath} fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                    {/* Risk score data points & cyan percentage labels */}
                    {pts.map((p, i) => (
                      <g key={i}>
                        {/* X-axis tick label */}
                        <text x={p.x} y={padT + plotH + 18} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="system-ui, sans-serif">{p.label}</text>

                        {/* Circle marker (white center, cyan border) */}
                        <circle cx={p.x} cy={p.y} r="4.5" fill="#ffffff" stroke="#0891b2" strokeWidth="2" />

                        {/* Cyan percentage value label above node */}
                        <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="10.5" fill="#0891b2" fontWeight="700" fontFamily="system-ui, sans-serif">{p.avg}%</text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })()}
          </div>

          {/* ── Risk Level Distribution Over Time ── Professional stacked bar chart */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 20px 14px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', letterSpacing: '-0.1px' }}>Risk Level Distribution Over Time</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Patient count by risk category per month</div>
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', gap: '12px', alignItems: 'center', paddingTop: '2px' }}>
                {[{ label: 'High Risk', color: '#be123c' }, { label: 'Moderate', color: '#b45309' }, { label: 'Low Risk', color: '#047857' }].map(l => (
                  <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '2px', background: l.color, display: 'inline-block', flexShrink: 0 }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            {(() => {
              const data = monthlyTrend;
              const W = 540; const H = 190;
              const padL = 44; const padR = 20; const padT = 14; const padB = 36;
              const plotW = W - padL - padR; const plotH = H - padT - padB;
              const maxTotal = Math.max(...data.map(d => d.high + d.moderate + d.low), 1);
              // Nice round Y-axis max
              const yMax = Math.ceil(maxTotal / 5) * 5 || 5;
              const barW = Math.max(10, Math.min(32, (plotW / data.length) * 0.55));
              const step = plotW / Math.max(data.length, 1);
              const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(yMax * f));
              return (
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
                  {/* Y gridlines + labels */}
                  {yTicks.map((v, ti) => {
                    const ty = padT + (1 - v / yMax) * plotH;
                    return (
                      <g key={ti}>
                        <line x1={padL} y1={ty} x2={padL + plotW} y2={ty}
                          stroke={v === 0 ? '#d1d5db' : '#f3f4f6'} strokeWidth="1" />
                        <text x={padL - 8} y={ty + 4} textAnchor="end" fontSize="9.5" fill="#9ca3af" fontFamily="system-ui, sans-serif">{v}</text>
                      </g>
                    );
                  })}
                  {/* X-axis baseline */}
                  <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#d1d5db" strokeWidth="1" />
                  {/* Stacked bars */}
                  {data.map((d, i) => {
                    const cx = padL + step * i + step / 2;
                    const x = cx - barW / 2;
                    const total = d.high + d.moderate + d.low;
                    const hLow  = (d.low      / yMax) * plotH;
                    const hMod  = (d.moderate / yMax) * plotH;
                    const hHigh = (d.high     / yMax) * plotH;
                    const yBase = padT + plotH;
                    const yLowTop  = yBase - hLow;
                    const yModTop  = yLowTop - hMod;
                    const yHighTop = yModTop - hHigh;
                    const topY = total > 0 ? yHighTop : yBase;
                    return (
                      <g key={i}>
                        {/* Low Risk segment (bottom) */}
                        {d.low > 0 && (
                          <rect x={x} y={yLowTop} width={barW} height={hLow}
                            fill="#047857" rx={d.moderate === 0 && d.high === 0 ? '3' : '0'}
                            style={{ rx: '0' }}
                          />
                        )}
                        {/* Moderate segment (middle) */}
                        {d.moderate > 0 && (
                          <rect x={x} y={yModTop} width={barW} height={hMod}
                            fill="#b45309" rx={d.high === 0 ? '3' : '0'}
                          />
                        )}
                        {/* High Risk segment (top) — rounded top corners */}
                        {d.high > 0 && (
                          <path
                            d={`M${x+3},${yHighTop} Q${x},${yHighTop} ${x},${yHighTop+3} L${x},${yModTop > yHighTop ? yModTop : yHighTop + hHigh} L${x+barW},${yModTop > yHighTop ? yModTop : yHighTop + hHigh} L${x+barW},${yHighTop+3} Q${x+barW},${yHighTop} ${x+barW-3},${yHighTop} Z`}
                            fill="#be123c"
                          />
                        )}
                        {/* Rounded top on bar when no high risk */}
                        {d.high === 0 && d.moderate > 0 && (
                          <path
                            d={`M${x+3},${yModTop} Q${x},${yModTop} ${x},${yModTop+3} L${x},${yModTop+3} Z M${x+barW-3},${yModTop} Q${x+barW},${yModTop} ${x+barW},${yModTop+3} L${x+barW},${yModTop+3} Z`}
                            fill="#b45309"
                          />
                        )}
                        {/* X tick + label */}
                        <line x1={cx} y1={padT + plotH} x2={cx} y2={padT + plotH + 4} stroke="#d1d5db" strokeWidth="1" />
                        <text x={cx} y={padT + plotH + 16} textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="system-ui, sans-serif">{d.label}</text>
                        {/* Total count above bar */}
                        {total > 0 && (
                          <text x={cx} y={topY - 5} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="700" fontFamily="system-ui, sans-serif">{total}</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

        </div>
      )}

      {/* Section 3: Patient Risk Worklist */}
      <SectionCard title="Patient Risk Worklist" style={{ padding: '20px' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', padding: '10px 12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Filters:</span>
          {/* Risk level multi-select */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['high', 'moderate', 'low'].map(r => (
              <button key={r} onClick={() => setFilterRisk(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${filterRisk.includes(r) ? '#2563eb' : '#e5e7eb'}`, background: filterRisk.includes(r) ? '#eff6ff' : '#ffffff', color: filterRisk.includes(r) ? '#2563eb' : '#6b7280', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {r}
              </button>
            ))}
          </div>
          {/* Sex filter */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['Male', 'Female'].map(s => (
              <button key={s} onClick={() => setFilterSex(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${filterSex.includes(s) ? '#2563eb' : '#e5e7eb'}`, background: filterSex.includes(s) ? '#eff6ff' : '#ffffff', color: filterSex.includes(s) ? '#2563eb' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
          {/* Age range */}
          <input type="number" placeholder="Min age" value={filterAgeMin} onChange={e => setFilterAgeMin(e.target.value)} style={{ width: '60px', height: '26px', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
          <input type="number" placeholder="Max age" value={filterAgeMax} onChange={e => setFilterAgeMax(e.target.value)} style={{ width: '60px', height: '26px', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
          {/* Toggles */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={filterNeedsReferral} onChange={e => setFilterNeedsReferral(e.target.checked)} /> Needs referral
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={filterAssessedWeek} onChange={e => setFilterAssessedWeek(e.target.checked)} /> This week
          </label>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ fontSize: '10px', color: '#dc2626', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <SortHeader field="name">Name</SortHeader>
                <SortHeader field="age">Age</SortHeader>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700, padding: '8px 10px', borderBottom: '2px solid #e5e7eb', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Sex</th>
                <SortHeader field="riskScore">Risk Score</SortHeader>
                <th style={{ textAlign: 'left', fontSize: '10px', color: '#6b7280', fontWeight: 700, padding: '8px 10px', borderBottom: '2px solid #e5e7eb', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Referral</th>
                <SortHeader field="lastAssessed">Last Assessed</SortHeader>
                <th style={{ textAlign: 'right', fontSize: '10px', color: '#6b7280', fontWeight: 700, padding: '8px 10px', borderBottom: '2px solid #e5e7eb', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Profile</th>
              </tr>
            </thead>
            <tbody>
              {pagedPatients.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
                  No patients match the current filters.
                  <button onClick={clearFilters} style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Clear filters</button>
                </td></tr>
              ) : pagedPatients.map(p => {
                const a = getLatestAssessment(p);
                const rc = riskBadgeColor(a.riskScore);
                const daysAgo = daysSince(a.date);
                const refColor = a.referralStatus === 'pending' ? '#d97706' : a.referralStatus === 'referred' ? '#2563eb' : a.referralStatus === 'seen' ? '#059669' : '#9ca3af';
                const refBg = a.referralStatus === 'pending' ? '#fffbeb' : a.referralStatus === 'referred' ? '#eff6ff' : a.referralStatus === 'seen' ? '#ecfdf5' : '#f9fafb';
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}
                    onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{p.age}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{p.sex}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ background: rc.bg, color: rc.color, padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px' }}>{a.riskScore}%</span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ background: refBg, color: refColor, padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '10px', textTransform: 'capitalize' }}>{a.referralStatus}</span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: daysAgo > 180 ? '#dc2626' : '#6b7280', fontWeight: daysAgo > 180 ? 600 : 400, fontSize: '11px' }}>{relativeDate(a.date)}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                      <span style={{ color: '#2563eb', fontSize: '14px' }}>→</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '11px', color: '#6b7280' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontSize: '11px' }}>Prev</button>
            <span>Page {page} of {totalPages} ({filteredPatients.length} patients)</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', cursor: page === totalPages ? 'default' : 'pointer', opacity: page === totalPages ? 0.5 : 1, fontSize: '11px' }}>Next</button>
          </div>
        )}
      </SectionCard>

      {/* Section 4: Vitals out of range */}
      <SectionCard title="Vitals Out of Range">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {[
            { label: 'Stage 2 Hypertension', count: stage2Hyp, tag: 'hypertension', border: '#fecaca', bg: '#fef2f2', color: '#dc2626' },
            { label: 'High Cholesterol (>240)', count: highChol, tag: 'highChol', border: '#fed7aa', bg: '#fff7ed', color: '#ea580c' },
            { label: 'Abnormal Resting ECG', count: abnormalECG, tag: 'abnormalECG', border: '#fef08a', bg: '#fefce8', color: '#ca8a04' },
            { label: 'Low SpO2/HR (<100)', count: lowSpO2, tag: 'lowSpO2', border: '#fecaca', bg: '#fef2f2', color: '#dc2626' },
            { label: 'Elevated Fasting BS', count: highFBS, tag: 'highFBS', border: '#fed7aa', bg: '#fff7ed', color: '#ea580c' },
          ].map(card => (
            <div key={card.tag} onClick={() => { clearFilters(); setFilterVitalsTag(filterVitalsTag === card.tag ? null : card.tag); }}
              style={{ padding: '12px', borderRadius: '8px', border: `1px solid ${filterVitalsTag === card.tag ? '#2563eb' : card.border}`, background: filterVitalsTag === card.tag ? '#eff6ff' : card.bg, cursor: 'pointer', transition: 'all 0.15s ease' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: card.color }}>{card.count}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 5: Demographics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <SectionCard title="Age Distribution by Risk Level">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ageData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '36px', fontSize: '10px', color: '#6b7280', fontWeight: 600, textAlign: 'right' }}>{d.label}</span>
                <div style={{ flex: 1, display: 'flex', height: '18px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(d.low / maxAgeBar) * 100}%`, background: '#059669', transition: 'width 0.3s' }} />
                  <div style={{ width: `${(d.moderate / maxAgeBar) * 100}%`, background: '#d97706', transition: 'width 0.3s' }} />
                  <div style={{ width: `${(d.high / maxAgeBar) * 100}%`, background: '#dc2626', transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: '20px', fontSize: '10px', color: '#374151', fontWeight: 600 }}>{d.low + d.moderate + d.high}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', justifyContent: 'center' }}>
            {[{ label: 'Low', color: '#059669' }, { label: 'Moderate', color: '#d97706' }, { label: 'High', color: '#dc2626' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Sex Distribution by Risk Level">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sexData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '48px', fontSize: '10px', color: '#6b7280', fontWeight: 600, textAlign: 'right' }}>{d.label}</span>
                <div style={{ flex: 1, display: 'flex', height: '22px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(d.low / maxSexBar) * 100}%`, background: '#059669', transition: 'width 0.3s' }} />
                  <div style={{ width: `${(d.moderate / maxSexBar) * 100}%`, background: '#d97706', transition: 'width 0.3s' }} />
                  <div style={{ width: `${(d.high / maxSexBar) * 100}%`, background: '#dc2626', transition: 'width 0.3s' }} />
                </div>
                <span style={{ width: '20px', fontSize: '10px', color: '#374151', fontWeight: 600 }}>{d.low + d.moderate + d.high}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', justifyContent: 'center' }}>
            {[{ label: 'Low', color: '#059669' }, { label: 'Moderate', color: '#d97706' }, { label: 'High', color: '#dc2626' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#6b7280' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.color }} />{l.label}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Section 6: Comorbidity co-occurrence */}
      <SectionCard title="Comorbidity Co-occurrence">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {comorbidities.map(([combo, count], i) => (
            <div key={i} onClick={() => { clearFilters(); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize: '11px', color: '#374151', flex: 1 }}>{combo}</span>
              <div style={{ width: '120px', height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${(count / comorbidities[0][1]) * 100}%`, height: '100%', background: '#2563eb', borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827', minWidth: '50px', textAlign: 'right' }}>{count} patients</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Section 7: Referral & Follow-up Tracking */}
      <SectionCard title="Referral & Follow-up Tracking">
        {referralPatients.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>No pending or referred patients.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Risk Score</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Referral Status</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Days Since Flagged</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', color: '#6b7280', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Last Assessed</th>
                </tr>
              </thead>
              <tbody>
                {referralPatients.map(p => {
                  const a = getLatestAssessment(p);
                  const days = daysSince(a.date);
                  const overdue = (a.referralStatus === 'pending' || a.referralStatus === 'referred') && days > 14;
                  const rc = riskBadgeColor(a.riskScore);
                  return (
                    <tr key={p.id} style={{ background: overdue ? '#fffbeb' : 'transparent' }}>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#111827' }}>{p.name}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ background: rc.bg, color: rc.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '10px' }}>{a.riskScore}%</span>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                        <select value={a.referralStatus} onChange={e => handleUpdateReferral(p.id, e.target.value as Assessment['referralStatus'])}
                          style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
                          <option value="pending">Pending</option>
                          <option value="referred">Referred</option>
                          <option value="seen">Seen</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: overdue ? '#dc2626' : '#374151', fontWeight: overdue ? 700 : 400 }}>
                        {overdue && '⚠ '}{days} days
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{relativeDate(a.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
