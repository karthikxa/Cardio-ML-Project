import React, { useEffect, useState } from 'react';
import { 
  Eye,
  Search, 
  ChevronDown, 
  Sun, 
  Calendar, 
  Bell, 
  Clipboard, 
  Activity, 
  ShieldAlert, 
  Award, 
  ArrowUp, 
  ArrowRight, 
  FileText, 
  Users, 
  Database, 
  HelpCircle,
  TrendingUp,
  Sparkles,
  Settings,
  Folder,
  Grid,
  Target,
  CheckCircle,
  Filter,
  MoreHorizontal,
  Download,
  RotateCw,
  Trophy,
  Star,
  Shield,
  RefreshCw,
  Heart,
  Droplet,
  User,
  Percent,
  ArrowDown,
  Check,
  AlertTriangle
} from 'lucide-react';

import heart3d from './assets/heart_3d.png';
import drAlex from './assets/dr_alex.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const LIVE_REFRESH_MS = 30000;

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Manual refresh — shows loading indicator while in-flight */
  refresh: () => Promise<void>;
};

type SummaryResponse = {
  dataset_name: string;
  total_records: number;
  total_features: number;
  missing_values_pct: number;
  selected_model: {
    name: string;
    display_name: string;
    auc_roc: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    status: string;
  };
  top_risk_factors_tracked: number;
  prediction_confidence: number;
  risk_distribution: Array<{ label: string; count: number; percent: number; color: string }>;
  trend: Array<{ month: string; value: number }>;
  recent_insights: Array<{ title: string; text: string; tag: string }>;
};

type DatasetResponse = {
  metadata: {
    dataset_name: string;
    rows: number;
    columns: number;
    target: string;
    missing_values_pct: number;
    numeric_features: number;
    categorical_features: number;
    binary_features: number;
  };
  preview: Array<Record<string, string | number>>;
  numeric_summary: Array<Record<string, string | number>>;
  target_distribution: Array<{ label: string; count: number }>;
  quality_notes: string[];
};

type MetricsResponse = {
  selected_model: {
    name: string;
    display_name: string;
    status: string;
    accuracy: number;
    auc_roc: number;
    precision: number;
    recall: number;
    f1: number;
    confusion_matrix: number[][];
  };
  models: Array<{
    model: string;
    display_name: string;
    status: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc_roc: number;
    confusion_matrix: number[][];
  }>;
  ranking: Array<{ name: string; value: number; pct: string; color: string }>;
  validation_notes: Array<{ k: string; v: string }>;
};

type FeatureImportanceResponse = {
  features: Array<{
    feature: string;
    label: string;
    shap_mean_abs: number;
    rf_importance: number;
    xgb_gain_importance: number;
    shap_importance_norm: number;
    rf_importance_norm: number;
    xgb_gain_importance_norm: number;
  }>;
  top_risk: Array<{ factor: string; value: number }>;
  top_protective: Array<{ factor: string; value: number }>;
};

type AssessmentsResponse = {
  items: Array<{ name: string; sex: string; age: number; date: string; risk: string; score: number }>;
};

type EdaStatsResponse = {
  population: {
    total_patients: number;
    healthy: number;
    at_risk: number;
    avg_age: number;
    avg_cholesterol: number;
    avg_resting_bp: number;
  };
  sex_distribution: Record<string, number>;
  target_distribution: Record<string, number>;
  numeric_summary: Array<Record<string, string | number>>;
  quality_notes: string[];
};

type PredictResponse = {
  probability: number;
  risk_score: number;
  category: 'High Risk' | 'Moderate Risk' | 'Low Risk';
  color: string;
  model_used: string;
  secondary_model: {
    name: string;
    risk: number | null;
    available: boolean;
  };
  agreement_text: string;
  agreement_score: number | null;
  top_risk: Array<{ factor: string; contribution: number }>;
  top_protective: Array<{ factor: string; contribution: number }>;
  contributions: Array<{ factor: string; value: number; contribution: number }>;
  selected_model: string;
  confidence: string;
  clinical_summary: { summary: string; top_factors: string[] };
  prediction_vs_average: Array<{ name: string; user: number; avg: number }>;
  validation_notes: Array<{ k: string; v: string }>;
};

type PredictRequest = {
  Age: number;
  Sex: string;
  ChestPainType: string;
  RestingBP: number;
  Cholesterol: number;
  FastingBS: number;
  RestingECG: string;
  MaxHR: number;
  ExerciseAngina: string;
  Oldpeak: number;
  ST_Slope: string;
};

const fetchJson = async <T,>(endpoint: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

function useApi<T>(endpoint: string, enabled = true): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  // loading is true only on the very first fetch (or manual refresh); silent on background polls
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  // isBgPoll ref — true when called from the interval, false when called manually or on mount
  const isBgPoll = React.useRef(false);

  const fetchOnce = async (showLoading: boolean) => {
    if (!enabled) return;
    const controller = new AbortController();
    try {
      if (showLoading) setLoading(true);
      const payload = await fetchJson<T>(endpoint, { signal: controller.signal });
      setData(payload);
      // Backend recovered — clear any previous error silently
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        // Preserve existing data so sections don't go blank; only update error message
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Manual refresh — shows the loading banner so the user knows something is happening
  const refresh = async () => {
    isBgPoll.current = false;
    await fetchOnce(true);
  };

  useEffect(() => {
    if (!enabled) return;
    // Initial load — show loading
    isBgPoll.current = false;
    void fetchOnce(true);
    // Background polls — silent (no loading banner, keeps existing data visible)
    const timer = window.setInterval(() => {
      isBgPoll.current = true;
      void fetchOnce(false);
    }, LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [endpoint, enabled]);

  return { data, loading, error, refresh };
}

const sectionMessageStyle = {
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '11px',
  marginBottom: '12px',
} as const;

const SectionStatus: React.FC<{ loading: boolean; error: string | null; onRetry?: () => void }> = ({ loading, error, onRetry }) => {
  if (error) {
    return (
      <div style={{ ...sectionMessageStyle, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Live data unavailable: {error}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{ marginLeft: '12px', background: 'none', border: '1px solid #fca5a5', borderRadius: '4px', color: '#b91c1c', cursor: 'pointer', padding: '2px 8px', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return <div style={{ ...sectionMessageStyle, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>Loading live data…</div>;
  }

  return null;
};

const formatPercent = (value: number, fractionDigits = 1) => `${value.toFixed(fractionDigits)}%`;
const getRiskBadgeClass = (risk: string) =>
  risk.includes('High') ? 'badge-danger' : risk.includes('Moderate') ? 'badge-warning' : 'badge-success';

// Sparkline component to draw micro bar charts
const Sparkline: React.FC<{ values: number[]; color?: string }> = ({ values, color = "#cbd5e1" }) => {
  const width = 80;
  const height = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const barWidth = (width - (values.length - 1) * 2) / values.length;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="metric-spark">
      {values.map((v, i) => {
        const h = ((v - min) / range) * (height - 4) + 4;
        const x = i * (barWidth + 2);
        const y = height - h;
        return (
          <rect
            key={i}
            x={x.toFixed(1)}
            y={y.toFixed(1)}
            width={barWidth.toFixed(1)}
            height={h.toFixed(1)}
            rx="0.5"
            fill={color}
          />
        );
      })}
    </svg>
  );
};

// Donut Chart SVG Component
const DonutChart: React.FC<{ total: number; segments: Array<{ label: string; count: number; percent: number; color: string }> }> = ({ total, segments }) => {
  const radius = 35;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercentage = 0;

  return (
    <div className="distribution-row">
      <div className="distribution-chart-wrapper">
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg, idx) => {
            const strokeDashoffset = circumference - (seg.percent / 100) * circumference;
            const strokeDasharray = `${circumference} ${circumference}`;
            const rotation = (accumulatedPercentage / 100) * 360;
            accumulatedPercentage += seg.percent;

            return (
              <circle
                key={idx}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transformOrigin: '50px 50px',
                  transform: `rotate(${rotation}deg)`,
                  transition: 'stroke-dashoffset 0.5s ease',
                }}
              />
            );
          })}
        </svg>
        <div className="distribution-center-label">
          <span className="distribution-center-val">{total.toLocaleString()}</span>
          <span className="distribution-center-lbl">Total</span>
        </div>
      </div>
      <div className="distribution-legend">
        {segments.map((segment) => (
          <div className="legend-item" key={segment.label}>
            <div className="legend-label-col">
              <span className="legend-dot" style={{ backgroundColor: segment.color }}></span>
              <span className="legend-name">{segment.label}</span>
            </div>
            <span className="legend-value">{segment.count.toLocaleString()} ({segment.percent.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Trend Bar Chart Component
const TrendChart: React.FC<{ trend: Array<{ month: string; value: number }> }> = ({ trend }) => {
  const maxValue = Math.max(...trend.map((item) => item.value), 1);
  const palette = ['#c7d2fe', '#a5b4fc', '#93c5fd', '#60a5fa', '#34d399', '#fb7185'];
  const trendData = trend.map((item, idx) => ({
    ...item,
    height: Math.max(18, Math.round((item.value / maxValue) * 95)),
    color: palette[idx % palette.length],
    highlight: idx === trend.length - 1,
  }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="trend-header">
        <span className="section-title" style={{ margin: 0 }}>Risk Trend Over Time</span>
        <div className="trend-dropdown">
          Last 6 Months <ChevronDown size={11} style={{ display: 'inline', marginLeft: 2 }} />
        </div>
      </div>
      <div className="trend-chart-container">
        {/* Y Axis Guide Lines */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '20%', borderTop: '1px dashed #cbd5e1', opacity: 0.2 }}></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '45%', borderTop: '1px dashed #cbd5e1', opacity: 0.2 }}></div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '70%', borderTop: '1px dashed #cbd5e1', opacity: 0.2 }}></div>
        
        {trendData.map((d, i) => (
          <div key={i} className="trend-bar-wrapper">
            <div 
              className={`trend-bar ${d.highlight ? 'highlight' : ''}`}
              style={{ height: `${d.height}%`, backgroundColor: d.color }}
              title={`${d.month}: ${d.value} assessments`}
            ></div>
            <span className="trend-month-label">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricProps {
  title: string;
  value: string;
  badge: string;
  subtitle: string;
  sparkValues: number[];
  icon: React.ReactNode;
  sparkColor?: string;
}

const MetricCard: React.FC<MetricProps> = ({ title, value, badge, subtitle, sparkValues, icon, sparkColor = "#94a3b8" }) => (
  <div className="metric-card">
    <div className="metric-header-row">
      <div className="metric-icon-box">{icon}</div>
    </div>
    <div className="metric-title">{title}</div>
    <div className="metric-value-row">
      <span className="metric-value">{value}</span>
      <div className="metric-badge">
        <ArrowUp size={10} style={{ marginRight: 2 }} />
        {badge}
      </div>
    </div>
    <div className="metric-footer-row">
      <span className="metric-subtitle">{subtitle}</span>
      <Sparkline values={sparkValues} color={sparkColor} />
    </div>
  </div>
);

// App Root
// Dataset Metric Card Component
const DatasetMetricCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}> = ({ title, value, subtitle, icon, iconBg, iconColor }) => (
  <div className="dataset-metric-card" style={{
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  }}>
    <div style={{
      width: '42px',
      height: '42px',
      borderRadius: '8px',
      background: iconBg,
      color: iconColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      {icon}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: '11px', color: '#667085', fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: '18px', fontWeight: 800, color: '#1c2738', lineHeight: 1.2, margin: '2px 0' }}>{value}</span>
      <span style={{ fontSize: '11px', color: '#667085' }}>{subtitle}</span>
    </div>
  </div>
);

// Dataset Page Component matching screenshot
const DatasetView: React.FC<{
  api: ApiState<DatasetResponse>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  limit: number;
  setLimit: React.Dispatch<React.SetStateAction<number>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  onViewReport: (patient: any) => void;
}> = ({ api, page, setPage, limit, setLimit, search, setSearch, onViewReport }) => {
  const dataset = api.data;
  const previewRows = dataset?.preview ?? [
    { row_id: 0, Age: 63, Sex: 'Male', ChestPainType: 'TA', RestingBP: 145, Cholesterol: 233, FastingBS: 1, RestingECG: 'ST', MaxHR: 150, ExerciseAngina: 'No', Oldpeak: 2.3, ST_Slope: 'Down', HeartDisease: 1 },
    { row_id: 1, Age: 37, Sex: 'Female', ChestPainType: 'ATA', RestingBP: 130, Cholesterol: 250, FastingBS: 0, RestingECG: 'Normal', MaxHR: 187, ExerciseAngina: 'No', Oldpeak: 3.5, ST_Slope: 'Up', HeartDisease: 1 },
    { row_id: 2, Age: 41, Sex: 'Male', ChestPainType: 'NAP', RestingBP: 130, Cholesterol: 204, FastingBS: 0, RestingECG: 'ST', MaxHR: 172, ExerciseAngina: 'No', Oldpeak: 1.4, ST_Slope: 'Flat', HeartDisease: 0 },
    { row_id: 3, Age: 56, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 120, Cholesterol: 236, FastingBS: 0, RestingECG: 'LVH', MaxHR: 178, ExerciseAngina: 'No', Oldpeak: 0.8, ST_Slope: 'Up', HeartDisease: 0 },
    { row_id: 4, Age: 57, Sex: 'Female', ChestPainType: 'TA', RestingBP: 120, Cholesterol: 354, FastingBS: 0, RestingECG: 'LVH', MaxHR: 163, ExerciseAngina: 'Yes', Oldpeak: 0.6, ST_Slope: 'Up', HeartDisease: 1 }
  ];
  const metadata = dataset?.metadata ?? {
    dataset_name: 'Heart Disease Prediction',
    rows: 918,
    total_rows_all: 918,
    columns: 11,
    target: 'HeartDisease',
    missing_values_pct: 0,
    numeric_features: 7,
    categorical_features: 3,
    binary_features: 1,
  };
  const numericSummary = dataset?.numeric_summary ?? [];
  const targetDistribution = dataset?.target_distribution ?? [
    { label: 'No Disease (0)', count: 410 },
    { label: 'Heart Disease (1)', count: 508 },
  ];
  const totalRows = metadata.rows;
  const totalRowsAll = (metadata as any).total_rows_all ?? 918;
  const [editingRow, setEditingRow] = useState<Record<string, string | number> | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string | number> | null>(null);
  const [datasetActionError, setDatasetActionError] = useState<string | null>(null);

  const beginEdit = (row: Record<string, string | number>) => {
    setDatasetActionError(null);
    setEditingRow(row);
    setEditDraft({ ...row });
  };

  const handleDeleteRow = async (rowId: number) => {
    const confirmed = window.confirm('Remove this dataset row?');
    if (!confirmed) return;
    try {
      setDatasetActionError(null);
      await fetchJson(`/api/dataset/rows/${rowId}`, { method: 'DELETE' });
      await api.refresh();
      setEditingRow(null);
      setEditDraft(null);
    } catch (err) {
      setDatasetActionError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSaveRow = async () => {
    if (!editingRow || !editDraft) return;
    try {
      setDatasetActionError(null);
      await fetchJson(`/api/dataset/rows/${Number(editingRow.row_id)}`, {
        method: 'PUT',
        body: JSON.stringify(editDraft),
      });
      await api.refresh();
      setEditingRow(null);
      setEditDraft(null);
    } catch (err) {
      setDatasetActionError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleExport = async () => {
    window.location.href = `${API_BASE}/api/dataset/export`;
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionStatus loading={api.loading} error={api.error} onRetry={api.refresh} />
      {datasetActionError && <div style={{ borderRadius: '8px', padding: '10px 12px', fontSize: '11px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{datasetActionError}</div>}
      {/* Header and actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939' }}>Dataset</h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            Explore and understand the data used for cardiovascular disease prediction.
          </p>
        </div>
        <div className="topbar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#667085' }} />
            <input 
              type="text" 
              style={{ 
                width: '200px', 
                background: '#ffffff', 
                border: '1px solid #e2e8f0', 
                color: '#1d2939', 
                borderRadius: '8px', 
                height: '36px', 
                paddingLeft: '34px', 
                fontSize: '12px',
                outline: 'none'
              }} 
              placeholder="Search dataset..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button onClick={handleExport} className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} />
            Export Dataset
          </button>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid 5 metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <DatasetMetricCard title="Dataset Name" value={metadata.dataset_name} subtitle="Classification Dataset" icon={<Folder size={18} />} iconBg="#f9f5ff" iconColor="#7f56d9" />
        <DatasetMetricCard title="Total Records" value={metadata.rows.toLocaleString()} subtitle="Rows" icon={<Database size={18} />} iconBg="#eff8ff" iconColor="#175cd3" />
        <DatasetMetricCard title="Total Features" value={metadata.columns.toString()} subtitle="Columns" icon={<Grid size={18} />} iconBg="#ecfdf3" iconColor="#027a48" />
        <DatasetMetricCard title="Target Variable" value={metadata.target} subtitle="Binary (0 / 1)" icon={<Target size={18} />} iconBg="#fef3f2" iconColor="#b42318" />
        <DatasetMetricCard title="Missing Values" value={`${metadata.missing_values_pct}%`} subtitle="Complete Data" icon={<CheckCircle size={18} />} iconBg="#ecfdf3" iconColor="#12b76a" />
      </div>

      {/* Second row split */}
      <div className="grid-3-split">
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '210px' }}>
          <span className="section-title">Target Distribution</span>
          <div className="distribution-row" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="distribution-chart-wrapper" style={{ width: '90px', height: '90px', position: 'relative' }}>
              <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="9" />
                {/* Red segment: 55.3% (Heart Disease) -> stroke-dashoffset = circumference * (1 - 0.553) */}
                {/* Circumference = 2 * PI * 38 = 238.76 */}
                {/* Red dash offset = 238.76 * (1 - 0.553) = 106.7 */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="38" 
                  fill="transparent" 
                  stroke="#ef4444" 
                  strokeWidth="9" 
                  strokeDasharray="238.76" 
                  strokeDashoffset="106.7" 
                  strokeLinecap="round"
                />
                {/* Green segment: 44.7% (No Disease) -> starts at rotation 55.3% * 360 = 199deg */}
                {/* Green dash offset = 238.76 * (1 - 0.447) = 132 */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="38" 
                  fill="transparent" 
                  stroke="#22c55e" 
                  strokeWidth="9" 
                  strokeDasharray="238.76" 
                  strokeDashoffset="132" 
                  strokeLinecap="round"
                  style={{
                    transformOrigin: '50px 50px',
                    transform: 'rotate(199deg)'
                  }}
                />
              </svg>
              <div className="distribution-center-label" style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <span className="distribution-center-val" style={{ fontSize: '16px', fontWeight: 800, color: '#1d2939' }}>{totalRowsAll}</span>
                <span className="distribution-center-lbl" style={{ fontSize: '9px', color: '#667085', fontWeight: 600 }}>Total</span>
              </div>
            </div>
            <div className="distribution-legend" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Heart Disease (1)</span>
                </div>
                <span style={{ fontWeight: 700, color: '#1d2939' }}>{targetDistribution.find((item) => String(item.label).includes('1'))?.count ?? 0} ({(((targetDistribution.find((item) => String(item.label).includes('1'))?.count ?? 0) / totalRowsAll) * 100).toFixed(1)}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                  <span style={{ color: '#475569', fontWeight: 600 }}>No Disease (0)</span>
                </div>
                <span style={{ fontWeight: 700, color: '#1d2939' }}>{targetDistribution.find((item) => String(item.label).includes('0'))?.count ?? 0} ({(((targetDistribution.find((item) => String(item.label).includes('0'))?.count ?? 0) / totalRowsAll) * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#667085', textAlign: 'center', marginTop: 'auto', display: 'block', fontWeight: 600, borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>Balanced Target Distribution</span>
        </div>

        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '210px' }}>
          <span className="section-title">Feature Types</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', width: '22px', height: '22px', background: '#eff8ff', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: '#175cd3', fontSize: '10px', fontWeight: 800 }}>123</span>
                  <span style={{ color: '#475569' }}>Numeric Features</span>
                </div>
                <span style={{ color: '#1d2939' }}>{metadata.numeric_features}</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(metadata.numeric_features / metadata.columns) * 100}%`, background: '#3b82f6', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', width: '22px', height: '22px', background: '#f9f5ff', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: '#6941c6', fontSize: '10px', fontWeight: 800 }}>Aa</span>
                  <span style={{ color: '#475569' }}>Categorical Features</span>
                </div>
                <span style={{ color: '#1d2939' }}>{metadata.categorical_features}</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(metadata.categorical_features / metadata.columns) * 100}%`, background: '#8b5cf6', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', width: '22px', height: '22px', background: '#fff6ed', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: '#c4320a', fontSize: '10px', fontWeight: 800 }}>01</span>
                  <span style={{ color: '#475569' }}>Binary Features</span>
                </div>
                <span style={{ color: '#1d2939' }}>{metadata.binary_features}</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(metadata.binary_features / metadata.columns) * 100}%`, background: '#f97316', borderRadius: '3px' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '210px', textAlign: 'center', justifyContent: 'space-between' }}>
          <span className="section-title" style={{ alignSelf: 'flex-start' }}>Missing Values Overview</span>
          <div style={{ margin: 'auto 0' }}>
            <p style={{ color: '#667085', fontSize: '12px', marginBottom: '12px' }}>No missing values in the dataset.</p>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ecfdf3', border: '1px solid #d1fadf', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#12b76a', marginBottom: '10px' }}>
              <CheckCircle size={22} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#12b76a' }}>100% Complete</div>
          </div>
        </div>
      </div>

      {/* Row 3 Preview Table */}
      <div className="custom-table-card" style={{ padding: '18px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <div className="custom-table-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span className="section-title" style={{ margin: 0 }}>Sample Data Preview</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#667085' }} />
              <input 
                type="text" 
                style={{ width: '140px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#1d2939', height: '30px', paddingLeft: '28px', borderRadius: '6px', fontSize: '11px', outline: 'none' }} 
                placeholder="Search..." 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <button className="topbar-pill" style={{ padding: '4px 10px', fontSize: '11px', height: '30px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={11} /> Filter
            </button>
            <button className="topbar-pill" style={{ padding: '4px 10px', fontSize: '11px', height: '30px', border: '1px solid #e2e8f0' }}>
              <MoreHorizontal size={12} />
            </button>
          </div>
        </div>

        <table className="custom-table" style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>S.No</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Age</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Sex</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>ChestPainType</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>RestingBP</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Cholesterol</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>FastingBS</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>RestingECG</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>MaxHR</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>ExerciseAngina</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Oldpeak</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>ST_Slope</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>HeartDisease</th>
              <th style={{ padding: '10px 8px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 8px', fontWeight: 600, color: '#667085' }}>{(page - 1) * limit + i + 1}</td>
                <td style={{ padding: '10px 8px', fontWeight: 600, color: '#1d2939' }}>{d.Age}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.Sex}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.ChestPainType}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.RestingBP}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.Cholesterol}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.FastingBS}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.RestingECG}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.MaxHR}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.ExerciseAngina}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.Oldpeak}</td>
                <td style={{ padding: '10px 8px', color: '#334155' }}>{d.ST_Slope}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span className={Number(d.HeartDisease) === 1 ? 'badge-danger' : 'badge-success'}>
                    {d.HeartDisease}
                  </span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => {
                        onViewReport(d);
                      }} 
                      className="topbar-pill" 
                      style={{ height: '26px', padding: '0 8px', fontSize: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="View Report"
                    >
                      <Eye size={10} />
                      View
                    </button>
                    <button onClick={() => beginEdit(d)} className="topbar-pill" style={{ height: '26px', padding: '0 8px', fontSize: '10px', border: '1px solid #e2e8f0' }}>Edit</button>
                    <button onClick={() => handleDeleteRow(Number(d.row_id))} className="topbar-pill" style={{ height: '26px', padding: '0 8px', fontSize: '10px', border: '1px solid #fecaca', color: '#b42318', background: '#fff5f5' }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '11px', color: '#667085' }}>
          <span>Showing {totalRows === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalRows)} of {totalRows.toLocaleString()} entries</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="topbar-pill" 
              style={{ padding: '2px 8px', height: '26px', fontSize: '11px', border: '1px solid #e2e8f0', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(5, Math.ceil(totalRows / limit) || 1) }, (_, i) => {
              const totalPages = Math.ceil(totalRows / limit) || 1;
              let pNum = i + 1;
              if (totalPages > 5) {
                if (page > 3) {
                  pNum = page - 3 + i;
                }
                if (page > totalPages - 2) {
                  pNum = totalPages - 5 + i + 1;
                }
              }
              return (
                <button 
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className="topbar-pill" 
                  style={{ 
                    padding: '2px 8px', 
                    height: '26px', 
                    fontSize: '11px', 
                    background: page === pNum ? '#cbd5e1' : 'transparent', 
                    color: '#1d2939', 
                    border: '1px solid #e2e8f0', 
                    fontWeight: page === pNum ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {pNum}
                </button>
              );
            })}
            <button 
              disabled={page === (Math.ceil(totalRows / limit) || 1)}
              onClick={() => setPage(p => Math.min(Math.ceil(totalRows / limit) || 1, p + 1))}
              className="topbar-pill" 
              style={{ padding: '2px 8px', height: '26px', fontSize: '11px', border: '1px solid #e2e8f0', cursor: page === (Math.ceil(totalRows / limit) || 1) ? 'not-allowed' : 'pointer', opacity: page === (Math.ceil(totalRows / limit) || 1) ? 0.5 : 1 }}
            >
              &gt;
            </button>
          </div>
        </div>

        {editingRow && editDraft && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <span className="section-title">Edit Row #{Number(editingRow.row_id)}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', marginTop: '10px' }}>
              {[
                ['Age', 'number'],
                ['Sex', 'text'],
                ['ChestPainType', 'text'],
                ['RestingBP', 'number'],
                ['Cholesterol', 'number'],
                ['FastingBS', 'number'],
                ['RestingECG', 'text'],
                ['MaxHR', 'number'],
                ['ExerciseAngina', 'text'],
                ['Oldpeak', 'number'],
                ['ST_Slope', 'text'],
                ['HeartDisease', 'number'],
              ].map(([field, type]) => (
                <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', color: '#475569', fontWeight: 700 }}>
                  {field}
                  <input
                    type={type}
                    value={String(editDraft[field] ?? '')}
                    onChange={(e) => setEditDraft({ ...editDraft, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                    style={{ height: '30px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none', background: '#ffffff' }}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => { setEditingRow(null); setEditDraft(null); }} className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '32px' }}>Cancel</button>
              <button onClick={handleSaveRow} className="topbar-pill" style={{ background: '#111827', color: '#ffffff', border: 'none', height: '32px', padding: '0 16px' }}>Update Row</button>
            </div>
          </div>
        )}
      </div>

      {/* Row 4 Bottom Splits */}
      <div className="grid-3-split">
        <div className="custom-table-card" style={{ padding: '18px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <span className="section-title">Summary Statistics (Numeric)</span>
          <table className="custom-table" style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 4px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Feature</th>
                <th style={{ padding: '8px 4px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Mean</th>
                <th style={{ padding: '8px 4px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Median</th>
                <th style={{ padding: '8px 4px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Min</th>
                <th style={{ padding: '8px 4px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Max</th>
                <th style={{ padding: '8px 4px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Std Dev</th>
              </tr>
            </thead>
            <tbody>
              {(numericSummary.length ? numericSummary : [
                { feature: 'Age', mean: 53.51, median: 54, min: 29, max: 77, std: 9.43 },
                { feature: 'RestingBP', mean: 132.4, median: 130, min: 94, max: 200, std: 17.48 },
                { feature: 'Cholesterol', mean: 198.8, median: 223, min: 126, max: 564, std: 109.38 },
                { feature: 'MaxHR', mean: 136.81, median: 138, min: 60, max: 202, std: 25.46 },
                { feature: 'Oldpeak', mean: 0.89, median: 0.8, min: 0, max: 6.2, std: 1.07 },
              ]).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600, color: '#1d2939' }}>{String(row.feature)}</td>
                  <td style={{ padding: '8px 4px', color: '#334155' }}>{Number(row.mean).toFixed(2)}</td>
                  <td style={{ padding: '8px 4px', color: '#334155' }}>{Number(row.median).toFixed(0)}</td>
                  <td style={{ padding: '8px 4px', color: '#334155' }}>{Number(row.min).toFixed(0)}</td>
                  <td style={{ padding: '8px 4px', color: '#334155' }}>{Number(row.max).toFixed(0)}</td>
                  <td style={{ padding: '8px 4px', color: '#334155' }}>{Number(row.std).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <span className="section-title">Correlation with Target (Top 5)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                <span style={{ color: '#475569' }}>ST_Slope</span>
                <span style={{ color: '#1d2939' }}>0.62</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', display: 'flex' }}>
                <div style={{ height: '100%', width: '62%', background: '#f04438', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                <span style={{ color: '#475569' }}>ExerciseAngina</span>
                <span style={{ color: '#1d2939' }}>0.49</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', display: 'flex' }}>
                <div style={{ height: '100%', width: '49%', background: '#f04438', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                <span style={{ color: '#475569' }}>Oldpeak</span>
                <span style={{ color: '#1d2939' }}>0.41</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', display: 'flex' }}>
                <div style={{ height: '100%', width: '41%', background: '#f04438', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                <span style={{ color: '#475569' }}>ChestPainType</span>
                <span style={{ color: '#1d2939' }}>0.39</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', display: 'flex' }}>
                <div style={{ height: '100%', width: '39%', background: '#f04438', borderRadius: '3px' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                <span style={{ color: '#475569' }}>MaxHR</span>
                <span style={{ color: '#1d2939' }}>-0.34</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', position: 'relative' }}>
                <div style={{ height: '100%', width: '34%', background: '#2e90fa', borderRadius: '3px' }}></div>
              </div>
            </div>
          </div>
          <span style={{ fontSize: '10px', color: '#667085', textAlign: 'center', marginTop: 'auto', display: 'block', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            Correlation with HeartDisease (1)
          </span>
        </div>

        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <span className="section-title">Data Quality</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {[
              'No missing values',
              'Balanced target distribution',
              'No duplicate records',
              'All features within valid range',
              'Dataset is clean and ready for modeling'
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ display: 'inline-flex', width: '16px', height: '16px', background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: '#12b76a', flexShrink: 0 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <span style={{ color: '#344054', fontWeight: 600 }}>{item}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: '10px', color: '#667085', marginTop: 'auto', display: 'block', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
            Last updated: Today, 10:30 AM
          </span>
        </div>
      </div>
    </div>
  );
};

// EDA View Component matching screenshot
const EDAView: React.FC<{ api: ApiState<EdaStatsResponse> }> = ({ api }) => {
  const stats = api.data;
  const populationStats = [
    { title: 'Total Patients', value: String(stats?.population.total_patients ?? 918), subtitle: '100%', bg: '#eff8ff', color: '#175cd3', icon: '👥' },
    { title: 'Healthy (0)', value: String(stats?.population.healthy ?? 410), subtitle: `${(((stats?.population.healthy ?? 410) / (stats?.population.total_patients ?? 918)) * 100).toFixed(1)}%`, bg: '#ecfdf3', color: '#027a48', icon: '🟢' },
    { title: 'At Risk (1)', value: String(stats?.population.at_risk ?? 508), subtitle: `${(((stats?.population.at_risk ?? 508) / (stats?.population.total_patients ?? 918)) * 100).toFixed(1)}%`, bg: '#fef3f2', color: '#b42318', icon: '🔴' },
    { title: 'Avg Age', value: (stats?.population.avg_age ?? 53.6).toFixed(1), subtitle: 'Years', bg: '#eff8ff', color: '#175cd3', icon: '⏳' },
    { title: 'Avg Cholesterol', value: (stats?.population.avg_cholesterol ?? 198.8).toFixed(1), subtitle: 'mg/dL', bg: '#ecfdf3', color: '#027a48', icon: '🔬' },
    { title: 'Avg Resting BP', value: (stats?.population.avg_resting_bp ?? 132.4).toFixed(1), subtitle: 'mmHg', bg: '#fef3f2', color: '#b42318', icon: '❤️' }
  ];
  const targetCounts = {
    positive: Number(stats?.target_distribution?.[1] ?? 508),
    negative: Number(stats?.target_distribution?.[0] ?? 410),
  };
  const sexCounts = stats?.sex_distribution ?? { Male: 725, Female: 193 };
  const totalPatients = stats?.population.total_patients ?? 918;
  const fastingAbove = 248;
  const fastingBelow = totalPatients - fastingAbove;

  // Correlation heatmap labels & values (7x7)
  const heatmapLabels = ['Age', 'Cholesterol', 'RestingBP', 'MaxHR', 'Oldpeak', 'ST_Slope', 'HeartDisease'];
  const heatmapData = [
    [1.0, 0.22, 0.28, -0.38, 0.26, 0.27, 0.28],
    [0.22, 1.0, 0.12, -0.04, 0.05, 0.07, 0.23],
    [0.28, 0.12, 1.0, -0.11, 0.16, 0.10, 0.11],
    [-0.38, -0.04, -0.11, 1.0, -0.16, -0.42, -0.40],
    [0.26, 0.05, 0.16, -0.16, 1.0, 0.58, 0.40],
    [0.27, 0.07, 0.10, -0.42, 0.58, 1.0, 0.56],
    [0.28, 0.23, 0.11, -0.40, 0.40, 0.56, 1.0]
  ];

  // Helper to color heatmap boxes based on value
  const getHeatmapColor = (val: number) => {
    if (val === 1) return '#d9381e'; // deep positive
    if (val > 0.5) return '#f0624d';
    if (val > 0.2) return '#fee4e2';
    if (val > 0) return '#fef3f2';
    if (val > -0.2) return '#eff8ff';
    if (val > -0.5) return '#93c5fd';
    return '#175cd3'; // deep negative
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <SectionStatus loading={api.loading} error={api.error} onRetry={api.refresh} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939' }}>EDA</h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            Explore patient population, risk patterns, and key clinical signals.
          </p>
        </div>
      </div>

      {/* Row 1: Population Overview & Risk Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '16px' }}>
        {/* Section 1: Population Overview */}
        <div className="info-card" style={{ padding: '18px 20px' }}>
          <span className="section-title">1. Population Overview</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginTop: '12px' }}>
            {populationStats.map((stat, idx) => (
              <div key={idx} style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
              }}>
                <span style={{
                  fontSize: '14px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: stat.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px'
                }}>{stat.icon}</span>
                <span style={{ fontSize: '10px', color: '#667085', fontWeight: 600, display: 'block', height: '24px', overflow: 'hidden' }}>{stat.title}</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#1d2939', margin: '4px 0 2px 0' }}>{stat.value}</span>
                <span style={{ fontSize: '9px', color: stat.color, fontWeight: 700 }}>{stat.subtitle}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Risk Distribution */}
        <div className="info-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span className="section-title">2. Risk Distribution</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: 'auto 0' }}>
            <div style={{ width: '80px', height: '80px', position: 'relative' }}>
              <svg width="80" height="80" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#ef4444" strokeWidth="10" strokeDasharray="238.76" strokeDashoffset="106.7" strokeLinecap="round" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#22c55e" strokeWidth="10" strokeDasharray="238.76" strokeDashoffset="132" strokeLinecap="round" style={{ transformOrigin: '50px 50px', transform: 'rotate(199deg)' }} />
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#1d2939' }}>{totalPatients}</span>
                <span style={{ fontSize: '8px', color: '#667085', fontWeight: 600 }}>Total</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
                  <span style={{ color: '#475569', fontWeight: 600 }}>HeartDisease (1)</span>
                </div>
                <span style={{ fontWeight: 700, color: '#1d2939' }}>{targetCounts.positive} ({((targetCounts.positive / totalPatients) * 100).toFixed(1)}%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }}></span>
                  <span style={{ color: '#475569', fontWeight: 600 }}>No HeartDisease (0)</span>
                </div>
                <span style={{ fontWeight: 700, color: '#1d2939' }}>{targetCounts.negative} ({((targetCounts.negative / totalPatients) * 100).toFixed(1)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Demographic Insights */}
      <div className="info-card" style={{ padding: '18px 20px' }}>
        <span className="section-title">3. Demographic Insights</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '12px' }}>
          {/* Age Distribution Chart */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Age Distribution</span>
            <div style={{ height: '110px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 4px', borderBottom: '1px solid #e2e8f0' }}>
              {[12, 35, 78, 145, 120, 48, 10].map((h, i) => (
                <div key={i} style={{ width: '10%', height: `${h}%`, background: '#a78bfa', borderRadius: '2px 2px 0 0', position: 'relative' }} title={`Count: ${h}`}></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>20</span><span>30</span><span>40</span><span>50</span><span>60</span><span>70</span><span>80</span>
            </div>
          </div>

          {/* Sex Distribution Chart */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block' }}>Sex Distribution</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 'auto 0' }}>
              <div style={{ width: '60px', height: '60px', position: 'relative', flexShrink: 0 }}>
                <svg width="60" height="60" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#3b82f6" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="50" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f472b6" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="188.76" strokeLinecap="round" style={{ transformOrigin: '50px 50px', transform: 'rotate(284deg)' }} />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d2939' }}>{totalPatients}</span>
                  <span style={{ fontSize: '6px', color: '#667085' }}>Total</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>Male</span>
                  <span style={{ fontWeight: 700 }}>{sexCounts.Male ?? 725} ({(((sexCounts.Male ?? 725) / totalPatients) * 100).toFixed(1)}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#f472b6', fontWeight: 600 }}>Female</span>
                  <span style={{ fontWeight: 700 }}>{sexCounts.Female ?? 193} ({(((sexCounts.Female ?? 193) / totalPatients) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Age by Risk Outcome */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Age by Risk Outcome</span>
            <div style={{ height: '110px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
              {/* Double columns: [Healthy, AtRisk] for brackets */}
              {[[15, 8], [32, 28], [75, 95], [68, 120], [12, 45]].map((pair, i) => {
                const maxVal = 120;
                return (
                  <div key={i} style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '100%', width: '15%' }}>
                    <div style={{ width: '45%', height: `${(pair[0] / maxVal) * 90}%`, background: '#22c55e', borderRadius: '1px 1px 0 0' }}></div>
                    <div style={{ width: '45%', height: `${(pair[1] / maxVal) * 90}%`, background: '#ef4444', borderRadius: '1px 1px 0 0' }}></div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>20-30</span><span>30-40</span><span>40-50</span><span>50-60</span><span>60+</span>
            </div>
          </div>

          {/* Disease Rate by Sex */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '-4px' }}>Disease Rate by Sex</span>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>
                <span style={{ color: '#475569' }}>Male</span>
                <span style={{ color: '#1d2939', fontWeight: 700 }}>58.1%</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '58.1%', background: '#3b82f6', borderRadius: '3px' }}></div>
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>
                <span style={{ color: '#475569' }}>Female</span>
                <span style={{ color: '#1d2939', fontWeight: 700 }}>49.2%</span>
              </div>
              <div style={{ height: '6px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '49.2%', background: '#f472b6', borderRadius: '3px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Clinical Metrics Trends */}
      <div className="info-card" style={{ padding: '18px 20px' }}>
        <span className="section-title">4. Clinical Metrics Trends</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '12px' }}>
          {/* Cholesterol Distribution */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Cholesterol (mg/dL)</span>
            <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '2px', borderBottom: '1px solid #e2e8f0' }}>
              {[8, 15, 38, 72, 98, 70, 42, 22, 8, 4].map((h, i) => (
                <div key={i} style={{ width: '8%', height: `${h}%`, background: '#60a5fa', borderRadius: '1px' }}></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>100</span><span>150</span><span>200</span><span>250</span><span>300</span><span>350</span><span>400</span>
            </div>
          </div>

          {/* Resting BP Distribution */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Resting BP (mmHg)</span>
            <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '2px', borderBottom: '1px solid #e2e8f0' }}>
              {[4, 12, 48, 88, 62, 58, 30, 18, 5, 2].map((h, i) => (
                <div key={i} style={{ width: '8%', height: `${h}%`, background: '#34d399', borderRadius: '1px' }}></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>80</span><span>100</span><span>120</span><span>140</span><span>160</span><span>180</span><span>200</span>
            </div>
          </div>

          {/* Max Heart Rate Distribution */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Max Heart Rate (bpm)</span>
            <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '2px', borderBottom: '1px solid #e2e8f0' }}>
              {[2, 8, 22, 45, 68, 92, 78, 48, 20, 5].map((h, i) => (
                <div key={i} style={{ width: '8%', height: `${h}%`, background: '#a78bfa', borderRadius: '1px' }}></div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>60</span><span>80</span><span>100</span><span>120</span><span>140</span><span>160</span><span>180</span><span>200</span>
            </div>
          </div>

          {/* Fasting Blood Sugar Donut */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block' }}>Fasting Blood Sugar</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 'auto 0' }}>
              <div style={{ width: '56px', height: '56px', position: 'relative', flexShrink: 0 }}>
                <svg width="56" height="56" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f97316" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="174" strokeLinecap="round" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#22c55e" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="64" strokeLinecap="round" style={{ transformOrigin: '50px 50px', transform: 'rotate(97deg)' }} />
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '8px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>&gt; 120 mg/dL</span>
                  <span style={{ fontWeight: 700 }}>{fastingAbove} ({((fastingAbove / totalPatients) * 100).toFixed(1)}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>&lt; 120 mg/dL</span>
                  <span style={{ fontWeight: 700 }}>{fastingBelow} ({((fastingBelow / totalPatients) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Symptom & Condition Patterns */}
      <div className="info-card" style={{ padding: '18px 20px' }}>
        <span className="section-title">5. Symptom & Condition Patterns</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '12px' }}>
          {/* Chest Pain Type */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textAlign: 'center' }}>Chest Pain Type</span>
            <div style={{ height: '110px', display: 'flex', gap: '14px', justifyContent: 'center', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              {/* Stacked percentages: [Healthy%, AtRisk%] */}
              {[[28, 72], [85, 15], [74, 26], [21, 79]].map((stack, i) => (
                <div key={i} style={{ width: '14px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: `${stack[0]}%`, background: '#22c55e' }}></div>
                  <div style={{ height: `${stack[1]}%`, background: '#ef4444' }}></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '9px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>TA</span><span>ATA</span><span>NAP</span><span>ASY</span>
            </div>
          </div>

          {/* Exercise Angina */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textAlign: 'center' }}>Exercise Angina</span>
            <div style={{ height: '110px', display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              {[[15, 85], [68, 32]].map((stack, i) => (
                <div key={i} style={{ width: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: `${stack[0]}%`, background: '#22c55e' }}></div>
                  <div style={{ height: `${stack[1]}%`, background: '#ef4444' }}></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '9px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>Yes</span><span>No</span>
            </div>
          </div>

          {/* Resting ECG */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textAlign: 'center' }}>Resting ECG</span>
            <div style={{ height: '110px', display: 'flex', gap: '14px', justifyContent: 'center', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              {[[52, 48], [42, 58], [45, 55]].map((stack, i) => (
                <div key={i} style={{ width: '15px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: `${stack[0]}%`, background: '#22c55e' }}></div>
                  <div style={{ height: `${stack[1]}%`, background: '#ef4444' }}></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '9px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>Normal</span><span>ST</span><span>LVH</span>
            </div>
          </div>

          {/* ST Slope */}
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textAlign: 'center' }}>ST Slope</span>
            <div style={{ height: '110px', display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
              {[[22, 78], [48, 52]].map((stack, i) => (
                <div key={i} style={{ width: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: `${stack[0]}%`, background: '#22c55e' }}></div>
                  <div style={{ height: `${stack[1]}%`, background: '#ef4444' }}></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '9px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>Flat</span><span>Down</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '10px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></span>
            <span style={{ color: '#667085', fontWeight: 600 }}>No HeartDisease (0)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
            <span style={{ color: '#667085', fontWeight: 600 }}>HeartDisease (1)</span>
          </div>
        </div>
      </div>

      {/* Row 5: Feature Relationships */}
      <div className="info-card" style={{ padding: '18px 20px' }}>
        <span className="section-title">6. Feature Relationships</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
          {/* Correlation Heatmap */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>Correlation Heatmap</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {heatmapData.map((row, rIdx) => (
                <div key={rIdx} style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  {row.map((val, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        width: '20px',
                        height: '20px',
                        background: getHeatmapColor(val),
                        borderRadius: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '7px',
                        fontWeight: 700,
                        color: Math.abs(val) > 0.5 ? '#ffffff' : '#1d2939'
                      }}
                      title={`${heatmapLabels[rIdx]} & ${heatmapLabels[cIdx]}: ${val}`}
                    >
                      {val.toFixed(1)}
                    </div>
                  ))}
                  <span style={{ fontSize: '8px', color: '#667085', marginLeft: '6px', fontWeight: 600, width: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{heatmapLabels[rIdx]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
              {heatmapLabels.map((lbl, idx) => (
                <span key={idx} style={{ fontSize: '7px', color: '#667085', fontWeight: 600, width: '20px', textAlign: 'center', overflow: 'hidden' }}>{lbl.slice(0, 3)}</span>
              ))}
            </div>
          </div>

          {/* Scatter Plot Age vs MaxHR */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Age vs Max Heart Rate</span>
            <div style={{ position: 'relative', height: '120px', width: '100%', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', marginTop: '6px' }}>
              {/* Dummy SVG representing scatter plot */}
              <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Draw dotted guidelines */}
                <line x1="0" y1="50" x2="100" y2="50" stroke="#cbd5e1" strokeDasharray="2" strokeWidth="0.5" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="#cbd5e1" strokeDasharray="2" strokeWidth="0.5" />
                {/* Healthy dots (green) - mostly younger or higher max heart rate */}
                <circle cx="20" cy="30" r="1.5" fill="#22c55e" />
                <circle cx="35" cy="25" r="1.5" fill="#22c55e" />
                <circle cx="45" cy="40" r="1.5" fill="#22c55e" />
                <circle cx="50" cy="35" r="1.5" fill="#22c55e" />
                <circle cx="60" cy="55" r="1.5" fill="#22c55e" />
                <circle cx="30" cy="50" r="1.5" fill="#22c55e" />
                <circle cx="40" cy="45" r="1.5" fill="#22c55e" />
                {/* HeartDisease dots (red) - older or lower max heart rate */}
                <circle cx="55" cy="65" r="1.5" fill="#ef4444" />
                <circle cx="65" cy="70" r="1.5" fill="#ef4444" />
                <circle cx="70" cy="62" r="1.5" fill="#ef4444" />
                <circle cx="80" cy="75" r="1.5" fill="#ef4444" />
                <circle cx="60" cy="80" r="1.5" fill="#ef4444" />
                <circle cx="75" cy="58" r="1.5" fill="#ef4444" />
                <circle cx="50" cy="68" r="1.5" fill="#ef4444" />
              </svg>
              {/* Y Axis label */}
              <span style={{ position: 'absolute', left: '-22px', top: '40%', transform: 'rotate(-90deg)', fontSize: '7px', color: '#667085', fontWeight: 600 }}>MaxHR (bpm)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: '#667085', marginTop: '4px', fontWeight: 600 }}>
              <span>20</span><span>40</span><span>60</span><span>80</span>
            </div>
            <span style={{ textAlign: 'center', fontSize: '8px', color: '#667085', fontWeight: 600, marginTop: '2px' }}>Age (years)</span>
          </div>

          {/* Cholesterol by Outcome (Box Plot) */}
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Cholesterol by Outcome</span>
            <div style={{ display: 'flex', justifyContent: 'space-around', height: '120px', alignItems: 'center', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', padding: '10px 0' }}>
              {/* Healthy Box Plot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', position: 'relative', width: '30%' }}>
                <div style={{ width: '1px', height: '80%', background: '#22c55e', position: 'absolute' }}></div>
                <div style={{ width: '20px', height: '40px', background: '#ecfdf3', border: '1.5px solid #22c55e', zIndex: 2 }}></div>
                <line style={{ width: '10px', height: '1.5px', background: '#22c55e', zIndex: 3, position: 'absolute', top: '50%' }}></line>
                <span style={{ fontSize: '8px', color: '#667085', position: 'absolute', bottom: '-16px', fontWeight: 600 }}>Healthy (0)</span>
              </div>

              {/* HeartDisease Box Plot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center', position: 'relative', width: '30%' }}>
                <div style={{ width: '1px', height: '85%', background: '#ef4444', position: 'absolute' }}></div>
                <div style={{ width: '20px', height: '46px', background: '#fef3f2', border: '1.5px solid #ef4444', zIndex: 2 }}></div>
                <line style={{ width: '10px', height: '1.5px', background: '#ef4444', zIndex: 3, position: 'absolute', top: '45%' }}></line>
                <span style={{ fontSize: '8px', color: '#667085', position: 'absolute', bottom: '-16px', fontWeight: 600 }}>Disease (1)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 6: Key Risk Signals & Data Quality Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        {/* Key Risk Signals */}
        <div className="info-card" style={{ padding: '18px 20px' }}>
          <span className="section-title">7. Key Risk Signals</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {[
              { label: 'Higher Oldpeak', desc: 'Oldpeak levels are notably higher in patients with heart disease.', icon: '⬆️', color: '#fef3f2', text: '#b42318' },
              { label: 'Exercise-Induced Angina', desc: 'Strong association with heart disease presence.', icon: '⚠️', color: '#fff6ed', text: '#c4320a' },
              { label: 'Flat ST Slope', desc: 'Flat ST slope appears more frequently in higher-risk patients.', icon: '📉', color: '#eff8ff', text: '#175cd3' },
              { label: 'Chest Pain Type (ASY)', desc: 'Asymptomatic chest pain type shows higher risk concentration.', icon: '🧬', color: '#f9f5ff', text: '#6941c6' }
            ].map((sig, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: sig.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>{sig.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>{sig.label}</span>
                  <span style={{ fontSize: '10px', color: '#667085' }}>{sig.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Quality Summary */}
        <div className="info-card" style={{ padding: '18px 20px' }}>
          <span className="section-title">8. Data Quality Summary</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {[
              { label: 'Missing Values', desc: '0% - No missing data found.', icon: '✓', color: '#eff8ff', text: '#175cd3' },
              { label: 'Feature Types', desc: '7 Numeric, 3 Categorical, 1 Binary. All recognized.', icon: '✓', color: '#ecfdf3', text: '#12b76a' },
              { label: 'Preprocessing Status', desc: 'Complete. Cleaned, encoded & validated.', icon: '✓', color: '#ecfdf3', text: '#12b76a' },
              { label: 'Outlier Check', desc: 'Reviewed. Outliers detected in Oldpeak, Cholesterol.', icon: '!', color: '#fff6ed', text: '#f79009' }
            ].map((dq, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: dq.color, color: dq.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>{dq.icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>{dq.label}</span>
                  <span style={{ fontSize: '10px', color: '#667085' }}>{dq.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Footer warning */}
      <div className="page-note-box" style={{ marginTop: '10px' }}>
        <HelpCircle size={18} style={{ color: '#d97706' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 700 }}>CardioRisk AI is an educational support tool, not a medical device.</strong>
          It does not provide medical advice or diagnosis. Always consult a qualified healthcare professional.
        </div>
      </div>
    </div>
  );
};

// Model Performance View Component matching mockup screenshot
const ModelPerformanceView: React.FC<{ api: ApiState<MetricsResponse> }> = ({ api }) => {
  const metrics = api.data;
  const selected = metrics?.selected_model ?? {
    name: 'xgboost',
    display_name: 'XGBoost',
    status: 'Selected',
    accuracy: 0.924,
    auc_roc: 0.95,
    precision: 0.931,
    recall: 0.906,
    f1: 0.918,
    confusion_matrix: [[211, 14], [21, 198]],
  };
  const modelStats = [
    { title: 'Best Model', value: selected.display_name, subtitle: 'Selected Model', icon: <Trophy size={18} />, bg: '#f5f3ff', color: '#7c3aed' },
    { title: 'Best Accuracy', value: formatPercent(selected.accuracy * 100), subtitle: selected.display_name, icon: <Target size={18} />, bg: '#eff8ff', color: '#175cd3' },
    { title: 'Best AUC-ROC', value: selected.auc_roc.toFixed(2), subtitle: selected.display_name, icon: <TrendingUp size={18} />, bg: '#ecfdf3', color: '#027a48' },
    { title: 'Best F1 Score', value: formatPercent(selected.f1 * 100), subtitle: selected.display_name, icon: <Star size={18} />, bg: '#fef3f2', color: '#b42318' },
    { title: 'Precision', value: formatPercent(selected.precision * 100), subtitle: selected.display_name, icon: <Shield size={18} />, bg: '#ecfdf3', color: '#12b76a' },
    { title: 'Recall', value: formatPercent(selected.recall * 100), subtitle: selected.display_name, icon: <RefreshCw size={18} />, bg: '#fff6ed', color: '#f97316' },
  ];

  const rankings = (metrics?.ranking ?? [
    { name: 'XGBoost', value: 0.95, pct: '95%', color: '#22c55e' },
    { name: 'Random Forest', value: 0.93, pct: '93%', color: '#3b82f6' },
    { name: 'Deep Neural Network', value: 0.92, pct: '92%', color: '#a78bfa' },
    { name: 'SVM', value: 0.91, pct: '91%', color: '#f59e0b' },
    { name: 'Logistic Regression', value: 0.89, pct: '89%', color: '#94a3b8' },
  ]).map((rank) => ({
    ...rank,
    value: Number(rank.value),
  }));

  const comparisonData = (metrics?.models ?? []).map((row) => ({
    name: row.display_name,
    acc: formatPercent(row.accuracy * 100),
    prec: formatPercent(row.precision * 100),
    rec: formatPercent(row.recall * 100),
    f1: formatPercent(row.f1 * 100),
    auc: row.auc_roc.toFixed(2),
    status: row.status,
    best: row.model === selected.name || row.display_name === selected.display_name,
  }));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionStatus loading={api.loading} error={api.error} onRetry={api.refresh} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#667085', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>👋 Welcome back, Dr. Alex</span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939', marginTop: '2px' }}>Model Performance</h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            Compare models, evaluate performance, and identify the most reliable model for cardiovascular risk prediction.
          </p>
        </div>
        <div className="topbar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} /> Export Report
          </button>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} /> Download Metrics
          </button>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCw size={13} /> Refresh Evaluation
          </button>
        </div>
      </div>

      {/* Grid 6 Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
        {modelStats.map((stat, idx) => (
          <div key={idx} style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: stat.bg,
              color: stat.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {stat.icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#667085', fontWeight: 600 }}>{stat.title}</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#1c2738', margin: '2px 0' }}>{stat.value}</span>
              <span style={{ fontSize: '10px', color: '#667085', fontWeight: 500 }}>{stat.subtitle}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr 1.1fr', gap: '16px' }}>
        {/* Performance Summary */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <span className="section-title">Performance Summary</span>
            <p style={{ color: '#475569', fontSize: '12px', lineHeight: '1.5', marginTop: '8px' }}>
              We evaluated 5 machine learning models using key classification metrics on unseen test data.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Models Compared</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#1c2738' }}>{metrics?.models.length ?? 5}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Production Model</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1c2738' }}>{selected.display_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Evaluation Data</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1c2738' }}>Unseen Test Set</div>
            </div>
          </div>
        </div>

        {/* Model Ranking */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <span className="section-title">Model Ranking</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {rankings.map((rank, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#667085', width: '12px' }}>{idx + 1}</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#1d2939', width: '120px' }}>{rank.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d2939', width: '30px', textAlign: 'right' }}>{rank.value}</span>
                <div style={{ flexGrow: 1, height: '6px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: rank.pct, background: rank.color, borderRadius: '3px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Why XGBoost is Best */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <span className="section-title">Why XGBoost is the Best Model?</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {[
                'Highest ROC-AUC indicating excellent class separation.',
                'Strong recall ensures more at-risk patients are identified.',
                'Balanced precision and F1-score for reliable predictions.',
                'Consistent performance across multiple validation runs.'
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '10px' }}>
                  <span style={{ color: '#12b76a', fontWeight: 800, marginTop: '2px' }}>✓</span>
                  <span style={{ color: '#475569' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '6px 10px', fontSize: '10px', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
            <span>⚡</span> Recommended for screening and production use.
          </div>
        </div>
      </div>

      {/* Row 3: Table and Confusion Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '16px' }}>
        {/* Comparison Table */}
        <div className="custom-table-card" style={{ padding: '18px 20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <span className="section-title">Model Performance Comparison</span>
          <table className="custom-table" style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginTop: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Model</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Accuracy</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Precision</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Recall</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>F1 Score</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>AUC-ROC</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'left' }}>Status</th>
                <th style={{ padding: '8px 6px', color: '#667085', fontWeight: 600, textAlign: 'center' }}>Best In</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, idx) => (
                <tr key={idx} style={{
                  borderBottom: '1px solid #f1f5f9',
                  background: row.best ? '#f5f3ff' : 'transparent',
                  fontWeight: row.best ? 600 : 'normal'
                }}>
                  <td style={{ padding: '10px 6px', color: row.best ? '#7c3aed' : '#1d2939', fontWeight: 600 }}>{row.name}</td>
                  <td style={{ padding: '10px 6px' }}>{row.acc}</td>
                  <td style={{ padding: '10px 6px' }}>{row.prec}</td>
                  <td style={{ padding: '10px 6px' }}>{row.rec}</td>
                  <td style={{ padding: '10px 6px' }}>{row.f1}</td>
                  <td style={{ padding: '10px 6px', fontWeight: 700 }}>{row.auc}</td>
                  <td style={{ padding: '10px 6px' }}>
                    <span className={row.best ? 'badge-info' : 'badge-success'} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px' }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                    {row.best ? <span style={{ color: '#7c3aed', display: 'flex', gap: '4px', justifyContent: 'center' }}>🏆 ⭐ 🛡️ 🔄</span> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Classification Quality / Confusion Matrix */}
        <div className="info-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span className="section-title">Classification Quality (XGBoost)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '14px' }}>
              <div style={{ background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#027a48' }}>{selected.confusion_matrix?.[0]?.[0] ?? 198}</div>
                <div style={{ fontSize: '9px', color: '#027a48', fontWeight: 700 }}>True Positive</div>
              </div>
              <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#b42318' }}>{selected.confusion_matrix?.[0]?.[1] ?? 14}</div>
                <div style={{ fontSize: '9px', color: '#b42318', fontWeight: 700 }}>False Positive</div>
              </div>
              <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#b42318' }}>{selected.confusion_matrix?.[1]?.[0] ?? 21}</div>
                <div style={{ fontSize: '9px', color: '#b42318', fontWeight: 700 }}>False Negative</div>
              </div>
              <div style={{ background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#027a48' }}>{selected.confusion_matrix?.[1]?.[1] ?? 211}</div>
                <div style={{ fontSize: '9px', color: '#027a48', fontWeight: 700 }}>True Negative</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#475569', lineHeight: '1.4', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
            <strong>Interpretation:</strong> XGBoost correctly identifies most high-risk patients while keeping false alarms low.
          </div>
        </div>
      </div>

      {/* Row 4: discrimination, reliability, features, validation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Discrimination Ability */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>Discrimination Ability</span>
          <span style={{ fontSize: '9px', color: '#667085', marginTop: '2px', display: 'block' }}>ROC-AUC Curve</span>
          <div style={{ height: '90px', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', marginTop: '8px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Draw ROC lines */}
              <path d="M0 100 Q 10 20, 100 0" fill="none" stroke="#22c55e" strokeWidth="1.5" />
              <path d="M0 100 Q 20 30, 100 0" fill="none" stroke="#3b82f6" strokeWidth="1.2" />
              <path d="M0 100 Q 30 40, 100 0" fill="none" stroke="#a78bfa" strokeWidth="1" />
              <line x1="0" y1="100" x2="100" y2="0" stroke="#cbd5e1" strokeDasharray="2" strokeWidth="0.5" />
            </svg>
          </div>
          <span style={{ fontSize: '8px', color: '#667085', marginTop: '8px', textAlign: 'center' }}>XGBoost shows the highest AUC (0.95) indicating excellent separation.</span>
        </div>

        {/* Prediction Reliability */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>Prediction Reliability</span>
            <span style={{ fontSize: '9px', color: '#667085', marginTop: '2px', display: 'block' }}>Confidence Distribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
            <div style={{ width: '48px', height: '48px', position: 'relative', flexShrink: 0 }}>
              <svg width="48" height="48" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#22c55e" strokeWidth="14" strokeDasharray="238.76" strokeDashoffset="66" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '8px' }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>95-100% (72%)</span>
              <span style={{ color: '#3b82f6', fontWeight: 700 }}>90-95% (19%)</span>
            </div>
          </div>
          <span style={{ fontSize: '8px', color: '#667085', textAlign: 'center' }}>Predictions are well calibrated with minimal overconfidence.</span>
        </div>

        {/* Key Risk Signals / Features */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>Key Risk Signals (Top Features)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            {[
              { name: 'ST_Slope', val: '92%' },
              { name: 'ChestPain', val: '87%' },
              { name: 'ExerciseAng', val: '84%' },
            ].map((f, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 600 }}>
                  <span style={{ color: '#475569' }}>{f.name}</span>
                  <span style={{ color: '#1d2939' }}>{f.val}</span>
                </div>
                <div style={{ height: '4px', background: '#f2f4f7', borderRadius: '2px', overflow: 'hidden', marginTop: '1px' }}>
                  <div style={{ height: '100%', width: f.val, background: '#7c3aed' }}></div>
                </div>
              </div>
            ))}
          </div>
          <a href="#" style={{ fontSize: '9px', color: '#7c3aed', textDecoration: 'none', fontWeight: 700, marginTop: '8px', display: 'block' }}>View in Explainability &rarr;</a>
        </div>

        {/* Validation Notes */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939', marginBottom: '4px' }}>Validation Notes</span>
          {[
            { k: 'Split', v: '80% / 20%' },
            { k: 'Data', v: 'Unseen Test' },
            { k: 'Balancing', v: 'Applied (SMOTE)' },
            { k: 'Preproc', v: 'Standardized' },
            { k: 'CV', v: '5-Fold Done' },
            { k: 'Leakage', v: 'None Detected' },
          ].map((note, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px dotted #f1f5f9', paddingBottom: '2px' }}>
              <span style={{ color: '#667085' }}>{note.k}</span>
              <span style={{ color: '#1d2939', fontWeight: 700 }}>{note.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations & Action */}
      <div style={{
        background: '#ecfdf3',
        border: '1px solid #d1fadf',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🛡️</span>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#027a48', display: 'block' }}>Production Recommendation</span>
            <span style={{ fontSize: '10px', color: '#027a48' }}>XGBoost is recommended for production due to its superior ROC-AUC, high recall, and stable generalization.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ background: '#12b76a', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            Deploy Model
          </button>
          <button style={{ background: '#ffffff', color: '#344054', border: '1px solid #d0d5dd', borderRadius: '8px', padding: '8px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            View Deployment Guide
          </button>
        </div>
      </div>

      {/* Footer warning */}
      <div className="page-note-box" style={{ marginTop: '10px' }}>
        <HelpCircle size={18} style={{ color: '#d97706' }} />
        <div>
          <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 700 }}>CardioRisk AI is an educational support tool, not a medical device.</strong>
          It does not provide medical advice or diagnosis. Always consult a qualified healthcare professional.
        </div>
      </div>
    </div>
  );
};

interface PatientReportViewProps {
  patient: any;
  prediction: PredictResponse;
  onClearReport: () => void;
  onRunNewPrediction: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

const PatientReportView: React.FC<PatientReportViewProps> = ({ patient, prediction, onClearReport, onRunNewPrediction, selectedModel, setSelectedModel }) => {
  const [whatIfChol, setWhatIfChol] = useState<number>(Number(patient.Cholesterol ?? 200));
  const [whatIfMaxHR, setWhatIfMaxHR] = useState<number>(Number(patient.MaxHR ?? 140));
  const [whatIfAngina, setWhatIfAngina] = useState<string>(patient.ExerciseAngina ?? 'No');
  const [whatIfPrediction, setWhatIfPrediction] = useState<PredictResponse | null>(null);
  const [loadingWhatIf, setLoadingWhatIf] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const runWhatIf = async () => {
      const payload: PredictRequest & { model?: string } = {
        Age: Number(patient.Age ?? 54),
        Sex: patient.Sex ?? 'Male',
        ChestPainType: patient.ChestPainType ?? 'ATA',
        RestingBP: Number(patient.RestingBP ?? 135),
        Cholesterol: whatIfChol,
        FastingBS: Number(patient.FastingBS ?? 0),
        RestingECG: patient.RestingECG ?? 'Normal',
        MaxHR: whatIfMaxHR,
        ExerciseAngina: whatIfAngina,
        Oldpeak: Number(patient.Oldpeak ?? 0),
        ST_Slope: patient.ST_Slope ?? 'Flat',
        model: selectedModel,
      };
      try {
        setLoadingWhatIf(true);
        const result = await fetchJson<PredictResponse>('/api/predict', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (active) {
          setWhatIfPrediction(result);
        }
      } catch (e) {
        console.error("What If prediction error:", e);
      } finally {
        if (active) setLoadingWhatIf(false);
      }
    };

    const timer = setTimeout(runWhatIf, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [whatIfChol, whatIfMaxHR, whatIfAngina, patient, selectedModel]);

  // Circular ring calculations
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const scorePercent = Math.round(prediction.probability * 100);
  const strokeOffset = circ - (scorePercent / 100) * circ;

  // Waterfall and list elements sorted by SHAP contributions magnitude
  const baseValue = 0.50;
  const contributions = prediction.contributions ?? [];

  const increasedFactors = [...contributions]
    .filter(c => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);

  const reducedFactors = [...contributions]
    .filter(c => c.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution);

  const sortedContributions = [...contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const items = [
    { label: 'Base', val: baseValue, isCumulative: true },
    ...sortedContributions.slice(0, 7).map(c => ({
      label: c.factor,
      val: c.contribution,
      isCumulative: false
    })),
    { label: 'Final', val: prediction.probability, isCumulative: true }
  ];

  let currentVal = baseValue;
  const plotted = items.map((item, idx) => {
    let startY = currentVal;
    let endY = currentVal;
    if (item.isCumulative) {
      if (item.label === 'Final') {
        startY = 0;
        endY = prediction.probability;
      } else {
        startY = 0;
        endY = baseValue;
      }
    } else {
      currentVal += item.val;
      endY = currentVal;
    }
    return {
      label: item.label,
      val: item.val,
      isCumulative: item.isCumulative,
      startY,
      endY
    };
  });

  const height = 120;
  const width = 450;
  const margin = { top: 12, bottom: 22, left: 32, right: 12 };
  const chartHeight = height - margin.top - margin.bottom;
  const chartWidth = width - margin.left - margin.right;
  const scaleY = (val: number) => chartHeight - (val * chartHeight) + margin.top;
  const stepX = chartWidth / plotted.length;

  const originalProb = prediction.probability;
  const newProb = whatIfPrediction ? whatIfPrediction.probability : originalProb;
  const riskReduction = Math.max(0, Math.round((originalProb - newProb) * 100));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            onClick={onClearReport} 
            style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', marginBottom: '8px', padding: 0 }}
          >
            ← Back to Dataset
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939' }}>Patient Analysis Report</h2>
            <CheckCircle size={18} style={{ color: '#12b76a' }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: '#667085', fontWeight: 600, alignItems: 'center' }}>
            <span>Patient ID: P-{String(patient.row_id).padStart(5, '0')}</span>
            <span>•</span>
            <span>Prediction Generated: May 30, 2026, 10:32 AM</span>
            <span>•</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span>Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#1d2939',
                  fontSize: '11px',
                  fontWeight: 600,
                  height: '24px',
                  padding: '0 4px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="xgboost">XGBoost</option>
                <option value="random_forest">Random Forest</option>
                <option value="logistic_regression">Logistic Regression</option>
                <option value="svm_rbf">SVM</option>
                <option value="dnn">Deep Neural Network</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} />
            Export PDF
          </button>
          <button onClick={onRunNewPrediction} className="topbar-pill" style={{ background: '#4f46e5', color: '#ffffff', border: 'none', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 18px', borderRadius: '8px', fontWeight: 700 }}>
            Run New Prediction
          </button>
        </div>
      </div>

      {/* Row 1: Patient Profile, Risk Assessment Result, Clinical Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 1fr', gap: '16px' }}>
        {/* Panel 1: Patient Profile */}
        <div className="info-card">
          <span className="section-title">1. Patient Profile</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '10px' }}>
            {[
              { label: 'Age', value: `${patient.Age} years`, icon: <User size={14} />, bg: '#f9f5ff', color: '#7f56d9' },
              { label: 'Sex', value: patient.Sex, icon: <Users size={14} />, bg: '#eff8ff', color: '#175cd3' },
              { label: 'Chest Pain Type', value: patient.ChestPainType, icon: <Heart size={14} />, bg: '#ecfdf3', color: '#027a48' },
              { label: 'Resting BP', value: `${patient.RestingBP} mmHg`, icon: <Activity size={14} />, bg: '#fef3f2', color: '#b42318' },
              { label: 'Cholesterol', value: `${patient.Cholesterol} mg/dL`, icon: <Droplet size={14} />, bg: '#eff8ff', color: '#15803d' },
              { label: 'Max Heart Rate', value: `${patient.MaxHR} bpm`, icon: <Activity size={14} />, bg: '#fff6ed', color: '#c4320a' },
            ].map((item, idx) => (
              <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', color: '#667085', fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d2939' }}>{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Risk Assessment Result */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '60%' }}>
            <span style={{ fontSize: '9px', color: '#667085', fontWeight: 700 }}>Predicted Outcome</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 900, color: prediction.category.includes('High') ? '#ef4444' : '#22c55e' }}>
                {prediction.category.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
              <div>
                <div style={{ fontSize: '8px', color: '#667085', fontWeight: 600 }}>Probability</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1c2738' }}>{Math.round(prediction.probability * 100)}%</div>
              </div>
              <div>
                <div style={{ fontSize: '8px', color: '#667085', fontWeight: 600 }}>Confidence</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1c2738' }}>{prediction.confidence}</div>
              </div>
            </div>
            <div style={{ fontSize: '8px', color: '#667085', marginTop: '6px' }}>
              Model: <strong style={{ color: '#1d2939' }}>{prediction.model_used}</strong>
            </div>
          </div>
          <div style={{ position: 'relative', width: '76px', height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="76" height="76" viewBox="0 0 76 76" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="38" cy="38" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="6" />
              <circle 
                cx="38" 
                cy="38" 
                r={radius} 
                fill="transparent" 
                stroke={prediction.category.includes('High') ? '#ef4444' : '#22c55e'} 
                strokeWidth="6" 
                strokeDasharray={circ} 
                strokeDashoffset={strokeOffset} 
                strokeLinecap="round" 
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#1d2939' }}>{scorePercent}%</span>
              <span style={{ fontSize: '7px', color: '#667085', fontWeight: 600 }}>Risk Score</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Clinical Summary */}
        <div className="info-card">
          <span className="section-title">3. Clinical Summary</span>
          <p style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>
            This patient demonstrates multiple indicators associated with elevated cardiovascular risk.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
            {contributions.slice(0, 3).map((c, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', fontSize: '10px', color: '#b42318' }}>
                <span style={{ fontWeight: 800 }}>•</span>
                <span>{c.factor}: {c.contribution > 0 ? '+' : ''}{Math.round(c.contribution * 100)}% contribution</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Why The Model Predicted This & Feature Contribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Panel 4: Why The Model Predicted This */}
        <div className="info-card">
          <span className="section-title">4. Why The Model Predicted This (SHAP Waterfall)</span>
          <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
            {/* Left side: Increase/Reduce lists */}
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#b42318', display: 'block', marginBottom: '4px' }}>Increased Risk Factors</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {increasedFactors.slice(0, 4).map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px dotted #f1f5f9', paddingBottom: '2px' }}>
                      <span style={{ color: '#475569', fontWeight: 600 }}>{c.factor}</span>
                      <span style={{ color: '#b42318', fontWeight: 700 }}>+{Math.round(c.contribution * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#027a48', display: 'block', marginBottom: '4px' }}>Reduced Risk Factors</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {reducedFactors.slice(0, 3).map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px dotted #f1f5f9', paddingBottom: '2px' }}>
                      <span style={{ color: '#475569', fontWeight: 600 }}>{c.factor}</span>
                      <span style={{ color: '#027a48', fontWeight: 700 }}>{Math.round(c.contribution * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right side: Waterfall plot */}
            <div style={{ width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                <line x1={margin.left} y1={scaleY(0)} x2={width - margin.right} y2={scaleY(0)} stroke="#e2e8f0" strokeWidth={1} />
                <line x1={margin.left} y1={scaleY(0.5)} x2={width - margin.right} y2={scaleY(0.5)} stroke="#e2e8f0" strokeDasharray="2" strokeWidth={1} />
                <line x1={margin.left} y1={scaleY(1.0)} x2={width - margin.right} y2={scaleY(1.0)} stroke="#e2e8f0" strokeWidth={1} />
                
                <text x={margin.left - 5} y={scaleY(0) + 3} fill="#667085" fontSize={7} textAnchor="end">0.0</text>
                <text x={margin.left - 5} y={scaleY(0.5) + 3} fill="#667085" fontSize={7} textAnchor="end">0.5</text>
                <text x={margin.left - 5} y={scaleY(1.0) + 3} fill="#667085" fontSize={7} textAnchor="end">1.0</text>
                
                {plotted.map((p, idx) => {
                  const x = margin.left + idx * stepX + (stepX - 22) / 2;
                  const w = 22;
                  let y = scaleY(Math.max(p.startY, p.endY));
                  let h = Math.max(2, Math.abs(scaleY(p.startY) - scaleY(p.endY)));
                  
                  let fill = "#6366f1";
                  if (!p.isCumulative) {
                    fill = p.val >= 0 ? "#f04438" : "#22c55e";
                  }
                  
                  return (
                    <g key={idx}>
                      <rect x={x} y={y} width={w} height={h} fill={fill} rx={2} />
                      {idx < plotted.length - 1 && (
                        <line 
                          x1={x + w} 
                          y1={scaleY(p.endY)} 
                          x2={margin.left + (idx + 1) * stepX + (stepX - 22) / 2} 
                          y2={scaleY(p.endY)} 
                          stroke="#94a3b8" 
                          strokeWidth={1} 
                          strokeDasharray="2" 
                        />
                      )}
                      <text 
                        x={x + w/2} 
                        y={height - 4} 
                        fill="#475569" 
                        fontSize={7} 
                        fontWeight={600}
                        textAnchor="middle"
                      >
                        {p.label.slice(0, 5)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Panel 5: Feature Contribution */}
        <div className="info-card">
          <span className="section-title">5. Feature Contribution (SHAP Values)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {sortedContributions.slice(0, 6).map((c, idx) => {
              const isPositive = c.contribution >= 0;
              const absVal = Math.min(100, Math.abs(c.contribution) * 100);
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 600 }}>
                    <span style={{ color: '#475569' }}>{c.factor}</span>
                    <span style={{ color: isPositive ? '#b42318' : '#027a48', fontWeight: 700 }}>
                      {isPositive ? '+' : ''}{c.contribution.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ height: '5px', background: '#f2f4f7', borderRadius: '3px', overflow: 'hidden', marginTop: '2px' }}>
                    <div style={{ height: '100%', width: `${absVal}%`, background: isPositive ? '#f04438' : '#22c55e' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Similar Patient Comparison, What If Analysis, Population Insight */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '16px' }}>
        {/* Panel 6: Similar Patient Comparison */}
        <div className="info-card">
          <span className="section-title">6. Similar Patient Comparison</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '6px', textAlign: 'center' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}>
              <span style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Current Patient</span>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>{scorePercent}%</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px' }}>
              <span style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Average High-Risk</span>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#475569' }}>79%</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Difference</span>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444' }}>+5% Higher</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
            {[
              { label: 'Age', user: patient.Age, avg: 52 },
              { label: 'Cholesterol', user: patient.Cholesterol, avg: 226 },
              { label: 'BP', user: patient.RestingBP, avg: 140 },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px dotted #f1f5f9', paddingBottom: '2px' }}>
                <span style={{ color: '#667085' }}>{m.label}</span>
                <span style={{ fontWeight: 700, color: '#1d2939' }}>{m.user} <span style={{ color: '#94a3b8', fontWeight: 500 }}>vs {m.avg}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 7: What If Analysis */}
        <div className="info-card">
          <span className="section-title">7. What If Analysis</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 600 }}>
                <span style={{ color: '#475569' }}>Cholesterol (mg/dL)</span>
                <span style={{ fontWeight: 800, color: '#1d2939' }}>{whatIfChol}</span>
              </div>
              <input 
                type="range" 
                min={100} 
                max={400} 
                value={whatIfChol} 
                onChange={(e) => setWhatIfChol(Number(e.target.value))} 
                style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', outline: 'none' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 600 }}>
                <span style={{ color: '#475569' }}>Max Heart Rate (bpm)</span>
                <span style={{ fontWeight: 800, color: '#1d2939' }}>{whatIfMaxHR}</span>
              </div>
              <input 
                type="range" 
                min={60} 
                max={200} 
                value={whatIfMaxHR} 
                onChange={(e) => setWhatIfMaxHR(Number(e.target.value))} 
                style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#475569' }}>Exercise Angina</span>
              <select 
                value={whatIfAngina} 
                onChange={(e) => setWhatIfAngina(e.target.value)} 
                style={{ height: '24px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '10px', outline: 'none', background: '#ffffff', padding: '0 4px' }}
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '6px', padding: '6px 10px' }}>
              <span style={{ fontSize: '9px', color: '#027a48', fontWeight: 700 }}>Potential Risk Reduction:</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#027a48' }}>{loadingWhatIf ? '...' : `${riskReduction}%`}</span>
            </div>
          </div>
        </div>

        {/* Panel 8: Population Insight */}
        <div className="info-card" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
          <span className="section-title" style={{ color: '#6d28d9' }}>8. Population Insight</span>
          <p style={{ fontSize: '11px', color: '#5b21b6', lineHeight: '1.4' }}>
            Patients with the following profile show significantly higher risk in this dataset:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', fontSize: '10px', color: '#5b21b6', fontWeight: 600 }}>
            <span>• Flat ST Slope</span>
            <span>• Exercise-Induced Angina</span>
            <span>• Cholesterol &gt; 200 mg/dL</span>
          </div>
          <div style={{ marginTop: '12px', borderTop: '1px solid #ddd6fe', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px' }}>📈</span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6d28d9' }}>3.2x Higher Likelihood of disease</span>
          </div>
        </div>
      </div>

      {/* Row 4: Model Validation Summary, Recommendations, How to Interpret */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
        {/* Panel 9: Model Validation Summary */}
        <div className="info-card">
          <span className="section-title">9. Model Validation Summary</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '4px' }}>
            {[
              { label: 'Accuracy', val: '92.4%' },
              { label: 'AUC-ROC', val: '0.95' },
              { label: 'F1 Score', val: '91.8%' },
              { label: 'Precision', val: '92.1%' },
              { label: 'Recall', val: '90.6%' },
            ].map((m, idx) => (
              <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: '#667085', fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d2939', marginTop: '2px' }}>{m.val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#eff8ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '6px 10px', fontSize: '9px', color: '#175cd3', fontWeight: 700, marginTop: '10px' }}>
            Prediction generated using unseen test-set validated model.
          </div>
        </div>

        {/* Panel 10: Recommendations */}
        <div className="info-card">
          <span className="section-title">10. Recommendations</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {[
              'Consult a healthcare professional for further evaluation.',
              'Monitor cholesterol levels and maintain a heart-healthy diet.',
              'Perform regular cardiovascular screening and stress tests.',
              'Maintain regular physical activity and a healthy lifestyle.',
            ].map((rec, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '9px', color: '#334155' }}>
                <span style={{ display: 'inline-flex', width: '12px', height: '12px', background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: '#12b76a', flexShrink: 0, fontSize: '8px', fontWeight: 900 }}>✓</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 11: How to Interpret This Result */}
        <div className="info-card">
          <span className="section-title">11. How to Interpret This Result</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b42318' }}>
              <ArrowUp size={10} />
              <span>Positive contributions increase the predicted risk.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#027a48' }}>
              <ArrowDown size={10} />
              <span>Negative contributions decrease the predicted risk.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
              <HelpCircle size={10} />
              <span>The final risk score represents the combined effect of all factors.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
              <Shield size={10} />
              <span>This is a screening support tool, not a medical diagnosis.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transparency & Disclaimer footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '60%' }}>
          <span style={{ fontSize: '18px' }}>ℹ️</span>
          <span style={{ color: '#667085', lineHeight: '1.4' }}>
            <strong>Transparency & Disclaimer:</strong> CardioRisk AI is designed for educational, research, and decision-support purposes only. Predictions generated by this platform do not constitute medical diagnoses.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['Educational Use Only', 'No Diagnosis', 'Data Privacy Protected', 'HIPAA Ready'].map((b, i) => (
            <span key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 700, color: '#475569' }}>
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const PredictorView: React.FC<{
  initialPrediction: PredictResponse | null;
  onPrediction: (result: PredictResponse) => void;
  selectedPatientForReport?: any;
  onClearReport?: () => void;
}> = ({ initialPrediction, onPrediction, selectedPatientForReport, onClearReport }) => {
  // Form input states
  const [selectedModel, setSelectedModel] = useState<string>('xgboost');
  const [age, setAge] = useState<number>(54);
  const [sex, setSex] = useState<string>('Male');
  const [chestPain, setChestPain] = useState<string>('ATA');
  const [restingBp, setRestingBp] = useState<number>(135);
  const [cholesterol, setCholesterol] = useState<number>(240);
  const [fastingBs, setFastingBs] = useState<number>(120);
  const [restingEcg, setRestingEcg] = useState<string>('Normal');
  const [maxHr, setMaxHr] = useState<number>(150);
  const [exerciseAngina, setExerciseAngina] = useState<string>('Yes');
  const [oldpeak, setOldpeak] = useState<number>(2.1);
  const [stSlope, setStSlope] = useState<string>('Flat');

  const [prediction, setPrediction] = useState<PredictResponse | null>(initialPrediction);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);

  const runPredictionForPatient = async (patient: any) => {
    const payload: PredictRequest & { model?: string } = {
      Age: Number(patient.Age ?? 54),
      Sex: patient.Sex ?? 'Male',
      ChestPainType: patient.ChestPainType ?? 'ATA',
      RestingBP: Number(patient.RestingBP ?? 135),
      Cholesterol: Number(patient.Cholesterol ?? 240),
      FastingBS: Number(patient.FastingBS ?? 0),
      RestingECG: patient.RestingECG ?? 'Normal',
      MaxHR: Number(patient.MaxHR ?? 150),
      ExerciseAngina: patient.ExerciseAngina ?? 'Yes',
      Oldpeak: Number(patient.Oldpeak ?? 2.1),
      ST_Slope: patient.ST_Slope ?? 'Flat',
      model: selectedModel,
    };

    try {
      setPredicting(true);
      setPredictError(null);
      const result = await fetchJson<PredictResponse>('/api/predict', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPrediction(result);
      onPrediction(result);
    } catch (err) {
      setPredictError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    if (selectedPatientForReport) {
      setAge(Number(selectedPatientForReport.Age ?? 54));
      setSex(selectedPatientForReport.Sex ?? 'Male');
      setChestPain(selectedPatientForReport.ChestPainType ?? 'ATA');
      setRestingBp(Number(selectedPatientForReport.RestingBP ?? 135));
      setCholesterol(Number(selectedPatientForReport.Cholesterol ?? 240));
      setFastingBs(Number(selectedPatientForReport.FastingBS ?? 0) === 1 ? 130 : 100);
      setRestingEcg(selectedPatientForReport.RestingECG ?? 'Normal');
      setMaxHr(Number(selectedPatientForReport.MaxHR ?? 150));
      setExerciseAngina(selectedPatientForReport.ExerciseAngina ?? 'Yes');
      setOldpeak(Number(selectedPatientForReport.Oldpeak ?? 2.1));
      setStSlope(selectedPatientForReport.ST_Slope ?? 'Flat');
      
      void runPredictionForPatient(selectedPatientForReport);
    }
  }, [selectedPatientForReport, selectedModel]);

  const runPrediction = async () => {
    const payload: PredictRequest & { model?: string } = {
      Age: age,
      Sex: sex,
      ChestPainType: chestPain,
      RestingBP: restingBp,
      Cholesterol: cholesterol,
      FastingBS: fastingBs > 120 ? 1 : 0,
      RestingECG: restingEcg,
      MaxHR: maxHr,
      ExerciseAngina: exerciseAngina,
      Oldpeak: oldpeak,
      ST_Slope: stSlope,
      model: selectedModel,
    };

    try {
      setPredicting(true);
      setPredictError(null);
      const result = await fetchJson<PredictResponse>('/api/predict', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPrediction(result);
      onPrediction(result);
    } catch (err) {
      setPredictError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  const handleClear = () => {
    setAge(50);
    setSex('Male');
    setChestPain('ATA');
    setRestingBp(120);
    setCholesterol(200);
    setFastingBs(100);
    setRestingEcg('Normal');
    setMaxHr(160);
    setExerciseAngina('No');
    setOldpeak(0);
    setStSlope('Up');
  };

  const activePrediction = prediction ?? {
    probability: 0.86,
    risk_score: 86,
    category: 'High Risk',
    color: '#ef4444',
    model_used: 'XGBoost',
    secondary_model: { name: 'Deep Neural Network', risk: null, available: false },
    agreement_text: 'DNN comparison unavailable.',
    agreement_score: null,
    top_risk: [],
    top_protective: [],
    contributions: [],
    selected_model: 'XGBoost',
    confidence: 'High',
    clinical_summary: { summary: 'This prediction is based on feature-level contributions rather than only the final score.', top_factors: [] },
    prediction_vs_average: [],
    validation_notes: [],
  };
  const handlePredict = runPrediction;



  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {predictError && <div style={{ borderRadius: '8px', padding: '10px 12px', fontSize: '11px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{predictError}</div>}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {selectedPatientForReport && (
            <button 
              onClick={onClearReport} 
              style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', marginBottom: '8px' }}
            >
              ← Back to Dataset
            </button>
          )}
          <span style={{ fontSize: '11px', color: '#667085', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {selectedPatientForReport ? `Patient ID: P-${String(selectedPatientForReport.row_id).padStart(5, '0')}` : '👋 Welcome back, Dr. Alex'}
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939', marginTop: '2px' }}>
            {selectedPatientForReport ? 'Patient Analysis Report' : 'Predictor'}
          </h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            {selectedPatientForReport ? 'Detailed diagnostic insights and explanations computed by the AI model for this patient record.' : 'Assess cardiovascular risk, understand key factors, and take action early.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleClear} className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', background: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Clear Inputs
          </button>
          <button onClick={handlePredict} className="topbar-pill" style={{ background: '#111827', color: '#ffffff', border: 'none', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 18px', borderRadius: '8px', fontWeight: 700 }}>
            ⚡ {predicting ? 'Running...' : 'Run Prediction'}
          </button>
        </div>
      </div>

      {/* Row 1 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '16px' }}>
        {/* Patient Profile Form */}
        <div className="info-card">
          <span className="section-title">1. Patient Profile</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Age (years)</label>
              <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Sex</label>
              <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Chest Pain Type</label>
              <select value={chestPain} onChange={(e) => setChestPain(e.target.value)} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="TA">TA</option>
                <option value="ATA">ATA</option>
                <option value="NAP">NAP</option>
                <option value="ASY">ASY</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Resting BP (mmHg)</label>
              <input type="number" value={restingBp} onChange={(e) => setRestingBp(Number(e.target.value))} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Cholesterol (mg/dL)</label>
              <input type="number" value={cholesterol} onChange={(e) => setCholesterol(Number(e.target.value))} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Fasting Blood Sugar (mg/dL)</label>
              <input type="number" value={fastingBs} onChange={(e) => setFastingBs(Number(e.target.value))} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Resting ECG</label>
              <select value={restingEcg} onChange={(e) => setRestingEcg(e.target.value)} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="Normal">Normal</option>
                <option value="ST">ST</option>
                <option value="LVH">LVH</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Max Heart Rate (bpm)</label>
              <input type="number" value={maxHr} onChange={(e) => setMaxHr(Number(e.target.value))} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Exercise-Induced Angina</label>
              <select value={exerciseAngina} onChange={(e) => setExerciseAngina(e.target.value)} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>ST Depression (Oldpeak)</label>
              <input type="number" step="0.1" value={oldpeak} onChange={(e) => setOldpeak(Number(e.target.value))} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 8px', fontSize: '11px', outline: 'none' }} />
            </div>

            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>ST Slope</label>
              <select value={stSlope} onChange={(e) => setStSlope(e.target.value)} style={{ width: '100%', height: '32px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="Flat">Flat</option>
                <option value="Up">Up</option>
                <option value="Down">Down</option>
              </select>
            </div>
          </div>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '6px 10px', fontSize: '9px', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
            <span>ℹ️</span> Adjust the values and click "Run Prediction" to see updated results.
          </div>
        </div>

        {/* Prediction Summary */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <span className="section-title">2. Prediction Summary</span>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', textAlign: 'center', margin: '8px 0' }}>
            <span style={{ fontSize: '9px', color: '#667085', fontWeight: 700 }}>Predicted Outcome</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '4px 0' }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: activePrediction.color }}>{activePrediction.category}</span>
            </div>
            <span style={{ fontSize: '8px', color: '#667085', fontWeight: 600 }}>Probability of Heart Disease</span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#1c2738', margin: '2px 0' }}>{activePrediction.probability.toFixed(2)} <span style={{ fontSize: '12px', color: '#667085', fontWeight: 500 }}>/ 1.00</span></div>
            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ height: '100%', width: `${activePrediction.probability * 100}%`, background: activePrediction.color, borderRadius: '3px' }}></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Risk Score</span>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#7c3aed' }}>{activePrediction.risk_score} <span style={{ fontSize: '10px', color: '#667085', fontWeight: 500 }}>/ 100</span></div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', color: '#667085', fontWeight: 700, marginBottom: '2px' }}>Confidence Level</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#12b76a', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>✓ {activePrediction.confidence}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '10px', fontSize: '10px' }}>
            <span style={{ color: '#475569', fontWeight: 600 }}>Model Used</span>
            <span style={{ fontWeight: 700, color: '#1d2939' }}>{activePrediction.model_used} <span style={{ fontSize: '8px', padding: '1px 4px', background: '#f5f3ff', color: '#7c3aed', borderRadius: '4px', marginLeft: '4px' }}>Primary</span></span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', marginTop: '4px' }}>
            <span style={{ color: '#475569' }}>Also Aligned With</span>
            <span style={{ fontWeight: 700, color: '#1d2939' }}>{activePrediction.secondary_model.name} <span style={{ color: '#12b76a' }}>{activePrediction.secondary_model.available && activePrediction.secondary_model.risk != null ? `${Math.round(activePrediction.secondary_model.risk * 100)}%` : 'n/a'}</span></span>
          </div>
        </div>

        {/* Clinical Summary */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <span className="section-title">3. Clinical Summary</span>
            <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '8px', padding: '10px', fontSize: '9px', color: '#b42318', marginTop: '8px' }}>
              ℹ️ {activePrediction.clinical_summary.summary}
            </div>
            <div style={{ marginTop: '10px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>What the score suggests</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {[
                  'Higher risk of coronary artery disease.',
                  'Close monitoring and lifestyle management recommended.',
                  'Consult with a healthcare professional for evaluation.'
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', fontSize: '9px', color: '#475569' }}>
                    <span style={{ color: '#ef4444' }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '10px' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Risk Category Guide</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              <div style={{ background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#027a48' }}>Low Risk</div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#027a48' }}>&lt; 40</div>
              </div>
              <div style={{ background: '#fffaeb', border: '1px solid #fee4e2', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#b54708' }}>Moderate</div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#b54708' }}>40 - 70</div>
              </div>
              <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#b42318' }}>High Risk</div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#b42318' }}>&gt; 70</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '16px' }}>
        {/* Contributing Factors */}
        <div className="info-card">
          <span className="section-title">4. Contributing Factors</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            {/* Increasing risk */}
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#b42318', display: 'block', marginBottom: '8px' }}>Top Factors Increasing Risk</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { name: `ST Depr (${oldpeak})`, val: activePrediction.top_risk[0] ? `+${Math.abs(activePrediction.top_risk[0].contribution).toFixed(2)}` : '+0.24', width: oldpeak > 1 ? '60%' : '15%' },
                  { name: `Chest Pain (${chestPain})`, val: activePrediction.top_risk[1] ? `+${Math.abs(activePrediction.top_risk[1].contribution).toFixed(2)}` : '+0.10', width: chestPain === 'ASY' ? '65%' : '30%' },
                  { name: `Angina (${exerciseAngina})`, val: activePrediction.top_risk[2] ? `+${Math.abs(activePrediction.top_risk[2].contribution).toFixed(2)}` : '+0.16', width: exerciseAngina === 'Yes' ? '50%' : '5%' },
                  { name: `ST Slope (${stSlope})`, val: activePrediction.top_risk[3] ? `+${Math.abs(activePrediction.top_risk[3].contribution).toFixed(2)}` : '+0.14', width: stSlope === 'Flat' ? '45%' : '10%' },
                  { name: `Cholesterol (${cholesterol})`, val: activePrediction.top_risk[4] ? `+${Math.abs(activePrediction.top_risk[4].contribution).toFixed(2)}` : '+0.10', width: cholesterol > 220 ? '30%' : '8%' }
                ].map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                      <span style={{ color: '#475569' }}>{item.name}</span>
                      <span style={{ color: '#b42318', fontWeight: 700 }}>{item.val}</span>
                    </div>
                    <div style={{ height: '4px', background: '#f2f4f7', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                      <div style={{ height: '100%', width: item.width, background: '#ef4444' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lowering risk */}
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#027a48', display: 'block', marginBottom: '8px' }}>Top Factors Lowering Risk</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { name: `Max HR (${maxHr} bpm)`, val: activePrediction.top_protective[0] ? activePrediction.top_protective[0].contribution.toFixed(2) : '-0.09', width: maxHr > 140 ? '40%' : '10%' },
                  { name: `Age (${age} years)`, val: activePrediction.top_protective[1] ? activePrediction.top_protective[1].contribution.toFixed(2) : '-0.06', width: age < 50 ? '55%' : '25%' },
                  { name: `Resting ECG (${restingEcg})`, val: activePrediction.top_protective[2] ? activePrediction.top_protective[2].contribution.toFixed(2) : '-0.05', width: restingEcg === 'Normal' ? '20%' : '4%' },
                  { name: `Sex (${sex})`, val: activePrediction.top_protective[3] ? activePrediction.top_protective[3].contribution.toFixed(2) : '-0.03', width: sex === 'Female' ? '35%' : '12%' },
                  { name: `Fasting BS (${fastingBs})`, val: activePrediction.top_protective[4] ? activePrediction.top_protective[4].contribution.toFixed(2) : '-0.04', width: fastingBs < 120 ? '16%' : '4%' }
                ].map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                      <span style={{ color: '#475569' }}>{item.name}</span>
                      <span style={{ color: '#027a48', fontWeight: 700 }}>{item.val}</span>
                    </div>
                    <div style={{ height: '4px', background: '#f2f4f7', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                      <div style={{ height: '100%', width: item.width, background: '#22c55e' }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '8px', color: '#667085', display: 'block', marginTop: '10px', textAlign: 'center' }}>Factors are ranked by their impact on the prediction.</span>
        </div>

        {/* Prediction vs Average Patient */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span className="section-title">5. Prediction vs. Average Patient</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', flexGrow: 1, justifyContent: 'center' }}>
            {(activePrediction.prediction_vs_average.length ? activePrediction.prediction_vs_average : [
              { name: 'Age', user: age, avg: 52 },
              { name: 'Cholesterol', user: cholesterol, avg: 198 },
              { name: 'Resting BP', user: restingBp, avg: 128 },
              { name: 'Max HR', user: maxHr, avg: 136 },
              { name: 'Oldpeak', user: oldpeak, avg: 1.0 }
            ]).map((metric, idx) => {
              const max = metric.name === 'Age' ? 80 : metric.name === 'Cholesterol' ? 400 : metric.name === 'Resting BP' ? 200 : metric.name === 'Max HR' ? 200 : 6;
              const userPos = (metric.user / max) * 100;
              const avgPos = (metric.avg / max) * 100;
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 600, color: '#475569' }}>
                    <span>{metric.name}</span>
                    <span style={{ fontSize: '8px', color: '#667085' }}>Your value: {metric.user} (Avg: {metric.avg})</span>
                  </div>
                  <div style={{ height: '14px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ height: '2px', background: '#cbd5e1', width: '100%' }}></div>
                    {/* Average pointer */}
                    <div style={{ position: 'absolute', left: `${avgPos}%`, transform: 'translateX(-50%)', color: '#94a3b8', fontSize: '10px', fontWeight: 800 }}>+</div>
                    {/* User pointer */}
                    <div style={{ position: 'absolute', left: `${userPos}%`, transform: 'translateX(-50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '6px', height: '6px', background: '#7c3aed', borderRadius: '50%' }}></span>
              <span style={{ color: '#667085' }}>Your Value</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ color: '#94a3b8', fontWeight: 800 }}>+</span>
              <span style={{ color: '#667085' }}>Average Patient</span>
            </div>
          </div>
        </div>

        {/* Classification Quality */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <span className="section-title">6. Classification Quality</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '12px' }}>
              <div style={{ background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#027a48' }}>198</div>
                <div style={{ fontSize: '8px', color: '#027a48', fontWeight: 700 }}>True Positive</div>
              </div>
              <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#b42318' }}>14</div>
                <div style={{ fontSize: '8px', color: '#b42318', fontWeight: 700 }}>False Positive</div>
              </div>
              <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#b42318' }}>21</div>
                <div style={{ fontSize: '8px', color: '#b42318', fontWeight: 700 }}>False Negative</div>
              </div>
              <div style={{ background: '#ecfdf3', border: '1px solid #d1fadf', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#027a48' }}>211</div>
                <div style={{ fontSize: '8px', color: '#027a48', fontWeight: 700 }}>True Negative</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '8px', color: '#667085', marginTop: '8px', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
            Accuracy: 92.4% | Precision: 93.1% | Recall: 90.6%
          </div>
        </div>
      </div>

      {/* Row 3 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '16px' }}>
        {/* Discrimination Ability */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>7. Discrimination Ability</span>
          <div style={{ height: '90px', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', marginTop: '8px', position: 'relative' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 100 Q 10 20, 100 0" fill="none" stroke="#22c55e" strokeWidth="1.5" />
              <line x1="0" y1="100" x2="100" y2="0" stroke="#cbd5e1" strokeDasharray="2" strokeWidth="0.5" />
            </svg>
          </div>
          <span style={{ fontSize: '8px', color: '#667085', marginTop: '8px', textAlign: 'center' }}>AUC (XGBoost): 0.95. Excellent ability to distinguish between classes.</span>
        </div>

        {/* Recommendation */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>8. Recommendation</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            {[
              'Adopt heart-healthy diet and regular exercise.',
              'Monitor blood pressure and cholesterol.',
              'Avoid tobacco and excess alcohol.',
              'Manage stress and maintain healthy weight.'
            ].map((rec, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8px', color: '#475569' }}>
                <span style={{ color: '#12b76a' }}>✓</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '4px', padding: '4px 6px', fontSize: '8px', color: '#7c3aed', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <span>⚡</span> This is a screening support tool, not a diagnosis.
          </div>
        </div>

        {/* Prediction Record */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>9. Prediction Record</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', fontSize: '9px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#667085' }}>ID</span><span style={{ fontWeight: 700, color: '#1d2939' }}>PR-2023-11-15-0012</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#667085' }}>Date</span><span style={{ fontWeight: 700, color: '#1d2939' }}>Nov 15, 2023 10:30 AM</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#667085' }}>Model</span><span style={{ fontWeight: 700, color: '#1d2939' }}>XGBoost</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#667085' }}>Score</span><span style={{ fontWeight: 700, color: '#1d2939' }}>{activePrediction.risk_score} / 100</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: '#667085' }}>Category</span><span className={getRiskBadgeClass(activePrediction.category)} style={{ fontSize: '8px' }}>{activePrediction.category}</span></div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button style={{ width: '50%', background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: '6px', padding: '4px 0', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>Download</button>
            <button style={{ width: '50%', background: '#ffffff', border: '1px solid #d0d5dd', borderRadius: '6px', padding: '4px 0', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>Save Record</button>
          </div>
        </div>

        {/* Validation Notes */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939', marginBottom: '4px' }}>10. Validation Notes</span>
          {[
            { k: 'Split', v: '80% / 20%' },
            { k: 'Data', v: 'Unseen Test Set' },
            { k: 'Balancing', v: 'Applied (SMOTE)' },
            { k: 'Preproc', v: 'Standardized' },
            { k: 'CV', v: '5-Fold Done' },
            { k: 'Leakage', v: 'None Detected' },
          ].map((note, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px dotted #f1f5f9', paddingBottom: '2px' }}>
              <span style={{ color: '#667085' }}>{note.k}</span>
              <span style={{ color: '#1d2939', fontWeight: 700 }}>{note.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warning notes */}
      <div style={{ background: '#eff8ff', border: '1px solid #b2ddff', borderRadius: '12px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>ℹ️</span>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#175cd3', display: 'block' }}>This platform is intended for educational and research purposes only.</span>
          <span style={{ fontSize: '9px', color: '#175cd3' }}>Predictions generated by this dashboard are not medical diagnoses and should not replace professional clinical judgment.</span>
        </div>
      </div>
    </div>
  );
};

// Explainability View Component matching mockup screenshot
const ExplainabilityView: React.FC<{ api: ApiState<FeatureImportanceResponse>; prediction: PredictResponse | null }> = ({ api, prediction }) => {
  const topRisk = (prediction?.top_risk ?? api.data?.top_risk ?? []).map((item) => ({
    factor: item.factor,
    contribution: 'contribution' in item ? item.contribution : item.value,
  }));
  const topProtective = (prediction?.top_protective ?? api.data?.top_protective ?? []).map((item) => ({
    factor: item.factor,
    contribution: 'contribution' in item ? item.contribution : item.value,
  }));
  const riskIncreasing = topRisk.length
    ? topRisk.map((item, idx) => ({
        name: item.factor,
        val: `+${Math.abs(item.contribution).toFixed(2)}`,
        width: `${Math.max(15, 80 - idx * 10)}%`,
      }))
    : [
        { name: 'ST Depression (Oldpeak)', val: '+24%', width: '60%' },
        { name: 'Exercise-Induced Angina', val: '+18%', width: '45%' },
        { name: 'Chest Pain Type (ATA)', val: '+16%', width: '40%' },
        { name: 'Flat ST Slope', val: '+14%', width: '35%' },
        { name: 'High Cholesterol', val: '+10%', width: '25%' },
      ];

  const riskReducing = topProtective.length
    ? topProtective.map((item, idx) => ({
        name: item.factor,
        val: `${item.contribution.toFixed(2)}`,
        width: `${Math.max(10, 35 - idx * 5)}%`,
      }))
    : [
        { name: 'Max Heart Rate (150 bpm)', val: '-9%', width: '22%' },
        { name: 'Age (54 years)', val: '-6%', width: '15%' },
        { name: 'Normal ECG', val: '-5%', width: '12%' },
        { name: 'Sex (Male)', val: '-3%', width: '8%' },
        { name: 'Fasting Blood Sugar', val: '-2%', width: '5%' },
      ];

  const waterfallData = [
    { name: 'Base Risk', val: '0.50', displayVal: '0.50', pos: 0, height: 50, type: 'neutral' },
    ...riskIncreasing.slice(0, 6).map((item, idx) => ({
      name: item.name,
      val: item.val,
      displayVal: item.val,
      pos: 40 + idx * 10,
      height: 8 + idx * 2,
      type: 'inc' as const,
    })),
    { name: 'Final Risk', val: prediction ? prediction.probability.toFixed(2) : '0.86', displayVal: prediction ? prediction.probability.toFixed(2) : '0.86', pos: 0, height: prediction ? Math.round(prediction.probability * 100) : 86, type: 'neutral' as const },
  ];

  const behaviorData = [
    { name: 'Age vs Risk', points: '10,90 30,75 50,45 70,30 90,15', color: '#6366f1' },
    { name: 'Cholesterol vs Risk', points: '10,95 25,85 45,70 65,40 90,20', color: '#f97316' },
    { name: 'Oldpeak vs Risk', points: '10,95 30,85 50,60 70,30 90,10', color: '#ef4444' },
    { name: 'MaxHR vs Risk', points: '10,15 30,30 50,55 70,75 90,95', color: '#22c55e' }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939', marginTop: '2px' }}>Explainability</h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            Understand why the model made this prediction and which factors influenced cardiovascular risk.
          </p>
        </div>
        <div className="topbar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="topbar-pill" style={{ background: '#7c3aed', color: '#ffffff', border: 'none', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '8px', fontWeight: 700 }}>
            <Sparkles size={13} /> Generate Explanation
          </button>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={13} /> Export Report
          </button>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={13} /> Compare Patients
          </button>
        </div>
      </div>

      {/* Row 1 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
        {/* Prediction Summary */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <span className="section-title">1. Prediction Explanation Summary</span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0' }}>
            <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', width: '130px', flexShrink: 0 }}>
              <span style={{ fontSize: '8px', color: '#667085', fontWeight: 700 }}>Predicted Outcome</span>
              <div style={{ fontSize: '15px', fontWeight: 800, color: prediction?.color ?? '#ef4444', margin: '2px 0' }}>{prediction?.category ?? 'High Risk'}</div>
              <span style={{ fontSize: '7px', color: '#667085', fontWeight: 600 }}>Probability of Disease</span>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1c2738' }}>{(prediction?.probability ?? 0.86).toFixed(2)} <span style={{ fontSize: '10px', color: '#667085', fontWeight: 500 }}>/ 1.00</span></div>
            </div>
            <div style={{ fontSize: '10px', color: '#475569', lineHeight: '1.4' }}>
              {prediction?.clinical_summary.summary ?? 'This prediction is based on feature-level contributions rather than only the final risk score.'}
              <br /><br />
              The model identified several clinical indicators that increased cardiovascular risk while recognizing factors that reduced risk.
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            <span style={{ fontSize: '9px', color: '#667085', fontWeight: 700, width: '100%' }}>Most influential contributors:</span>
            {(prediction?.clinical_summary.top_factors?.length ? prediction.clinical_summary.top_factors : ['ST Depression', 'Exercise Angina', 'Chest Pain Type', 'Cholesterol', 'ST Slope']).map((tag, idx) => (
              <span key={idx} style={{ fontSize: '9px', background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Top Risk Increasing Factors */}
        <div className="info-card">
          <span className="section-title">2. Top Risk-Increasing Factors</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {riskIncreasing.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>{item.name}</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{item.val}</span>
                </div>
                <div style={{ height: '4px', background: '#f2f4f7', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                  <div style={{ height: '100%', width: item.width, background: '#ef4444' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risk Reducing Factors */}
        <div className="info-card">
          <span className="section-title">3. Top Risk-Reducing Factors</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {riskReducing.map((item, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>{item.name}</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>{item.val}</span>
                </div>
                <div style={{ height: '4px', background: '#f2f4f7', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                  <div style={{ height: '100%', width: item.width, background: '#22c55e' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Waterfall Chart */}
        <div className="info-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span className="section-title">4. Feature Impact on Prediction (Waterfall)</span>
            <div style={{ display: 'flex', gap: '10px', fontSize: '8px', fontWeight: 700 }}>
              <span style={{ color: '#ef4444' }}>■ Increase Risk</span>
              <span style={{ color: '#22c55e' }}>■ Decrease Risk</span>
              <span style={{ color: '#7c3aed' }}>■ Neutral</span>
            </div>
          </div>
          {/* Waterfall Chart SVG */}
          <div style={{ position: 'relative', height: '180px', width: '100%', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', padding: '10px 0 0 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%' }}>
              {waterfallData.map((item, idx) => {
                const maxVal = 135;
                const topVal = maxVal - item.pos - (item.type === 'dec' ? 0 : item.height);
                const rectHeight = (item.height / maxVal) * 100;
                const rectTop = (topVal / maxVal) * 100;
                return (
                  <div key={idx} style={{ width: '8%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${rectTop}%`,
                      height: `${rectHeight}%`,
                      background: item.type === 'inc' ? '#ef4444' : item.type === 'dec' ? '#22c55e' : '#7c3aed',
                      borderRadius: '2px'
                    }}></div>
                    <span style={{ position: 'absolute', bottom: '-15px', left: '50%', transform: 'translateX(-50%)', fontSize: '7px', color: '#667085', fontWeight: 600, whiteSpace: 'nowrap', width: '50px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }} title={item.name}>{item.name}</span>
                    <span style={{ position: 'absolute', top: `${rectTop - 12}%`, left: '50%', transform: 'translateX(-50%)', fontSize: '7px', color: '#1d2939', fontWeight: 700 }}>{item.displayVal}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Patient-Level Explanation */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <span className="section-title">5. Patient-Level Explanation</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: 'auto 0' }}>
            <span style={{ fontSize: '18px', width: '28px', height: '28px', background: '#f5f3ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧬</span>
            <p style={{ fontSize: '10px', color: '#475569', lineHeight: '1.4' }}>
              The prediction was primarily influenced by elevated cholesterol, significant ST depression during exercise, and the presence of exercise-induced angina.
              <br /><br />
              These factors commonly appear in higher-risk cardiovascular profiles and collectively increased the model's estimated risk probability for this patient.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '8px 10px', fontSize: '9px', color: '#7c3aed', fontWeight: 700 }}>
            <span>Clinical Interpretation:</span>
            <span>This patient shows multiple indicators associated with increased cardiovascular strain and future risk.</span>
          </div>
        </div>
      </div>

      {/* Row 3 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* Global Importance */}
        <div className="info-card">
          <span className="section-title">6. Global Feature Importance (Population-Level)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            {[
              { name: 'ST_Slope', val: '92%' },
              { name: 'ChestPainType', val: '87%' },
              { name: 'ExerciseAngina', val: '84%' },
              { name: 'Oldpeak', val: '79%' },
              { name: 'MaxHR', val: '71%' },
              { name: 'Age', val: '68%' },
              { name: 'Cholesterol', val: '66%' },
              { name: 'RestingBP', val: '61%' }
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600, width: '90px' }}>{f.name}</span>
                <div style={{ flexGrow: 1, height: '4px', background: '#f2f4f7', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: f.val, background: '#7c3aed' }}></div>
                </div>
                <span style={{ fontSize: '9px', fontWeight: 700, color: '#1d2939', width: '24px', textAlign: 'right' }}>{f.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SHAP-Based Insights */}
        <div className="info-card">
          <span className="section-title">7. SHAP-Based Insights</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            {[
              { label: 'Higher ST Depression values consistently increase predicted cardiovascular risk.', tag: 'High Impact', bg: '#fef3f2', color: '#b42318' },
              { label: 'Exercise-induced angina strongly contributes to positive-risk predictions.', tag: 'High Impact', bg: '#fef3f2', color: '#b42318' },
              { label: 'Flat ST slope appears significantly more often among high-risk patients.', tag: 'High Impact', bg: '#fef3f2', color: '#b42318' },
              { label: 'Higher cholesterol levels generally push predictions toward elevated risk.', tag: 'Mod Impact', bg: '#fff6ed', color: '#c4320a' }
            ].map((box, i) => (
              <div key={i} style={{ border: '1px solid #f1f5f9', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '65px' }}>
                <p style={{ fontSize: '8px', color: '#475569', lineHeight: '1.3' }}>{box.label}</p>
                <span style={{ fontSize: '7px', background: box.bg, color: box.color, padding: '1px 4px', borderRadius: '3px', fontWeight: 700, alignSelf: 'flex-start', marginTop: '4px' }}>{box.tag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How Model Reached Result */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <span className="section-title">8. How the Model Reached This Result</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 'auto 0' }}>
            {[
              { t: 'Patient Data', d: 'Input clinical measurements' },
              { t: 'Feature Processing', d: 'Values standardized and validated' },
              { t: 'Model Evaluation', d: 'AI model analyzes patterns' },
              { t: 'Feature Contributions', d: "Each factor's impact is calculated" },
              { t: 'Final Prediction', d: 'Risk score and classification produced' }
            ].map((step, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#7c3aed', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#1d2939', lineHeight: 1.1 }}>{step.t}</span>
                  <span style={{ fontSize: '8px', color: '#667085' }}>{step.d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '16px' }}>
        {/* Behavior Explorer */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>9. Feature Behavior Explorer</span>
          <span style={{ fontSize: '8px', color: '#667085', display: 'block', marginTop: '2px' }}>How risk changes with feature values</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
            {behaviorData.map((chart, idx) => (
              <div key={idx} style={{ border: '1px solid #f1f5f9', borderRadius: '6px', padding: '4px' }}>
                <span style={{ fontSize: '7px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>{chart.name}</span>
                <div style={{ height: '35px', borderLeft: '0.5px solid #cbd5e1', borderBottom: '0.5px solid #cbd5e1', position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline fill="none" stroke={chart.color} strokeWidth="1.5" points={chart.points} />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction Comparison */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939' }}>10. Prediction Comparison</span>
          <div style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
            <div style={{ width: '45%', border: '1px solid #f1f5f9', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
              <span style={{ fontSize: '7px', color: '#667085', fontWeight: 600 }}>Current Patient</span>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>86%</div>
            </div>
            <div style={{ width: '45%', border: '1px solid #f1f5f9', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
              <span style={{ fontSize: '7px', color: '#667085', fontWeight: 600 }}>Average Patient</span>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#667085' }}>53%</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: '#ef4444', background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '4px', padding: '2px 0' }}>
            Difference: +33%
          </div>
          <div style={{ fontSize: '8px', color: '#667085', textAlign: 'center', marginTop: '2px' }}>
            XGBoost model agreement: <strong style={{ color: '#12b76a' }}>92% High</strong>
          </div>
        </div>

        {/* Model Interpretation Notes */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939', marginBottom: '4px' }}>11. Model Interpretation Notes</span>
          {[
            { label: 'Positive Contribution', desc: 'Increases predicted risk.' },
            { label: 'Negative Contribution', desc: 'Lowers predicted risk.' },
            { label: 'Feature Importance', desc: 'Overall influence across population.' }
          ].map((note, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', fontSize: '8px' }}>
              <span style={{ fontSize: '11px' }}>🛡️</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ color: '#1d2939' }}>{note.label}</strong>
                <span style={{ color: '#667085' }}>{note.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Info */}
        <div style={{ border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d2939', marginBottom: '4px' }}>12. Validation & Quality</span>
          {[
            { k: 'SHAP Coverage', v: '100% of features' },
            { k: 'Interpretation Method', v: 'SHAP Tree Explainer' },
            { k: 'Background Samples', v: '918 patients' },
            { k: 'Stability Check', v: 'Verified (Low variance)' },
            { k: 'Fairness Metrics', v: 'Balanced by Sex/Age' }
          ].map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderBottom: '1px dotted #f1f5f9', paddingBottom: '2px' }}>
              <span style={{ color: '#667085' }}>{item.k}</span>
              <span style={{ color: '#1d2939', fontWeight: 700 }}>{item.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warning banner */}
      <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>🛡️</span>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#7c3aed', display: 'block' }}>Transparency Note</span>
          <span style={{ fontSize: '9px', color: '#7c3aed' }}>This explainability system is designed to help users understand the patterns influencing cardiovascular risk predictions. The explanations represent statistical relationships learned by the model and should not be interpreted as medical diagnoses.</span>
        </div>
      </div>
    </div>
  );
};

// Custom Toggle component for premium switches
const SettingsToggle: React.FC<{ checked: boolean; onChange: (val: boolean) => void }> = ({ checked, onChange }) => {
  return (
    <label style={{
      position: 'relative',
      display: 'inline-block',
      width: '28px',
      height: '16px',
      cursor: 'pointer',
      userSelect: 'none'
    }}>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)} 
        style={{ opacity: 0, width: 0, height: 0 }} 
      />
      <span style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: checked ? '#7c3aed' : '#d1d5db',
        borderRadius: '16px',
        transition: '0.2s ease',
      }}>
        <span style={{
          position: 'absolute',
          height: '12px',
          width: '12px',
          left: checked ? '14px' : '2px',
          bottom: '2px',
          backgroundColor: 'white',
          borderRadius: '50%',
          transition: '0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
        }} />
      </span>
    </label>
  );
};

const SettingsView: React.FC = () => {
  // State for all settings
  const [predictionModel, setPredictionModel] = useState('XGBoost v3.2');
  const [defaultModel, setDefaultModel] = useState('XGBoost v3.2');
  const [secondaryModel, setSecondaryModel] = useState('Random Forest');
  const [predictionThreshold, setPredictionThreshold] = useState(0.50);
  const [enableModelComparison, setEnableModelComparison] = useState(true);
  const [enableDnnComparison, setEnableDnnComparison] = useState(true);
  const [enableProbabilityCalibration, setEnableProbabilityCalibration] = useState(true);

  const [age, setAge] = useState('50');
  const [sex, setSex] = useState('Male');
  const [cholesterol, setCholesterol] = useState('200');
  const [restingBp, setRestingBp] = useState('120');
  const [maxHr, setMaxHr] = useState('150');
  const [oldpeak, setOldpeak] = useState('1.0');
  const [bpUnit, setBpUnit] = useState('mmHg');
  const [cholesterolUnit, setCholesterolUnit] = useState('mg/dL');
  const [rememberLastInputs, setRememberLastInputs] = useState(true);
  const [autoFillSample, setAutoFillSample] = useState(false);

  const [topFactors, setTopFactors] = useState('5');
  const [explanationMode, setExplanationMode] = useState<'Summary' | 'Detailed'>('Detailed');
  const [showGlobalImportance, setShowGlobalImportance] = useState(true);
  const [showLocalImportance, setShowLocalImportance] = useState(true);
  const [enableShap, setEnableShap] = useState(true);
  const [showClinicalInterpretation, setShowClinicalInterpretation] = useState(true);
  const [enableFeatureContribution, setEnableFeatureContribution] = useState(true);

  const [reportFormat, setReportFormat] = useState<'PDF' | 'CSV' | 'JSON'>('PDF');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeShap, setIncludeShap] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeConfidence, setIncludeConfidence] = useState(true);
  const [includeInputSummary, setIncludeInputSummary] = useState(true);
  const [includeRiskCategory, setIncludeRiskCategory] = useState(true);
  const [addOrganizationBranding, setAddOrganizationBranding] = useState(true);
  const [addProviderInfo, setAddProviderInfo] = useState(false);
  const [addFooterDisclaimer, setAddFooterDisclaimer] = useState(true);

  const [datasetPreviewRows, setDatasetPreviewRows] = useState('25');
  const [selectedCharts, setSelectedCharts] = useState(['Risk Distribution', 'Feature Importance', 'Risk Trend Over Time', 'Model Performance']);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(true);
  const [compactView, setCompactView] = useState(false);

  const [highRiskThreshold, setHighRiskThreshold] = useState('80%');
  const [confidenceWarning, setConfidenceWarning] = useState('Below 60%');
  const [missingInputWarning, setMissingInputWarning] = useState(true);
  const [modelDriftAlert, setModelDriftAlert] = useState(true);
  const [datasetUpdateAlert, setDatasetUpdateAlert] = useState(true);
  const [alertFrequency, setAlertFrequency] = useState('Immediate');
  const [notifyEmail, setNotifyEmail] = useState(true);

  const [projectName, setProjectName] = useState('CardioRisk AI');
  const [orgTeam, setOrgTeam] = useState('Healthcare AI Lab');
  const [authorContact, setAuthorContact] = useState('Dr. Alex Carter');
  const [supportEmail, setSupportEmail] = useState('support@cardiorisk.ai');
  const [version, setVersion] = useState('v1.0.0');

  // Handle Reset to Defaults
  const handleResetDefaults = () => {
    setPredictionModel('XGBoost v3.2');
    setDefaultModel('XGBoost v3.2');
    setSecondaryModel('Random Forest');
    setPredictionThreshold(0.50);
    setEnableModelComparison(true);
    setEnableDnnComparison(true);
    setEnableProbabilityCalibration(true);
    setAge('50');
    setSex('Male');
    setCholesterol('200');
    setRestingBp('120');
    setMaxHr('150');
    setOldpeak('1.0');
    setBpUnit('mmHg');
    setCholesterolUnit('mg/dL');
    setRememberLastInputs(true);
    setAutoFillSample(false);
    setTopFactors('5');
    setExplanationMode('Detailed');
    setShowGlobalImportance(true);
    setShowLocalImportance(true);
    setEnableShap(true);
    setShowClinicalInterpretation(true);
    setEnableFeatureContribution(true);
    setReportFormat('PDF');
    setIncludeSummary(true);
    setIncludeShap(true);
    setIncludeRecommendations(true);
    setIncludeConfidence(true);
    setIncludeInputSummary(true);
    setIncludeRiskCategory(true);
    setAddOrganizationBranding(true);
    setAddProviderInfo(false);
    setAddFooterDisclaimer(true);
    setDatasetPreviewRows('25');
    setShowAdvancedMetrics(true);
    setCompactView(false);
    setHighRiskThreshold('80%');
    setConfidenceWarning('Below 60%');
    setMissingInputWarning(true);
    setModelDriftAlert(true);
    setDatasetUpdateAlert(true);
    setAlertFrequency('Immediate');
    setNotifyEmail(true);
    setProjectName('CardioRisk AI');
    setOrgTeam('Healthcare AI Lab');
    setAuthorContact('Dr. Alex Carter');
    setSupportEmail('support@cardiorisk.ai');
    setVersion('v1.0.0');
    alert('Settings reset to system defaults!');
  };

  // Handle Reset Inputs Form
  const handleResetInputForm = () => {
    setAge('50');
    setSex('Male');
    setCholesterol('200');
    setRestingBp('120');
    setMaxHr('150');
    setOldpeak('1.0');
    alert('Default patient input form values reset!');
  };

  // Handle Save Changes
  const handleSaveChanges = () => {
    alert('Changes saved successfully!');
  };

  // Handle Danger Zone Reset
  const handleDangerReset = () => {
    if (confirm('Are you absolutely sure you want to reset all workspace configuration settings? This action cannot be undone.')) {
      handleResetDefaults();
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939', marginTop: '2px' }}>Settings</h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            Configure platform behavior, prediction preferences, reports, and system options.
          </p>
        </div>
        <div className="topbar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleResetDefaults} className="topbar-pill" style={{ background: '#ffffff', border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
            <RotateCw size={13} /> Reset Defaults
          </button>
          <button onClick={handleSaveChanges} className="topbar-pill" style={{ background: '#7c3aed', color: '#ffffff', border: 'none', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
            <CheckCircle size={13} /> Save Changes
          </button>
        </div>
      </div>

      {/* Row 1 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* 1. Prediction Settings */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>1. Prediction Settings</span>
          
          <div>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Active Prediction Model (Production)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={predictionModel} onChange={(e) => setPredictionModel(e.target.value)} style={{ flexGrow: 1, height: '30px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="XGBoost v3.2">XGBoost v3.2</option>
                <option value="Random Forest v2.1">Random Forest v2.1</option>
                <option value="DNN Classifier v1.8">DNN Classifier v1.8</option>
              </select>
              <span className="badge-success">Production</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Default Model for Assessment</label>
              <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} style={{ width: '100%', height: '30px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="XGBoost v3.2">XGBoost v3.2</option>
                <option value="Random Forest v2.1">Random Forest v2.1</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Enable Comparison</span>
              <SettingsToggle checked={enableModelComparison} onChange={setEnableModelComparison} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Secondary Comparison Model</label>
              <select value={secondaryModel} onChange={(e) => setSecondaryModel(e.target.value)} style={{ width: '100%', height: '30px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="Random Forest">Random Forest</option>
                <option value="XGBoost v3.2">XGBoost v3.2</option>
                <option value="DNN Classifier">DNN Classifier</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Enable DNN</span>
                <SettingsToggle checked={enableDnnComparison} onChange={setEnableDnnComparison} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Calibration</span>
                <SettingsToggle checked={enableProbabilityCalibration} onChange={setEnableProbabilityCalibration} />
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                Prediction Threshold <span style={{ display: 'inline-flex', alignItems: 'center' }} title="Default risk threshold score boundary"><HelpCircle size={10} style={{ color: '#98a2b3', cursor: 'pointer' }} /></span>
              </label>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d2939' }}>{predictionThreshold.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0.0" 
              max="1.0" 
              step="0.05" 
              value={predictionThreshold} 
              onChange={(e) => setPredictionThreshold(Number(e.target.value))} 
              style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer', height: '4px' }} 
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#667085', marginTop: '2px' }}>
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>

          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '8px 10px', fontSize: '9px', color: '#7c3aed', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <Shield size={12} /> Current configuration optimized for screening support.
          </div>
        </div>

        {/* 2. Input Preferences */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>2. Input Preferences</span>
          
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#667085', display: 'block', marginTop: '-4px' }}>Default Patient Values</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Age (years)</label>
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Sex</label>
              <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 4px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Cholesterol (mg/dL)</label>
              <input type="number" value={cholesterol} onChange={(e) => setCholesterol(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Resting BP (mmHg)</label>
              <input type="number" value={restingBp} onChange={(e) => setRestingBp(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>Max Heart Rate (bpm)</label>
              <input type="number" value={maxHr} onChange={(e) => setMaxHr(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>ST Depression (Oldpeak)</label>
              <input type="number" step="0.1" value={oldpeak} onChange={(e) => setOldpeak(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginTop: '4px' }}>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Unit Preferences</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select value={bpUnit} onChange={(e) => setBpUnit(e.target.value)} style={{ width: '50%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 2px', fontSize: '10px', outline: 'none', background: '#ffffff' }}>
                  <option value="mmHg">mmHg</option>
                  <option value="kPa">kPa</option>
                </select>
                <select value={cholesterolUnit} onChange={(e) => setCholesterolUnit(e.target.value)} style={{ width: '50%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 2px', fontSize: '10px', outline: 'none', background: '#ffffff' }}>
                  <option value="mg/dL">mg/dL</option>
                  <option value="mmol/L">mmol/L</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>Remember inputs</span>
                <SettingsToggle checked={rememberLastInputs} onChange={setRememberLastInputs} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>Auto-fill sample</span>
                <SettingsToggle checked={autoFillSample} onChange={setAutoFillSample} />
              </div>
            </div>
          </div>

          <button onClick={handleResetInputForm} style={{ width: '100%', height: '30px', background: '#ffffff', border: '1px solid #d0d5dd', color: '#344054', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
            <RotateCw size={11} /> Reset Input Form
          </button>
        </div>

        {/* 3. Explanation Preferences */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>3. Explanation Preferences</span>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Number of Top Contributing Factors</label>
            <select value={topFactors} onChange={(e) => setTopFactors(e.target.value)} style={{ width: '70px', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="7">7</option>
              <option value="10">10</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Explanation Mode</label>
            <div style={{ display: 'flex', background: '#f2f4f7', borderRadius: '6px', padding: '2px', gap: '2px' }}>
              <button 
                onClick={() => setExplanationMode('Summary')} 
                style={{ border: 'none', background: explanationMode === 'Summary' ? '#ffffff' : 'transparent', color: explanationMode === 'Summary' ? '#7c3aed' : '#475569', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', boxShadow: explanationMode === 'Summary' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
              >
                Summary
              </button>
              <button 
                onClick={() => setExplanationMode('Detailed')} 
                style={{ border: 'none', background: explanationMode === 'Detailed' ? '#7c3aed' : 'transparent', color: explanationMode === 'Detailed' ? '#ffffff' : '#475569', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', boxShadow: explanationMode === 'Detailed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
              >
                Detailed
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {[
              { label: 'Show Global Importance', state: showGlobalImportance, setter: setShowGlobalImportance },
              { label: 'Show Local Importance', state: showLocalImportance, setter: setShowLocalImportance },
              { label: 'Enable SHAP Explanations', state: enableShap, setter: setEnableShap },
              { label: 'Show Clinical Interpretation Layer', state: showClinicalInterpretation, setter: setShowClinicalInterpretation },
              { label: 'Enable Feature Contribution Charts', state: enableFeatureContribution, setter: setEnableFeatureContribution }
            ].map((toggle, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>{toggle.label}</span>
                <SettingsToggle checked={toggle.state} onChange={toggle.setter} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {/* 4. Report Options */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>4. Report Options</span>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Report Format</label>
            <div style={{ display: 'flex', background: '#f2f4f7', borderRadius: '6px', padding: '2px', gap: '2px' }}>
              {(['PDF', 'CSV', 'JSON'] as const).map(fmt => (
                <button 
                  key={fmt}
                  onClick={() => setReportFormat(fmt)} 
                  style={{ border: 'none', background: reportFormat === fmt ? '#7c3aed' : 'transparent', color: reportFormat === fmt ? '#ffffff' : '#475569', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', boxShadow: reportFormat === fmt ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Include Prediction Summary', state: includeSummary, setter: setIncludeSummary },
                { label: 'Include SHAP Explanation', state: includeShap, setter: setIncludeShap },
                { label: 'Include Recommendations', state: includeRecommendations, setter: setIncludeRecommendations },
                { label: 'Include Confidence Score', state: includeConfidence, setter: setIncludeConfidence },
                { label: 'Include Input Summary', state: includeInputSummary, setter: setIncludeInputSummary },
                { label: 'Include Risk Category Guide', state: includeRiskCategory, setter: setIncludeRiskCategory },
              ].map((toggle, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>{toggle.label}</span>
                  <SettingsToggle checked={toggle.state} onChange={toggle.setter} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid #f1f5f9', paddingLeft: '12px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#667085', marginBottom: '2px' }}>Additional Options</span>
              {[
                { label: 'Add Organization Branding', state: addOrganizationBranding, setter: setAddOrganizationBranding },
                { label: 'Add Provider Information', state: addProviderInfo, setter: setAddProviderInfo },
                { label: 'Add Footer Disclaimer', state: addFooterDisclaimer, setter: setAddFooterDisclaimer },
              ].map((toggle, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>{toggle.label}</span>
                  <SettingsToggle checked={toggle.state} onChange={toggle.setter} />
                </div>
              ))}
              
              <button style={{ width: '100%', height: '28px', background: '#ffffff', border: '1px solid #d0d5dd', color: '#344054', borderRadius: '6px', fontSize: '9px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: 'auto' }}>
                <Download size={10} /> Download Preview
              </button>
            </div>
          </div>
        </div>

        {/* 5. Data Display Settings */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>5. Data Display Settings</span>
          
          <div>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Dataset Preview Rows</label>
            <select value={datasetPreviewRows} onChange={(e) => setDatasetPreviewRows(e.target.value)} style={{ width: '100%', height: '30px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Default Dashboard Charts</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', border: '1px solid #e2e8f0', padding: '6px', borderRadius: '6px', minHeight: '60px', background: '#ffffff' }}>
              {selectedCharts.map((chart, idx) => (
                <span key={idx} style={{ fontSize: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                  {chart} <span style={{ cursor: 'pointer', color: '#9ca3af' }} onClick={() => setSelectedCharts(selectedCharts.filter(c => c !== chart))}>&times;</span>
                </span>
              ))}
              {selectedCharts.length === 0 && <span style={{ fontSize: '9px', color: '#9ca3af' }}>No charts active</span>}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Default Analytics Filters</label>
            <select style={{ width: '100%', height: '30px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
              <option>All Data Records (Filtered by Date Range)</option>
              <option>High Risk Group Only</option>
              <option>Normal Group Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Show Advanced Metrics</span>
              <SettingsToggle checked={showAdvancedMetrics} onChange={setShowAdvancedMetrics} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Compact View</span>
              <SettingsToggle checked={compactView} onChange={setCompactView} />
            </div>
          </div>
        </div>

        {/* 6. Notification & Alert Rules */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>6. Notification & Alert Rules</span>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>High Risk Alert Threshold</span>
            <input type="text" value={highRiskThreshold} onChange={(e) => setHighRiskThreshold(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '11px', outline: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Confidence Warning</span>
            <select value={confidenceWarning} onChange={(e) => setConfidenceWarning(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 4px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
              <option value="Below 50%">Below 50%</option>
              <option value="Below 60%">Below 60%</option>
              <option value="Below 70%">Below 70%</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { label: 'Missing Input Warning', state: missingInputWarning, setter: setMissingInputWarning },
              { label: 'Model Drift Alert', state: modelDriftAlert, setter: setModelDriftAlert },
              { label: 'Dataset Update Alert', state: datasetUpdateAlert, setter: setDatasetUpdateAlert }
            ].map((toggle, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>{toggle.label}</span>
                <SettingsToggle checked={toggle.state} onChange={toggle.setter} />
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Alert Frequency</span>
            <select value={alertFrequency} onChange={(e) => setAlertFrequency(e.target.value)} style={{ width: '100%', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 4px', fontSize: '11px', outline: 'none', background: '#ffffff' }}>
              <option value="Immediate">Immediate</option>
              <option value="Hourly">Hourly</option>
              <option value="Daily">Daily</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600 }}>Notify via Email</span>
            <SettingsToggle checked={notifyEmail} onChange={setNotifyEmail} />
          </div>
        </div>
      </div>

      {/* Row 3 splits */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '16px' }}>
        {/* 7. Profile / Workspace */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>7. Profile / Workspace</span>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Dashboard / Project Name</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} style={{ width: '100%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Support Email</label>
              <input type="text" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} style={{ width: '100%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Organization / Team</label>
              <input type="text" value={orgTeam} onChange={(e) => setOrgTeam(e.target.value)} style={{ width: '100%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Version</label>
              <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} style={{ width: '100%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Author / Contact</label>
              <input type="text" value={authorContact} onChange={(e) => setAuthorContact(e.target.value)} style={{ width: '100%', height: '26px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 6px', fontSize: '10px', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>Workspace Status</label>
              <div style={{ marginTop: '4px' }}>
                <span className="badge-success" style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '4px' }}>Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* 8. System Information */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>8. System Information</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10px' }}>
            {[
              { k: 'Current Model Version', v: 'XGBoost 3.2' },
              { k: 'Dataset Version', v: 'v2.4' },
              { k: 'Preprocessing Version', v: 'v1.7' },
              { k: 'Training Date', v: 'Oct 2023' },
              { k: 'Last Updated', v: 'Nov 15, 2023' }
            ].map((info, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #f1f5f9', paddingBottom: '4px' }}>
                <span style={{ color: '#667085' }}>{info.k}</span>
                <span style={{ color: '#1d2939', fontWeight: 700 }}>{info.v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ color: '#667085' }}>Evaluation Dataset</span>
              <span className="badge-success">Validated</span>
            </div>
          </div>
        </div>

        {/* 9. Privacy & Disclaimer */}
        <div className="info-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <span className="section-title" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '4px' }}>9. Privacy & Disclaimer</span>
          
          <div style={{ display: 'flex', gap: '8px', background: '#eff8ff', border: '1px solid #b2ddff', borderRadius: '8px', padding: '10px', fontSize: '9px', color: '#175cd3', lineHeight: '1.4' }}>
            <span style={{ fontSize: '14px' }}>🛡️</span>
            <div>
              <strong style={{ display: 'block', marginBottom: '2px' }}>CardioRisk AI is designed for educational, research, and decision-support purposes only.</strong>
              Predictions generated by this platform are not medical diagnoses and should not replace professional clinical judgment. All data is handled securely and in compliance with applicable privacy regulations.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            <span className="badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>🧬 Educational Use Only</span>
            <span className="badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>⚠️ No Diagnosis</span>
            <span className="badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>✓ Data Privacy Protected</span>
          </div>
        </div>
      </div>

      {/* Row 4 Danger Zone */}
      <div style={{ background: '#fef3f2', border: '1px solid #fee4e2', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px', color: '#ef4444' }}>⚠️</span>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#b42318', display: 'block' }}>10. Danger Zone</span>
            <span style={{ fontSize: '9px', color: '#b42318' }}>Restore factory defaults for this workspace. This action cannot be undone.</span>
          </div>
        </div>
        <button onClick={handleDangerReset} style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>
          Reset Settings
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState<'Overview' | 'Dataset' | 'EDA' | 'Model Performance' | 'Predictor' | 'Explainability' | 'Research Story' | 'Settings' | 'Patient Report'>('Overview');
  const [datasetPage, setDatasetPage] = useState(1);
  const [datasetLimit, setDatasetLimit] = useState(10);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [selectedPatientForReport, setSelectedPatientForReport] = useState<any>(null);
  const [patientReportPrediction, setPatientReportPrediction] = useState<PredictResponse | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('xgboost');

  const handleViewPatientReport = (patient: any) => {
    setSelectedPatientForReport(patient);
    setActiveMenu('Patient Report');
    setSelectedModel('xgboost');
  };

  useEffect(() => {
    if (!selectedPatientForReport) return;
    let active = true;
    const fetchReport = async () => {
      setLoadingReport(true);
      setReportError(null);
      try {
        const result = await fetchJson<PredictResponse>('/api/predict', {
          method: 'POST',
          body: JSON.stringify({
            Age: Number(selectedPatientForReport.Age ?? 54),
            Sex: selectedPatientForReport.Sex ?? 'Male',
            ChestPainType: selectedPatientForReport.ChestPainType ?? 'ATA',
            RestingBP: Number(selectedPatientForReport.RestingBP ?? 135),
            Cholesterol: Number(selectedPatientForReport.Cholesterol ?? 240),
            FastingBS: Number(selectedPatientForReport.FastingBS ?? 0),
            RestingECG: selectedPatientForReport.RestingECG ?? 'Normal',
            MaxHR: Number(selectedPatientForReport.MaxHR ?? 150),
            ExerciseAngina: selectedPatientForReport.ExerciseAngina ?? 'Yes',
            Oldpeak: Number(selectedPatientForReport.Oldpeak ?? 2.1),
            ST_Slope: selectedPatientForReport.ST_Slope ?? 'Flat',
            model: selectedModel
          }),
        });
        if (active) {
          setPatientReportPrediction(result);
        }
      } catch (err) {
        if (active) {
          setReportError(err instanceof Error ? err.message : 'Failed to generate report prediction');
        }
      } finally {
        if (active) {
          setLoadingReport(false);
        }
      }
    };
    void fetchReport();
    return () => {
      active = false;
    };
  }, [selectedPatientForReport, selectedModel]);
  const summaryApi = useApi<SummaryResponse>('/api/summary');
  const datasetApi = useApi<DatasetResponse>(`/api/dataset?limit=${datasetLimit}&page=${datasetPage}&search=${encodeURIComponent(datasetSearch)}`);
  const metricsApi = useApi<MetricsResponse>('/api/metrics');
  const importanceApi = useApi<FeatureImportanceResponse>('/api/feature-importance');
  const assessmentsApi = useApi<AssessmentsResponse>('/api/assessments');
  const edaApi = useApi<EdaStatsResponse>('/api/eda-stats');
  const [latestPrediction, setLatestPrediction] = useState<PredictResponse | null>(null);
  const overviewSummary = summaryApi.data;
  const recentAssessments = assessmentsApi.data?.items ?? [];

  useEffect(() => {
    let active = true;
    void fetchJson<PredictResponse>('/api/predict', {
      method: 'POST',
      body: JSON.stringify({
        Age: 54,
        Sex: 'Male',
        ChestPainType: 'ATA',
        RestingBP: 135,
        Cholesterol: 240,
        FastingBS: 1,
        RestingECG: 'Normal',
        MaxHR: 150,
        ExerciseAngina: 'Yes',
        Oldpeak: 2.1,
        ST_Slope: 'Flat',
      } satisfies PredictRequest),
    })
      .then((result) => {
        if (active) setLatestPrediction(result);
      })
      .catch(() => {
        if (active) setLatestPrediction(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const mainMenuItems = [
    { id: 'Overview', label: 'Overview', icon: <Clipboard className="sidebar-menu-icon" /> },
    { id: 'Dataset', label: 'Dataset', icon: <Database className="sidebar-menu-icon" /> },
    { id: 'EDA', label: 'EDA', icon: <Activity className="sidebar-menu-icon" /> },
    { id: 'Model Performance', label: 'Model Performance', icon: <TrendingUp className="sidebar-menu-icon" /> },
    { id: 'Predictor', label: 'Predictor', icon: <Award className="sidebar-menu-icon" /> },
    { id: 'Explainability', label: 'Explainability', icon: <Sparkles className="sidebar-menu-icon" /> },
    { id: 'Research Story', label: 'Research Story', icon: <FileText className="sidebar-menu-icon" /> },
  ] as const;

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-logo-section">
          <div className="sidebar-logo-icon">🫀</div>
          <div>
            <div className="sidebar-logo-title">CardioRisk AI</div>
            <div className="sidebar-logo-subtitle">AI-Powered Risk Assessment</div>
          </div>
        </div>

        <div className="sidebar-search-box">
          <Search size={14} className="sidebar-search-icon" />
          <input type="text" className="sidebar-search-input" placeholder="Search" />
          <span className="sidebar-search-shortcut">⌘K</span>
        </div>

        <nav className="sidebar-menu">
          {mainMenuItems.map(item => (
            <div
              key={item.id}
              className={`sidebar-menu-item ${activeMenu === item.id ? `active active-${item.id.toLowerCase().replace(/\s+/g, '-')}` : ''}`}
              onClick={() => {
                setSelectedPatientForReport(null);
                setActiveMenu(item.id);
              }}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
          
          <div className="sidebar-divider"></div>
          
          <div
            className={`sidebar-menu-item ${activeMenu === 'Settings' ? `active active-${'Settings'.toLowerCase()}` : ''}`}
            onClick={() => {
              setSelectedPatientForReport(null);
              setActiveMenu('Settings');
            }}
          >
            <Settings className="sidebar-menu-icon" />
            Settings
          </div>
        </nav>

        <div className="sidebar-footer">
          <img src={drAlex} alt="Dr. Alex Carter" className="sidebar-avatar" />
          <div className="sidebar-footer-text">
            <div className="sidebar-footer-name">Dr. Alex Carter</div>
            <div className="sidebar-footer-role">Researcher</div>
          </div>
          <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {/* Topbar Row */}
        <header className="topbar">
          <div className="topbar-welcome">
            <span>👋</span> Welcome back, Dr. <span className="topbar-welcome-badge">Alex</span>
          </div>
          <div className="topbar-actions">
            <div className="topbar-pill">
              <Sun size={13} />
              Light
              <ChevronDown size={12} />
            </div>
            <div className="topbar-pill">
              <Calendar size={13} />
              Oct 1 - Nov 30, 2023
              <ChevronDown size={12} />
            </div>
            <div className="topbar-pill" style={{ padding: '8px 10px' }}>
              <Bell size={14} />
            </div>
            <img src={drAlex} alt="Avatar" className="topbar-avatar" />
          </div>
        </header>

        {activeMenu === 'Overview' ? (
          <>
            <SectionStatus loading={summaryApi.loading || assessmentsApi.loading} error={summaryApi.error ?? assessmentsApi.error} onRetry={summaryApi.refresh} />
            {/* Hero Section */}
            <div className="hero">
              <div className="hero-content">
                <div className="hero-badge">Welcome back, Dr. Alex</div>
                <h1>Predict. Understand. Prevent.</h1>
                <p>
                  CardioRisk AI helps you assess cardiovascular risk,
                  understand key drivers, and take action early.
                </p>
                <button className="hero-btn" onClick={() => { setSelectedPatientForReport(null); setActiveMenu('Predictor'); }}>
                  Start Risk Assessment <ArrowRight size={14} />
                </button>
              </div>
              <div className="hero-gfx-box">
                <img src={heart3d} alt="3D Heart Model" className="hero-heart-img" />
                <svg className="hero-pulse-line" viewBox="0 0 300 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0 40H100L110 10L120 70L130 30L140 50L150 40H300" stroke="#f43f5e" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid-4">
              <MetricCard 
                title="Total Assessments" 
                value={String(overviewSummary?.total_records ?? 12580)} 
                badge="Live" 
                subtitle="vs previous 30 days"
                sparkValues={[10, 12, 11, 14, 13, 16, 15, 18, 17, 20]}
                icon={<Clipboard />}
                sparkColor="#818cf8" // Soft Violet-Indigo
              />
              <MetricCard 
                title="Model Accuracy (AUC)" 
                value={overviewSummary ? overviewSummary.selected_model.auc_roc.toFixed(2) : '0.89'} 
                badge="3.2%" 
                subtitle="vs previous 30 days"
                sparkValues={[85, 86, 85, 87, 88, 87, 88, 89]}
                icon={<Activity />}
                sparkColor="#34d399" // Soft Green/Teal
              />
              <MetricCard 
                title="Top Risk Factors Tracked" 
                value={String(overviewSummary?.top_risk_factors_tracked ?? 24)} 
                badge="Live" 
                subtitle="Key clinical & lifestyle factors"
                sparkValues={[20, 20, 21, 21, 22, 22, 23, 24]}
                icon={<ShieldAlert />}
                sparkColor="#fbbf24" // Soft Amber/Yellow
              />
              <MetricCard 
                title="Prediction Confidence" 
                value={overviewSummary ? `${overviewSummary.prediction_confidence}%` : '91.4%'} 
                badge="2.7%" 
                subtitle="Model coverage"
                sparkValues={[88, 89, 90, 89, 91, 90, 91.4]}
                icon={<Award />}
                sparkColor="#60a5fa" // Soft Blue
              />
            </div>

            {/* Middle Row (Platform Summary, Donut Risk, Trend) */}
            <div className="grid-3-split">
              <div className="info-card">
                <span className="section-title">Platform Summary</span>
                <div className="body-copy">
                  CardioRisk AI uses advanced machine learning to predict cardiovascular risk.<br /><br />
                  It explains the key drivers behind each prediction and supports early screening and better clinical decisions.<br /><br />
                  Our platform is designed for healthcare professionals, researchers, and care teams.
                </div>
                <div className="badge-list-row">
                  <div className="badge-pill-flat">
                    <ShieldAlert size={12} style={{ marginRight: 4 }} />
                    Secure - Private - HIPAA Compliant
                  </div>
                </div>
              </div>

              <div className="info-card">
                <span className="section-title" style={{ marginBottom: 4 }}>Risk Distribution (10-Year Risk)</span>
                <DonutChart total={overviewSummary?.total_records ?? 12580} segments={overviewSummary?.risk_distribution ?? [
                  { label: 'Low Risk', count: 5320, percent: 42.3, color: '#22c55e' },
                  { label: 'Moderate Risk', count: 3410, percent: 27.1, color: '#f59e0b' },
                  { label: 'High Risk', count: 2480, percent: 19.7, color: '#ef4444' },
                  { label: 'Very High Risk', count: 1370, percent: 10.9, color: '#7f1d1d' },
                ]} />
              </div>

              <div className="info-card" style={{ paddingBottom: '12px' }}>
                <TrendChart trend={overviewSummary?.trend ?? [
                  { month: 'Jun', value: 1200 },
                  { month: 'Jul', value: 2100 },
                  { month: 'Aug', value: 2800 },
                  { month: 'Sep', value: 4800 },
                  { month: 'Oct', value: 5200 },
                  { month: 'Nov', value: 6800 },
                ]} />
              </div>
            </div>

            {/* 4 Feature Quick Cards */}
            <div className="grid-4">
              <div className="feature-card" onClick={() => { setSelectedPatientForReport(null); setActiveMenu('Predictor'); }}>
                <div className="feature-icon-box">
                  <Clipboard />
                </div>
                <div className="feature-title">Risk Prediction</div>
                <div className="feature-desc">Generate accurate 10-year cardiovascular risk scores.</div>
                <ArrowRight className="feature-arrow" size={14} />
              </div>

              <div className="feature-card" onClick={() => setActiveMenu('Explainability')}>
                <div className="feature-icon-box">
                  <Sparkles />
                </div>
                <div className="feature-title">Explainable Insights</div>
                <div className="feature-desc">Understand the key factors driving each prediction.</div>
                <ArrowRight className="feature-arrow" size={14} />
              </div>

              <div className="feature-card" onClick={() => setActiveMenu('EDA')}>
                <div className="feature-icon-box">
                  <Users />
                </div>
                <div className="feature-title">Patient Profile Analysis</div>
                <div className="feature-desc">Explore patient demographics, history, and risk patterns.</div>
                <ArrowRight className="feature-arrow" size={14} />
              </div>

              <div className="feature-card" onClick={() => setActiveMenu('Model Performance')}>
                <div className="feature-icon-box">
                  <Database />
                </div>
                <div className="feature-title">Model Performance Monitoring</div>
                <div className="feature-desc">Monitor model accuracy, calibration, and drift.</div>
                <ArrowRight className="feature-arrow" size={14} />
              </div>
            </div>

            {/* Bottom Row: Recent Insights & Table */}
            <div className="grid-2-split">
              <div className="summary-list">
                <div className="insight-header-row">
                  <span className="section-title" style={{ margin: 0 }}>Recent Insights</span>
                  <a href="#" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>View all insights &rarr;</a>
                </div>
                
                <div className="insight-row-item">
                  <div className="insight-icon-container" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
                    <ArrowUp size={16} />
                  </div>
                  <div className="insight-desc-box">
                    <div className="insight-title">{overviewSummary?.recent_insights?.[0]?.title ?? 'Top Feature Impacting Risk'}</div>
                    <div className="insight-text">{overviewSummary?.recent_insights?.[0]?.text ?? 'Age remains the most impactful factor, followed by Systolic BP and LDL Cholesterol.'}</div>
                  </div>
                  <span className="insight-tag badge-info">{overviewSummary?.recent_insights?.[0]?.tag ?? 'High Impact'}</span>
                </div>

                <div className="insight-row-item">
                  <div className="insight-icon-container" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                    <Users size={16} />
                  </div>
                  <div className="insight-desc-box">
                    <div className="insight-title">{overviewSummary?.recent_insights?.[1]?.title ?? 'Most Common Risk Profile'}</div>
                    <div className="insight-text">{overviewSummary?.recent_insights?.[1]?.text ?? 'Patients aged 50-65 with hypertension and high cholesterol.'}</div>
                  </div>
                  <span className="insight-tag badge-warning">{overviewSummary?.recent_insights?.[1]?.tag ?? 'Moderate Risk'}</span>
                </div>

                <div className="insight-row-item">
                  <div className="insight-icon-container" style={{ backgroundColor: '#f0fdf4', color: '#15803d' }}>
                    <Database size={16} />
                  </div>
                  <div className="insight-desc-box">
                    <div className="insight-title">{overviewSummary?.recent_insights?.[2]?.title ?? 'Current Best Model'}</div>
                    <div className="insight-text">{overviewSummary?.recent_insights?.[2]?.text ?? 'XGBoost v3.2 is the best performing model with AUC of 0.89.'}</div>
                  </div>
                  <span className="insight-tag badge-success">{overviewSummary?.recent_insights?.[2]?.tag ?? 'Production'}</span>
                </div>
              </div>

              <div className="custom-table-card">
                <div className="custom-table-card-header">
                  <span className="section-title" style={{ margin: 0 }}>Your Recent Assessments</span>
                  <a href="#" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>View all &rarr;</a>
                </div>
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Sex, Age</th>
                      <th>Date</th>
                      <th>Risk Category</th>
                      <th style={{ textAlign: 'right' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAssessments.map((item, idx) => (
                      <tr key={idx}>
                        <td className="custom-table-name">{item.name}</td>
                        <td>{item.sex}, {item.age}</td>
                        <td>{item.date}</td>
                        <td><span className={getRiskBadgeClass(item.risk)} style={{ padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>{item.risk}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{item.score.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Section */}
            <div className="grid-2-split" style={{ marginBottom: 0 }}>
              <div className="how-works-box">
                <span className="section-title">How It Works</span>
                <div className="how-works-row">
                  <div className="how-works-step">
                    <div className="how-works-icon-circle">
                      <FileText size={14} />
                    </div>
                    <div className="how-works-text-container">
                      <span className="how-works-title">Input Patient Data</span>
                      <span className="how-works-desc">Securely enter demographic and clinical features.</span>
                    </div>
                  </div>
                  <span className="how-works-arrow">&rarr;</span>
                  
                  <div className="how-works-step">
                    <div className="how-works-icon-circle">
                      <Activity size={14} />
                    </div>
                    <div className="how-works-text-container">
                      <span className="how-works-title">Generate Risk Score</span>
                      <span className="how-works-desc">Estimate disease likelihood with XGBoost.</span>
                    </div>
                  </div>
                  <span className="how-works-arrow">&rarr;</span>
                  
                  <div className="how-works-step">
                    <div className="how-works-icon-circle">
                      <Search size={14} />
                    </div>
                    <div className="how-works-text-container">
                      <span className="how-works-title">View Explanations</span>
                      <span className="how-works-desc">Inspect features driving the score via SHAP.</span>
                    </div>
                  </div>
                  <span className="how-works-arrow">&rarr;</span>
                  
                  <div className="how-works-step">
                    <div className="how-works-icon-circle">
                      <Award size={14} />
                    </div>
                    <div className="how-works-text-container">
                      <span className="how-works-title">Take Action</span>
                      <span className="how-works-desc">Use insights to guide clinical decision support.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="page-note-box">
                <HelpCircle size={18} style={{ color: '#d97706' }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: '4px', fontWeight: 700 }}>Important Note</strong>
                  CardioRisk AI is an educational support tool, not a medical device. It does not provide medical advice or diagnosis. Always consult a qualified healthcare professional.
                </div>
              </div>
            </div>
          </>
        ) : activeMenu === 'Dataset' ? (
          <DatasetView 
            api={datasetApi} 
            page={datasetPage} 
            setPage={setDatasetPage} 
            limit={datasetLimit} 
            setLimit={setDatasetLimit} 
            search={datasetSearch} 
            setSearch={setDatasetSearch} 
            onViewReport={handleViewPatientReport}
          />
        ) : activeMenu === 'Patient Report' ? (
          loadingReport ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: '#667085', fontSize: '14px', fontWeight: 600 }}>Analyzing patient data...</p>
            </div>
          ) : reportError ? (
            <div style={{ borderRadius: '8px', padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
              <h3>Failed to load patient analysis</h3>
              <p>{reportError}</p>
              <button onClick={() => selectedPatientForReport && handleViewPatientReport(selectedPatientForReport)} className="topbar-pill" style={{ marginTop: '12px', border: '1px solid #fca5a5', background: 'white', color: '#b91c1c' }}>Retry</button>
            </div>
          ) : selectedPatientForReport && patientReportPrediction ? (
            <PatientReportView 
              patient={selectedPatientForReport}
              prediction={patientReportPrediction}
              onClearReport={() => {
                setSelectedPatientForReport(null);
                setActiveMenu('Dataset');
              }}
              onRunNewPrediction={() => {
                setActiveMenu('Predictor');
              }}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            />
          ) : (
            <div style={{ color: '#667085', textAlign: 'center', padding: '40px' }}>No patient selected. Please select a patient from the Dataset tab.</div>
          )
        ) : activeMenu === 'EDA' ? (
          <EDAView api={edaApi} />
        ) : activeMenu === 'Model Performance' ? (
          <ModelPerformanceView api={metricsApi} />
        ) : activeMenu === 'Predictor' ? (
          <PredictorView 
            initialPrediction={latestPrediction} 
            onPrediction={setLatestPrediction} 
            selectedPatientForReport={selectedPatientForReport}
            onClearReport={() => {
              setSelectedPatientForReport(null);
              setActiveMenu('Dataset');
            }}
          />
        ) : activeMenu === 'Explainability' ? (
          <ExplainabilityView api={importanceApi} prediction={latestPrediction} />
        ) : activeMenu === 'Settings' ? (
          <SettingsView />
        ) : (
          <div className="placeholder-view">
            <h3>{activeMenu} Section</h3>
            <p>
              This is a mockup placeholder for the <strong>{activeMenu}</strong> page of the CardioRisk AI workspace dashboard application.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
