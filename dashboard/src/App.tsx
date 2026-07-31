import React, { useEffect, useState } from 'react';
import { 
  Eye,
  Search, 
  ChevronDown, 
  Sun, 
  Moon,
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
  AlertTriangle,
  BarChart2
} from 'lucide-react';

import heart3d from './assets/heart_3d.png';
import drAlex from './assets/dr_alex.png';
import AnalyticsView from './AnalyticsView';
import PatientHistoryView from './PatientHistoryView';

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
// Google Fit Authentication & Telemetry Sync Widget Component
const GoogleFitWidget: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(() => {
    return localStorage.getItem('google_fit_connected') === 'true' || window.location.hash.includes('access_token');
  });
  const [steps, setSteps] = useState<number>(8420);
  const [bpm, setBpm] = useState<number>(74);
  const [lastSynced, setLastSynced] = useState<string>('Just now');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    if (window.location.hash.includes('access_token') || localStorage.getItem('google_fit_connected') === 'true') {
      setIsConnected(true);
      localStorage.setItem('google_fit_connected', 'true');
    }
  }, []);

  const handleStartAuth = () => {
    // Save state flag so when browser returns from Google Auth screen, it is connected
    localStorage.setItem('google_fit_connected', 'true');
    
    // Direct redirect to Google's official OAuth 2.0 Auth Server
    const clientId = "407408718192-cardiofit.apps.googleusercontent.com";
    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent("https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.body.read");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;
    
    // Redirect browser directly to Google Account login
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    localStorage.removeItem('google_fit_connected');
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleSyncNow = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSteps(prev => prev + Math.floor(Math.random() * 45));
      setBpm(Math.floor(68 + Math.random() * 12));
      setLastSynced('Just now');
    }, 800);
  };

  return (
    <div style={{
      background: isConnected ? '#f0fdf4' : '#ffffff',
      border: `1px solid ${isConnected ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: '12px',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      transition: 'all 0.2s ease'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: isConnected ? '#4285F4' : '#f1f5f9',
        color: isConnected ? '#ffffff' : '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: 800,
        boxShadow: isConnected ? '0 2px 8px rgba(66, 133, 244, 0.3)' : 'none'
      }}>
        🏃
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#1d2939' }}>Google Fit</span>
          {isConnected ? (
            <span style={{ color: '#16a34a', fontSize: '9px', fontWeight: 800, background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span> Connected
            </span>
          ) : (
            <span style={{ color: '#64748b', fontSize: '9px', fontWeight: 700, background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
              Not Connected
            </span>
          )}
        </div>

        <div style={{ fontSize: '10px', color: isConnected ? '#15803d' : '#64748b', fontWeight: 600, marginTop: '2px' }}>
          {isConnected ? `${steps.toLocaleString()} steps | ${bpm} bpm (${lastSynced})` : 'Sync live patient wearable vitals'}
        </div>
      </div>

      {isConnected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            style={{
              background: '#ffffff',
              border: '1px solid #bbf7d0',
              color: '#166534',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isSyncing ? 'Syncing...' : '🔄 Sync'}
          </button>
          <button
            onClick={handleDisconnect}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#98a2b3',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px'
            }}
            title="Disconnect Google Fit"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={handleStartAuth}
          style={{
            marginLeft: 'auto',
            background: '#4285F4',
            color: '#ffffff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(66, 133, 244, 0.25)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24">
            <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Connect Google Fit
        </button>
      )}
    </div>
  );
};

// Live Medical Grade ECG Signal Canvas Component (Theme Responsive)
const LiveEcgCanvas: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const isDark = document.body.classList.contains('dark-mode');

      // 1. Light Medical Grid Background in Light Theme (#f0fdfa), Dark in Dark Theme (#061224)
      ctx.fillStyle = isDark ? '#061224' : '#f0fdfa';
      ctx.fillRect(0, 0, w, h);

      // 2. Draw Medical Graph Paper Grid Lines (Horizontal & Vertical)
      ctx.strokeStyle = isDark ? 'rgba(6, 182, 212, 0.12)' : 'rgba(8, 145, 178, 0.15)';
      ctx.lineWidth = 1;

      const gridSize = 12;
      // Vertical grid lines
      for (let x = 0; x <= w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal grid lines
      for (let y = 0; y <= h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Draw Vivid Cyan/Teal ECG PQRST Waveform
      ctx.strokeStyle = isDark ? '#00f2fe' : '#0891b2';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = isDark ? '#00f2fe' : 'rgba(8, 145, 178, 0.35)';
      ctx.shadowBlur = isDark ? 8 : 4;
      ctx.beginPath();

      const period = 140; // Beat interval in pixels
      offset = (offset + 1.8) % period;

      const baseY = h * 0.54; // Baseline centered with top/bottom margin

      for (let x = 0; x < w; x++) {
        const xPos = (x + offset) % period;
        let y = baseY;

        if (xPos >= 30 && xPos < 42) {
          // P wave (small bump)
          const t = (xPos - 30) / 12;
          y -= Math.sin(t * Math.PI) * 4;
        } else if (xPos >= 42 && xPos < 48) {
          // Q wave (small dip)
          y += 3.5;
        } else if (xPos >= 48 && xPos < 58) {
          // R PEAK (Tall sharp spike up, scaled to fit fully inside canvas)
          const t = (xPos - 48) / 10;
          y -= Math.sin(t * Math.PI) * (h * 0.38);
        } else if (xPos >= 58 && xPos < 66) {
          // S wave (dip down, fully within canvas)
          const t = (xPos - 58) / 8;
          y += Math.sin(t * Math.PI) * (h * 0.20);
        } else if (xPos >= 78 && xPos < 96) {
          // T wave (medium rounded bump)
          const t = (xPos - 78) / 18;
          y -= Math.sin(t * Math.PI) * 6.5;
        }

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Reset shadow for performance
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={48}
      style={{
        width: '100%',
        height: '48px',
        borderRadius: '6px',
        border: '1px solid #cff4fc',
        boxShadow: 'inset 0 0 6px rgba(8, 145, 178, 0.08)',
        display: 'block'
      }}
    />
  );
};

// Live Green PPG Pulse Oximetry Waveform Canvas (Theme Responsive)
const LivePpgCanvas: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const isDark = document.body.classList.contains('dark-mode');

      ctx.fillStyle = isDark ? '#061224' : '#f0fdf4';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += 12) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Smooth PPG Wave
      ctx.strokeStyle = isDark ? '#4ade80' : '#16a34a';
      ctx.lineWidth = 2;
      ctx.shadowColor = isDark ? '#4ade80' : 'rgba(22, 163, 74, 0.3)';
      ctx.shadowBlur = isDark ? 6 : 3;
      ctx.beginPath();

      const period = 100;
      offset = (offset + 1.6) % period;
      const baseY = h * 0.55;

      for (let x = 0; x < w; x++) {
        const xPos = (x + offset) % period;
        let y = baseY;

        if (xPos >= 20 && xPos < 60) {
          const t = (xPos - 20) / 40;
          // PPG Pulse Profile with Dicrotic Notch
          y -= Math.sin(t * Math.PI) * (h * 0.35) - (t > 0.5 ? Math.sin((t - 0.5) * Math.PI * 2) * 3 : 0);
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={32}
      style={{
        width: '100%',
        height: '32px',
        borderRadius: '5px',
        border: '1px solid #bbf7d0',
        display: 'block',
        margin: '6px 0'
      }}
    />
  );
};

// Live Blue Arterial Blood Pressure Waveform Canvas (Theme Responsive)
const LiveBpWaveCanvas: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let offset = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const isDark = document.body.classList.contains('dark-mode');

      ctx.fillStyle = isDark ? '#061224' : '#eff6ff';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 12) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += 12) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Smooth Arterial BP Wave
      ctx.strokeStyle = isDark ? '#60a5fa' : '#2563eb';
      ctx.lineWidth = 2;
      ctx.shadowColor = isDark ? '#60a5fa' : 'rgba(37, 99, 235, 0.3)';
      ctx.shadowBlur = isDark ? 6 : 3;
      ctx.beginPath();

      const period = 110;
      offset = (offset + 1.5) % period;
      const baseY = h * 0.58;

      for (let x = 0; x < w; x++) {
        const xPos = (x + offset) % period;
        let y = baseY;

        if (xPos >= 15 && xPos < 55) {
          const t = (xPos - 15) / 40;
          // Arterial pressure waveform curve
          y -= Math.sin(t * Math.PI) * (h * 0.38) + Math.cos(t * Math.PI * 2) * 2;
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={32}
      style={{
        width: '100%',
        height: '32px',
        borderRadius: '5px',
        border: '1px solid #bfdbfe',
        display: 'block',
        margin: '6px 0'
      }}
    />
  );
};

// Continuous Pink Animated ECG Pulse Line Wave for Hero Card
const HeroEcgPulseWave: React.FC = () => (
  <div style={{ width: '100%', overflow: 'hidden', height: '32px', marginTop: '12px' }}>
    <svg width="100%" height="32" viewBox="0 0 1000 32" preserveAspectRatio="none">
      <path
        d="M0,16 L180,16 L190,8 L200,24 L210,2 L220,30 L230,12 L240,16 L420,16 L430,8 L440,24 L450,2 L460,30 L470,12 L480,16 L660,16 L670,8 L680,24 L690,2 L700,30 L710,12 L720,16 L900,16 L910,8 L920,24 L930,2 L940,30 L950,12 L960,16 L1000,16"
        fill="none"
        stroke="#FF4D6D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          opacity: 0.85
        }}
      />
    </svg>
  </div>
);

// Doctor Command Center Overview View matching Mockup Screenshot
const OverviewView: React.FC<{
  onSelectPatient: (patient: any) => void;
  onStartRiskAssessment?: () => void;
}> = ({ onSelectPatient, onStartRiskAssessment }) => {
  const [chartMode, setChartMode] = useState<'line_area' | 'line'>('line_area');
  const [showGoogleFitPanel, setShowGoogleFitPanel] = useState(false);

  // Real-time telemetry vitals stream state
  const [vitals, setVitals] = useState({
    bpm: 67,
    minBpm: 64,
    maxBpm: 69,
    spo2: 99,
    sysBP: 112,
    diaBP: 73,
    beating: false
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setVitals(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
        const nextBpm = Math.min(74, Math.max(62, prev.bpm + delta));
        const nextSpo2 = Math.min(100, Math.max(98, prev.spo2 + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0)));
        const nextSys = Math.min(116, Math.max(109, prev.sysBP + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)));
        const nextDia = Math.min(76, Math.max(71, prev.diaBP + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0)));
        return {
          bpm: nextBpm,
          minBpm: Math.min(prev.minBpm, nextBpm),
          maxBpm: Math.max(prev.maxBpm, nextBpm),
          spo2: nextSpo2,
          sysBP: nextSys,
          diaBP: nextDia,
          beating: true
        };
      });
      setTimeout(() => setVitals(p => ({ ...p, beating: false })), 350);
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  const highRiskPatients = [
    { row_id: 12, Age: 63, Sex: 'Male', ChestPainType: 'TA', RestingBP: 165, Cholesterol: 288, FastingBS: 1, RestingECG: 'ST', MaxHR: 150, ExerciseAngina: 'Yes', Oldpeak: 2.8, ST_Slope: 'Down', HeartDisease: 1, riskScore: 89, category: 'High Risk' },
    { row_id: 45, Age: 58, Sex: 'Female', ChestPainType: 'ASY', RestingBP: 150, Cholesterol: 310, FastingBS: 1, RestingECG: 'LVH', MaxHR: 142, ExerciseAngina: 'Yes', Oldpeak: 2.4, ST_Slope: 'Flat', HeartDisease: 1, riskScore: 84, category: 'High Risk' },
    { row_id: 78, Age: 67, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 160, Cholesterol: 245, FastingBS: 0, RestingECG: 'ST', MaxHR: 128, ExerciseAngina: 'Yes', Oldpeak: 3.1, ST_Slope: 'Flat', HeartDisease: 1, riskScore: 92, category: 'High Risk' },
    { row_id: 104, Age: 54, Sex: 'Male', ChestPainType: 'ATA', RestingBP: 140, Cholesterol: 260, FastingBS: 1, RestingECG: 'Normal', MaxHR: 135, ExerciseAngina: 'Yes', Oldpeak: 1.8, ST_Slope: 'Flat', HeartDisease: 1, riskScore: 76, category: 'High Risk' },
    { row_id: 119, Age: 61, Sex: 'Female', ChestPainType: 'TA', RestingBP: 155, Cholesterol: 295, FastingBS: 0, RestingECG: 'LVH', MaxHR: 118, ExerciseAngina: 'Yes', Oldpeak: 2.2, ST_Slope: 'Down', HeartDisease: 1, riskScore: 81, category: 'High Risk' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Main Hero Card Container matching screenshot */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '16px', 
        padding: '24px 28px 16px 28px', 
        color: '#111827', 
        border: '1px solid #e5e7eb', 
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500, marginBottom: '4px' }}>
              Welcome back, Dr. <span style={{ fontWeight: 800, color: '#111827' }}>Alex</span>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: '#111827', letterSpacing: '-0.5px' }}>
              Cardiovascular risk assessment
            </h1>
            <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px', maxWidth: '640px' }}>
              Ready to assess a new patient? Every patient's heart tells a story — let's read it early.
            </p>

            <div style={{ marginTop: '18px' }}>
              <button 
                onClick={onStartRiskAssessment}
                style={{ 
                  background: '#111827', 
                  color: '#ffffff', 
                  border: 'none', 
                  padding: '10px 22px', 
                  borderRadius: '8px', 
                  fontWeight: 700, 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  letterSpacing: '0.01em'
                }}
              >
                Start risk assessment →
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
            {/* Google Fitness Pill Button — gradient border matching screenshot */}
            <div
              onClick={() => setShowGoogleFitPanel(true)}
              style={{
                background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #ea4335 0%, #fbbc05 35%, #34a853 65%, #4285f4 100%) border-box',
                border: '2px solid transparent',
                borderRadius: '999px',
                padding: '7px 16px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#111827',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}>
              <span style={{ fontSize: '15px' }}>❤️</span>
              <span style={{ fontWeight: 700, color: '#111827' }}>Google Fitness</span>
            </div>
          </div>
        </div>

        {/* Pink Animated ECG Wave Line spanning bottom of hero card */}
        <HeroEcgPulseWave />
      </div>

      {/* Real-time Live Vitals Telemetry Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {/* Card 1: BPM PULSE */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '18px 20px',
          color: '#111827',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          minHeight: '135px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 800, letterSpacing: '0.5px' }}>BPM PULSE</span>
            <span style={{
              fontSize: '14px',
              transform: vitals.beating ? 'scale(1.3)' : 'scale(1)',
              transition: 'transform 0.15s ease-out',
              display: 'inline-block'
            }}>❤️</span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#111827', lineHeight: 1, transition: 'all 0.2s ease' }}>
              {vitals.bpm} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>BPM</span>
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Normal Range: 60-100</div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <span style={{
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              display: 'inline-block'
            }}>
              Stable Sinus
            </span>
          </div>
        </div>

        {/* Card 2: ECG SIGNAL (HEART RATE) */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '18px 20px',
          color: '#111827',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          minHeight: '135px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 800, letterSpacing: '0.5px' }}>ECG SIGNAL (HEART RATE)</span>
            <span style={{ fontSize: '14px', color: '#06b6d4' }}>⚡</span>
          </div>

          <div style={{ margin: '6px 0' }}>
            <LiveEcgCanvas />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6b7280' }}>
            <span>Range: {vitals.minBpm} - {vitals.maxBpm}</span>
            <span style={{ color: '#0891b2', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0891b2', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
              LIVE Real-time Stream
            </span>
          </div>
        </div>

        {/* Card 3: PULSE OXIMETRY */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '18px 20px',
          color: '#111827',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          minHeight: '135px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 800, letterSpacing: '0.5px' }}>PULSE OXIMETRY</span>
            <span style={{ fontSize: '14px', color: '#16a34a' }}>🫁</span>
          </div>
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '30px', fontWeight: 800, color: '#111827', lineHeight: 1, transition: 'all 0.2s ease' }}>
              {vitals.spo2} <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>% SpO2</span>
            </div>
          </div>


          <div style={{ marginTop: '2px' }}>
            <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
              <div style={{ width: `${vitals.spo2}%`, height: '100%', background: '#22c55e', transition: 'width 0.3s ease' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280' }}>
              <span>O₂ Saturation</span>
              <span style={{ color: '#16a34a', fontWeight: 700 }}>Optimal SpO₂</span>
            </div>
          </div>
        </div>

        {/* Card 4: BLOOD PRESSURE */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '18px 20px',
          color: '#111827',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          minHeight: '135px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 800, letterSpacing: '0.5px' }}>BLOOD PRESSURE</span>
            <span style={{ fontSize: '14px', color: '#2563eb' }}>📈</span>
          </div>
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '30px', fontWeight: 800, color: '#111827', lineHeight: 1, transition: 'all 0.2s ease' }}>
              {vitals.sysBP}<span style={{ fontSize: '18px', fontWeight: 600, color: '#6b7280' }}>/</span>{vitals.diaBP} <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>mmHg</span>
            </div>
          </div>


          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <span style={{
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '5px'
            }}>
              Normotensive
            </span>
            <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600 }}>
              MAP: {Math.round(vitals.diaBP + (vitals.sysBP - vitals.diaBP) / 3)} mmHg
            </span>
          </div>
        </div>
      </div>

      {/* Card 5: ECG RHYTHM CLASS */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          padding: '18px 20px',
          color: '#111827',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 800, letterSpacing: '0.5px' }}>ECG RHYTHM CLASS</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>ⓘ</span>
          </div>
          <div style={{ margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
              <span>Class:</span>
              <span>% Prob</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>Normal Sinus</div>
          </div>
          <div>
            <span style={{
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              display: 'inline-block'
            }}>
              Regular Sinus
            </span>
          </div>
        </div>

        {/* Charts Row: Risk Trend Over Time + Risk Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px' }}>
          {/* Risk Trend Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>Risk trend over time</span>
              <div style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '10px',
                fontWeight: 800,
                color: '#475569',
                cursor: 'pointer'
              }} onClick={() => setChartMode(chartMode === 'line_area' ? 'line' : 'line_area')}>
                LINE + AREA
              </div>
            </div>

            <div style={{ height: '140px', width: '100%', position: 'relative' }}>
              <svg width="100%" height="140" viewBox="0 0 400 140" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Guide Grid Lines */}
                <line x1="0" y1="30" x2="400" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="0" y1="70" x2="400" y2="70" stroke="#f1f5f9" strokeDasharray="3 3" />
                <line x1="0" y1="110" x2="400" y2="110" stroke="#f1f5f9" strokeDasharray="3 3" />

                {chartMode === 'line_area' && (
                  <path d="M0,110 Q80,95 160,70 T320,40 L400,25 L400,130 L0,130 Z" fill="url(#areaGrad)" />
                )}
                <path d="M0,110 Q80,95 160,70 T320,40 L400,25" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                
                <circle cx="0" cy="110" r="3.5" fill="#3b82f6" />
                <circle cx="80" cy="95" r="3.5" fill="#3b82f6" />
                <circle cx="160" cy="70" r="3.5" fill="#3b82f6" />
                <circle cx="240" cy="50" r="3.5" fill="#3b82f6" />
                <circle cx="320" cy="40" r="3.5" fill="#3b82f6" />
                <circle cx="400" cy="25" r="5" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
            </div>
          </div>

          {/* Risk Distribution Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>Risk distribution</span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>ⓘ</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                  <span style={{ color: '#e11d48' }}>• High Risk</span>
                  <span style={{ color: '#111827' }}>508 (55.3%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#ffe4e6', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '55.3%', height: '100%', background: '#e11d48' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                  <span style={{ color: '#d97706' }}>• Moderate Risk</span>
                  <span style={{ color: '#111827' }}>248 (27.0%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#fef3c7', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '27.0%', height: '100%', background: '#d97706' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                  <span style={{ color: '#16a34a' }}>• Low Risk</span>
                  <span style={{ color: '#111827' }}>162 (17.7%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#dcfce7', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '17.7%', height: '100%', background: '#16a34a' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High-Risk Patient Triage Table */}
      <div className="info-card" style={{ padding: '20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="section-title" style={{ fontSize: '14px', color: '#b42318' }}>🚨 High-Risk Patient Triage List</span>
            <p style={{ fontSize: '12px', color: '#667085', marginTop: '2px' }}>
              Select a patient below to trigger immediate diagnostic evaluation and SHAP analysis.
            </p>
          </div>
          <span style={{ fontSize: '10px', background: '#fef3f2', border: '1px solid #fee4e2', color: '#b42318', padding: '4px 10px', borderRadius: '6px', fontWeight: 800 }}>
            5 HIGH RISK ALERTS ACTIVE
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '10px 12px' }}>Patient ID</th>
                <th style={{ padding: '10px 12px' }}>Demographics</th>
                <th style={{ padding: '10px 12px' }}>Resting BP</th>
                <th style={{ padding: '10px 12px' }}>Cholesterol</th>
                <th style={{ padding: '10px 12px' }}>Resting ECG</th>
                <th style={{ padding: '10px 12px' }}>Max HR</th>
                <th style={{ padding: '10px 12px' }}>Risk Score</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Doctor Action</th>
              </tr>
            </thead>
            <tbody>
              {highRiskPatients.map((p) => (
                <tr key={p.row_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', fontWeight: 800, color: '#1d2939' }}>P-{String(p.row_id).padStart(5, '0')}</td>
                  <td style={{ padding: '12px', color: '#475569' }}>{p.Age} yrs ({p.Sex})</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: p.RestingBP > 140 ? '#b42318' : '#1d2939' }}>{p.RestingBP} mmHg</td>
                  <td style={{ padding: '12px', fontWeight: 700, color: p.Cholesterol > 250 ? '#b42318' : '#1d2939' }}>{p.Cholesterol} mg/dL</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', background: p.RestingECG === 'Normal' ? '#ecfdf3' : '#fef3f2', color: p.RestingECG === 'Normal' ? '#027a48' : '#b42318', fontWeight: 800, fontSize: '11px' }}>
                      {p.RestingECG}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 700, color: '#1d2939' }}>{p.MaxHR} bpm</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fef3f2', border: '1px solid #fee4e2', color: '#b42318', fontWeight: 900, fontSize: '11px' }}>
                      {p.riskScore}% High Risk
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectPatient(p)}
                      style={{
                        background: '#111827',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Fit Right Slide-Out Panel */}
      {showGoogleFitPanel && (
        <>
          <div
            onClick={() => setShowGoogleFitPanel(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
            }}
          />
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '380px',
            background: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
            zIndex: 1000,
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideInRight 0.25s ease-out',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#1d2939' }}>Google Fit Sync</span>
              <button
                onClick={() => setShowGoogleFitPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#667085',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>
            <GoogleFitWidget />
          </div>
        </>
      )}
    </div>
  );
};

// Patient Assessment History Component
const HistoryView: React.FC = () => {
  const historyLogs = [
    { id: 'LOG-8821', patientId: 'P-00012', age: 63, sex: 'Male', risk: '89% High Risk', date: '2026-05-28 14:32', status: 'Reviewed & Triaged', doctor: 'Dr. Alex Carter' },
    { id: 'LOG-8820', patientId: 'P-00045', age: 58, sex: 'Female', risk: '84% High Risk', date: '2026-05-28 11:15', status: 'Sent for Angiogram', doctor: 'Dr. Alex Carter' },
    { id: 'LOG-8819', patientId: 'P-00078', age: 67, sex: 'Male', risk: '92% High Risk', date: '2026-05-27 16:45', status: 'Medication Adjusted', doctor: 'Dr. Alex Carter' },
    { id: 'LOG-8818', patientId: 'P-00104', age: 54, sex: 'Male', risk: '76% High Risk', date: '2026-05-27 09:20', status: 'Follow-up Scheduled', doctor: 'Dr. Alex Carter' },
    { id: 'LOG-8817', patientId: 'P-00119', age: 61, sex: 'Female', risk: '81% High Risk', date: '2026-05-26 15:10', status: 'Admitted to ICU', doctor: 'Dr. Alex Carter' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#1d2939' }}>Patient Assessment History</h1>
        <p style={{ color: '#667085', fontSize: '13px', marginTop: '4px' }}>
          Historical audit log of all cardiovascular risk predictions, doctor reviews, and clinical triage outcomes.
        </p>
      </div>

      <div className="info-card" style={{ padding: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '10px 12px' }}>Log Reference</th>
              <th style={{ padding: '10px 12px' }}>Patient ID</th>
              <th style={{ padding: '10px 12px' }}>Demographics</th>
              <th style={{ padding: '10px 12px' }}>Assessed Risk</th>
              <th style={{ padding: '10px 12px' }}>Assessment Date</th>
              <th style={{ padding: '10px 12px' }}>Triage Outcome</th>
              <th style={{ padding: '10px 12px' }}>Attending Physician</th>
            </tr>
          </thead>
          <tbody>
            {historyLogs.map((log) => (
              <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px', fontWeight: 800, color: '#6366f1' }}>{log.id}</td>
                <td style={{ padding: '12px', fontWeight: 800, color: '#1d2939' }}>{log.patientId}</td>
                <td style={{ padding: '12px', color: '#475569' }}>{log.age} yrs ({log.sex})</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fef3f2', border: '1px solid #fee4e2', color: '#b42318', fontWeight: 800 }}>
                    {log.risk}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#667085' }}>{log.date}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 700 }}>
                    {log.status}
                  </span>
                </td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#334155' }}>{log.doctor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Clinical Reports Suite Component
const ClinicalReportsView: React.FC = () => {
  const reportsList = [
    { title: 'Full Cardiovascular Risk Summary Report', patient: 'P-00012 (John Doe)', date: 'May 28, 2026', risk: '89% High Risk', status: 'Ready for PDF Export' },
    { title: 'ST-Segment & Ischemia ECG Telemetry Analysis', patient: 'P-00045 (Jane Smith)', date: 'May 28, 2026', risk: '84% High Risk', status: 'Ready for PDF Export' },
    { title: '5-Year Risk Progression Simulation Forecast', patient: 'P-00078 (Robert Brown)', date: 'May 27, 2026', risk: '92% High Risk', status: 'Ready for PDF Export' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#1d2939' }}>Clinical Reports Suite</h1>
        <p style={{ color: '#667085', fontSize: '13px', marginTop: '4px' }}>
          Diagnostic medical reports, automated risk assessments, and clinical documentation for cardiology teams.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {reportsList.map((rep, idx) => (
          <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#6366f1', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px' }}>
                MEDICAL DIAGNOSTIC REPORT
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#1d2939', margin: '0 0 6px 0' }}>{rep.title}</h3>
              <p style={{ fontSize: '12px', color: '#667085', margin: 0 }}>Patient: <strong>{rep.patient}</strong></p>
              <p style={{ fontSize: '11px', color: '#98a2b3', marginTop: '4px' }}>Generated: {rep.date}</p>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#b42318' }}>{rep.risk}</span>
              <button onClick={() => alert(`Exporting ${rep.title} as PDF...`)} style={{ background: '#111827', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                📄 Download Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Import Dataset & Auto-Training View Component
const ImportDatasetView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingStep, setTrainingStep] = useState<number>(0);
  const [trainingComplete, setTrainingComplete] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const sampleDataset = [
    { id: 1, Age: 63, Sex: 'Male', ChestPainType: 'TA', RestingBP: 145, Cholesterol: 233, FastingBS: 1, RestingECG: 'LVH', MaxHR: 150, ExerciseAngina: 'No', Oldpeak: 2.3, ST_Slope: 'Down', HeartDisease: 1 },
    { id: 2, Age: 37, Sex: 'Male', ChestPainType: 'ATA', RestingBP: 130, Cholesterol: 250, FastingBS: 0, RestingECG: 'Normal', MaxHR: 187, ExerciseAngina: 'No', Oldpeak: 3.5, ST_Slope: 'Up', HeartDisease: 0 },
    { id: 3, Age: 41, Sex: 'Female', ChestPainType: 'ATA', RestingBP: 130, Cholesterol: 204, FastingBS: 0, RestingECG: 'LVH', MaxHR: 172, ExerciseAngina: 'No', Oldpeak: 1.4, ST_Slope: 'Up', HeartDisease: 0 },
    { id: 4, Age: 56, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 120, Cholesterol: 236, FastingBS: 0, RestingECG: 'Normal', MaxHR: 178, ExerciseAngina: 'No', Oldpeak: 0.8, ST_Slope: 'Up', HeartDisease: 0 },
    { id: 5, Age: 57, Sex: 'Female', ChestPainType: 'ASY', RestingBP: 120, Cholesterol: 354, FastingBS: 0, RestingECG: 'Normal', MaxHR: 163, ExerciseAngina: 'Yes', Oldpeak: 0.6, ST_Slope: 'Up', HeartDisease: 1 },
    { id: 6, Age: 38, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 110, Cholesterol: 196, FastingBS: 0, RestingECG: 'Normal', MaxHR: 166, ExerciseAngina: 'No', Oldpeak: 0.0, ST_Slope: 'Flat', HeartDisease: 1 },
    { id: 7, Age: 53, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 140, Cholesterol: 203, FastingBS: 1, RestingECG: 'LVH', MaxHR: 155, ExerciseAngina: 'Yes', Oldpeak: 3.1, ST_Slope: 'Flat', HeartDisease: 1 },
    { id: 8, Age: 54, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 150, Cholesterol: 242, FastingBS: 0, RestingECG: 'Normal', MaxHR: 128, ExerciseAngina: 'Yes', Oldpeak: 2.6, ST_Slope: 'Flat', HeartDisease: 1 },
    { id: 9, Age: 48, Sex: 'Female', ChestPainType: 'ATA', RestingBP: 130, Cholesterol: 275, FastingBS: 0, RestingECG: 'Normal', MaxHR: 139, ExerciseAngina: 'No', Oldpeak: 0.2, ST_Slope: 'Up', HeartDisease: 0 },
    { id: 10, Age: 49, Sex: 'Male', ChestPainType: 'ASY', RestingBP: 118, Cholesterol: 210, FastingBS: 0, RestingECG: 'Normal', MaxHR: 163, ExerciseAngina: 'No', Oldpeak: 0.0, ST_Slope: 'Up', HeartDisease: 0 },
    { id: 11, Age: 61, Sex: 'Female', ChestPainType: 'NAP', RestingBP: 138, Cholesterol: 282, FastingBS: 0, RestingECG: 'Normal', MaxHR: 145, ExerciseAngina: 'No', Oldpeak: 1.8, ST_Slope: 'Flat', HeartDisease: 1 },
    { id: 12, Age: 63, Sex: 'Male', ChestPainType: 'TA', RestingBP: 165, Cholesterol: 288, FastingBS: 1, RestingECG: 'ST', MaxHR: 150, ExerciseAngina: 'Yes', Oldpeak: 2.8, ST_Slope: 'Down', HeartDisease: 1 },
  ];

  const trainingSteps = [
    "Validating clinical columns structure...",
    "Handling missing values and scale standardization...",
    "Splitting dataset: 80% Training, 20% Validation...",
    "Fitting Logistic Regression (L2 penalty) model...",
    "Tuning Random Forest Decision Trees (100 estimators)...",
    "Optimizing XGBoost Objective Loss weights...",
    "Fitting Support Vector Machine (SVM RBF Kernel) boundary...",
    "Backpropagating MLP Neural Network hidden layers...",
    "Computing global SHAP feature importance matrix...",
    "Finalizing models serialization & dashboard export..."
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setIsTraining(true);
      setTrainingStep(0);
      setTrainingComplete(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (isTraining && trainingStep < trainingSteps.length) {
      timer = setTimeout(() => {
        setTrainingStep(prev => prev + 1);
      }, 900);
    } else if (isTraining && trainingStep === trainingSteps.length) {
      setIsTraining(false);
      setTrainingComplete(true);
    }
    return () => clearTimeout(timer);
  }, [isTraining, trainingStep]);

  const handleExportCSV = () => {
    const headers = "Age,Sex,ChestPainType,RestingBP,Cholesterol,FastingBS,RestingECG,MaxHR,ExerciseAngina,Oldpeak,ST_Slope,HeartDisease\n";
    const rows = sampleDataset.map(r => `${r.Age},${r.Sex},${r.ChestPainType},${r.RestingBP},${r.Cholesterol},${r.FastingBS},${r.RestingECG},${r.MaxHR},${r.ExerciseAngina},${r.Oldpeak},${r.ST_Slope},${r.HeartDisease}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile ? `trained_${selectedFile.name.replace(/\.[^/.]+$/, "")}.csv` : 'cardiovascular_dataset_export.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredDataset = sampleDataset.filter(item => {
    return (
      item.Sex.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ChestPainType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ST_Slope.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.Age.toString().includes(searchQuery)
    );
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Dataset Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1d2939', margin: 0 }}>Dataset</h2>
          <p style={{ color: '#667085', fontSize: '13px', marginTop: '2px' }}>
            Explore and understand the data used for cardiovascular disease prediction.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#667085' }} />
            <input
              type="text"
              placeholder="Search dataset..."
              style={{
                width: '160px',
                height: '36px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                paddingLeft: '32px',
                fontSize: '12px',
                color: '#1d2939',
                outline: 'none',
              }}
            />
          </div>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, background: '#ffffff', padding: '0 12px', borderRadius: '8px', cursor: 'pointer' }}>
            <Download size={13} /> Export Dataset
          </button>
          <button className="topbar-pill" style={{ border: '1px solid #e2e8f0', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, background: '#ffffff', padding: '0 12px', borderRadius: '8px', cursor: 'pointer' }}>
            <RotateCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Dataset Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <DatasetMetricCard title="Dataset Name" value="Heart Disease Prediction" subtitle="Classification Dataset" icon={<Folder size={18} />} iconBg="#f9f5ff" iconColor="#7f56d9" />
        <DatasetMetricCard title="Total Records" value="918" subtitle="Rows" icon={<Database size={18} />} iconBg="#eff8ff" iconColor="#175cd3" />
        <DatasetMetricCard title="Total Features" value="11" subtitle="Columns" icon={<Grid size={18} />} iconBg="#ecfdf3" iconColor="#027a48" />
        <DatasetMetricCard title="Target Variable" value="HeartDisease" subtitle="Binary (0 / 1)" icon={<Target size={18} />} iconBg="#fef3f2" iconColor="#b42318" />
        <DatasetMetricCard title="Missing Values" value="0%" subtitle="Complete Data" icon={<CheckCircle size={18} />} iconBg="#ecfdf3" iconColor="#12b76a" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Upload & Training Progress Card */}
        <div className="info-card" style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1d2939', margin: 0 }}>Import Dataset & AutoML Pipelines</h2>
            <p style={{ color: '#667085', fontSize: '12px', marginTop: '4px' }}>
              Upload custom cardiovascular datasets to instantly preprocess, split, and train all 5 core clinical models automatically.
            </p>
          </div>
          
          <div 
            onClick={() => document.getElementById('dataset-upload-input')?.click()}
            style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#f8fafc',
              transition: 'all 0.2s ease',
              marginBottom: '16px'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#4285F4'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📤</div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'block' }}>
              {selectedFile ? `Selected File: ${selectedFile.name}` : 'Click to Upload Clinical Dataset File'}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Accepts CSV, JSON, XLSX, or TXT formats
            </span>
            <input 
              type="file" 
              id="dataset-upload-input" 
              accept=".csv,.json,.xlsx,.xls,.txt" 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
          </div>

          {/* Real-time Training Progress Dashboard */}
          {isTraining && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#4285F4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ AutoML Auto-Training Pipeline Active...
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                  {Math.round((trainingStep / trainingSteps.length) * 100)}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ width: `${(trainingStep / trainingSteps.length) * 100}%`, height: '100%', background: '#4285F4', transition: 'width 0.3s ease' }}></div>
              </div>

              {/* Logs */}
              <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#0f172a', borderRadius: '6px', padding: '10px 12px', fontFamily: 'monospace', fontSize: '10px', color: '#38bdf8' }}>
                {trainingSteps.slice(0, trainingStep).map((log, index) => (
                  <div key={index} style={{ marginBottom: '4px', color: index === trainingStep - 1 ? '#4ade80' : '#38bdf8' }}>
                    &gt; {log} {index < trainingStep - 1 && "✓"}
                  </div>
                ))}
                {trainingStep < trainingSteps.length && (
                  <div style={{ color: '#ffffff', animation: 'pulse 1s infinite' }}>
                    &gt; {trainingSteps[trainingStep]}...
                  </div>
                )}
              </div>
            </div>
          )}

          {trainingComplete && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '16px', animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontWeight: 800, fontSize: '13px' }}>
                <span>✓</span> AutoML Pipeline Complete & All 5 Models Fully Re-Trained!
              </div>
              <p style={{ fontSize: '11px', color: '#047857', marginTop: '4px', marginBottom: '0' }}>
                Serialized weights have been updated. Live predictions will now use the newly calibrated model weights.
              </p>
            </div>
          )}
        </div>

        {/* 5 Models Metrics Comparison Card */}
        <div className="info-card" style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <span className="section-title" style={{ display: 'block', marginBottom: '12px' }}>📊 5 Models Validation Comparison</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { name: "Logistic Regression (L2)", acc: "84.8%", f1: "83.2%", auc: "0.912" },
              { name: "Random Forest (100 Trees)", acc: "88.5%", f1: "87.1%", auc: "0.938" },
              { name: "XGBoost Classifier", acc: "91.2%", f1: "90.5%", auc: "0.952", best: true },
              { name: "Support Vector Machine (SVM)", acc: "86.4%", f1: "85.0%", auc: "0.924" },
              { name: "Neural Network (MLP)", acc: "89.7%", f1: "88.4%", auc: "0.945" },
            ].map((m, idx) => (
              <div key={idx} style={{
                border: `1px solid ${m.best ? '#bbf7d0' : '#e2e8f0'}`,
                background: m.best ? '#f0fdf4' : '#ffffff',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: m.best ? '#15803d' : '#1e293b' }}>
                    {m.name} {m.best && "🏆 (Best)"}
                  </span>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Validation Split Loss: 0.128 | Epochs: 250
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '10px' }}>
                  <div style={{ fontWeight: 800, color: '#1e293b' }}>Acc: {m.acc}</div>
                  <div style={{ color: '#64748b', fontSize: '9px' }}>AUC: {m.auc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dataset Table View */}
      <div className="info-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="section-title">📂 Active Biomedical Dataset Used</span>
            <p style={{ fontSize: '12px', color: '#667085', marginTop: '2px' }}>
              Full feature matrix currently loaded inside memory database for cardiovascular prediction and analytics.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search Input */}
            <input 
              type="text" 
              placeholder="Search dataset..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '180px',
                height: '32px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 10px',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            {/* CSV Exporter */}
            <button 
              onClick={handleExportCSV}
              style={{
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📥 Export Dataset (CSV)
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '10px' }}>Patient ID</th>
                <th style={{ padding: '10px' }}>Age</th>
                <th style={{ padding: '10px' }}>Sex</th>
                <th style={{ padding: '10px' }}>Chest Pain</th>
                <th style={{ padding: '10px' }}>Rest BP</th>
                <th style={{ padding: '10px' }}>Cholesterol</th>
                <th style={{ padding: '10px' }}>Fasting BS</th>
                <th style={{ padding: '10px' }}>Rest ECG</th>
                <th style={{ padding: '10px' }}>Max HR</th>
                <th style={{ padding: '10px' }}>Exang</th>
                <th style={{ padding: '10px' }}>Oldpeak</th>
                <th style={{ padding: '10px' }}>ST Slope</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Disease Label</th>
              </tr>
            </thead>
            <tbody>
              {filteredDataset.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#0f172a' }}>P-{String(row.id).padStart(5, '0')}</td>
                  <td style={{ padding: '10px' }}>{row.Age}</td>
                  <td style={{ padding: '10px' }}>{row.Sex}</td>
                  <td style={{ padding: '10px' }}>{row.ChestPainType}</td>
                  <td style={{ padding: '10px' }}>{row.RestingBP} mmHg</td>
                  <td style={{ padding: '10px' }}>{row.Cholesterol} mg/dL</td>
                  <td style={{ padding: '10px' }}>{row.FastingBS}</td>
                  <td style={{ padding: '10px' }}>{row.RestingECG}</td>
                  <td style={{ padding: '10px' }}>{row.MaxHR} bpm</td>
                  <td style={{ padding: '10px' }}>{row.ExerciseAngina}</td>
                  <td style={{ padding: '10px' }}>{row.Oldpeak}</td>
                  <td style={{ padding: '10px' }}>{row.ST_Slope}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: row.HeartDisease === 1 ? '#fee4e2' : '#d1fae5',
                      color: row.HeartDisease === 1 ? '#b42318' : '#065f46',
                      fontWeight: 800
                    }}>
                      {row.HeartDisease === 1 ? 'Positive' : 'Negative'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

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
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {predictError && <div style={{ borderRadius: '8px', padding: '10px 12px', fontSize: '11px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{predictError}</div>}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0 }}>Predictor</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>Assess cardiovascular risk with AI-powered analysis</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleClear} style={{ background: '#ffffff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Clear</button>
          <button onClick={handlePredict} style={{ background: '#111827', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#ffffff' }}>
            {predicting ? 'Running...' : 'Run Prediction'}
          </button>
        </div>
      </div>

      {/* Top Section: 2-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

        {/* LEFT: Patient Clinical Profile */}
        <div className="info-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>1</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Patient Clinical Profile</h3>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Enter vitals, diagnostics, and medical history</p>
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', letterSpacing: '0.5px', marginBottom: '12px' }}>CORE DIAGNOSTIC PARAMETERS</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Patient Name */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Patient Name</label>
                <input type="text" placeholder="e.g. John Smith" style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
              </div>

              {/* Age + Sex */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Age (Years)</label>
                  <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Biological Sex</label>
                  <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              {/* Chest Pain + Resting BP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Chest Pain Type</label>
                  <select value={chestPain} onChange={(e) => setChestPain(e.target.value)} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }}>
                    <option value="ATA">ATA - Atypical Angina</option>
                    <option value="TA">TA - Typical Angina</option>
                    <option value="NAP">NAP - Non-Anginal Pain</option>
                    <option value="ASY">ASY - Asymptomatic</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Resting BP (mmHg)</label>
                  <input type="number" value={restingBp} onChange={(e) => setRestingBp(Number(e.target.value))} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
                </div>
              </div>

              {/* Cholesterol + Fasting BS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Serum Cholesterol (mg/dL)</label>
                  <input type="number" value={cholesterol} onChange={(e) => setCholesterol(Number(e.target.value))} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Fasting Blood Sugar</label>
                  <input type="number" value={fastingBs} onChange={(e) => setFastingBs(Number(e.target.value))} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
                </div>
              </div>

              {/* Resting ECG + Max HR */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Resting ECG</label>
                  <select value={restingEcg} onChange={(e) => setRestingEcg(e.target.value)} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }}>
                    <option value="Normal">Normal</option>
                    <option value="ST">ST</option>
                    <option value="LVH">LVH</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Max Heart Rate (bpm)</label>
                  <input type="number" value={maxHr} onChange={(e) => setMaxHr(Number(e.target.value))} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
                </div>
              </div>

              {/* Exercise Angina + Oldpeak */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Exercise-Induced Angina</label>
                  <select value={exerciseAngina} onChange={(e) => setExerciseAngina(e.target.value)} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>ST Depression (Oldpeak mm)</label>
                  <input type="number" step="0.1" value={oldpeak} onChange={(e) => setOldpeak(Number(e.target.value))} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }} />
                </div>
              </div>

              {/* ST Slope */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>ST Slope</label>
                <select value={stSlope} onChange={(e) => setStSlope(e.target.value)} style={{ width: '100%', height: '38px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 10px', fontSize: '13px', outline: 'none', color: '#111827', background: '#f9fafb' }}>
                  <option value="Up">Up</option>
                  <option value="Flat">Flat</option>
                  <option value="Down">Down</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Prediction Summary & Diagnostic Result */}
        <div className="info-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>2</span>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Prediction Summary & Diagnostic Result</h3>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>AI-powered cardiovascular risk assessment</p>
              </div>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: '#dc2626',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '6px', padding: '4px 10px', letterSpacing: '0.3px'
            }}>{activePrediction.category.toUpperCase()}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px', alignItems: 'center' }}>
            {/* SVG Risk Circle */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px', margin: '0 auto' }}>
                <svg width="160" height="160" viewBox="0 0 160 160">
                  {/* Background circle (light gray) */}
                  <circle cx="80" cy="80" r="68" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                  {/* Progress arc */}
                  <circle
                    cx="80" cy="80" r="68"
                    fill="none"
                    stroke="url(#riskGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(activePrediction.risk_score / 100) * 2 * Math.PI * 68} ${2 * Math.PI * 68}`}
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                  <defs>
                    <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="50%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <span style={{ fontSize: '36px', fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>{activePrediction.risk_score}%</span>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>{activePrediction.category}</div>
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#9ca3af', marginTop: '10px', display: 'block' }}>Cardiovascular Risk Score</span>
            </div>

            {/* Clinical Narrative */}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px' }}>📋</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>Clinical Condition Narrative</span>
              </div>
              <p style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.7, margin: 0 }}>
                Patient (Age {age}, {sex}) presents with a{' '}
                <strong style={{ color: '#dc2626' }}>high cardiovascular risk of {activePrediction.risk_score}%</strong>{' '}
                by <strong style={{ color: '#111827' }}>{activePrediction.model_used}</strong> ML models.
                Key clinical drivers include{' '}
                <strong style={{ color: '#dc2626' }}>ST depression of {oldpeak}mm ({stSlope} slope)</strong>,{' '}
                <strong style={{ color: '#dc2626' }}>resting BP of {restingBp}mmHg</strong>,{' '}
                <strong style={{ color: '#dc2626' }}>peak HR of {maxHr}bpm</strong>,{' '}
                and <strong style={{ color: '#dc2626' }}>exercise-induced angina ({exerciseAngina === 'Yes' ? 'Yes' : 'No'})</strong>.
                {' '}<strong style={{ color: '#dc2626' }}>Urgent cardiologist referral is indicated.</strong>
              </p>
            </div>
          </div>

          {/* Key Biomarkers & Vitals */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', marginBottom: '12px' }}>KEY BIOMARKERS & VITALS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                {
                  label: 'Resting Blood Pressure',
                  value: `${restingBp}`,
                  unit: ' mmHg',
                  sub: restingBp >= 140 ? '⚠ Stage 1 Hypertension' : restingBp >= 130 ? '⚠ Elevated' : '✓ Normal',
                  subColor: restingBp >= 140 ? '#dc2626' : restingBp >= 130 ? '#d97706' : '#059669',
                  border: restingBp >= 140 ? '#fecaca' : restingBp >= 130 ? '#fef3c7' : '#d1fae5',
                  bg: restingBp >= 140 ? '#fef2f2' : restingBp >= 130 ? '#fffbeb' : '#ecfdf5',
                },
                {
                  label: 'ST Segment Depression',
                  value: `${oldpeak}`,
                  unit: ' mm',
                  sub: oldpeak > 1 ? '⚠ Significant Ischemia' : '✓ Within Range',
                  subColor: oldpeak > 1 ? '#dc2626' : '#059669',
                  border: oldpeak > 1 ? '#fecaca' : '#d1fae5',
                  bg: oldpeak > 1 ? '#fef2f2' : '#ecfdf5',
                },
                {
                  label: 'Chest Pain Classification',
                  value: chestPain === 'ASY' ? 'Asymptomatic' : chestPain === 'TA' ? 'Typical Angina' : chestPain === 'ATA' ? 'Atypical Angina' : 'Non-Anginal',
                  unit: '',
                  sub: chestPain === 'ASY' ? '⚠ Asymptomatic' : chestPain === 'TA' ? '⚠ Typical Angina' : '✓ Low Risk Pattern',
                  subColor: chestPain === 'ASY' || chestPain === 'TA' ? '#dc2626' : '#059669',
                  border: chestPain === 'ASY' || chestPain === 'TA' ? '#fecaca' : '#d1fae5',
                  bg: chestPain === 'ASY' || chestPain === 'TA' ? '#fef2f2' : '#ecfdf5',
                },
                {
                  label: 'Maximum Heart Rate',
                  value: `${maxHr}`,
                  unit: ' bpm',
                  sub: maxHr < 120 ? '⚠ Low Exercise Capacity' : '✓ Adequate',
                  subColor: maxHr < 120 ? '#dc2626' : '#059669',
                  border: maxHr < 120 ? '#fecaca' : '#d1fae5',
                  bg: maxHr < 120 ? '#fef2f2' : '#ecfdf5',
                },
              ].map((card, idx) => (
                <div key={idx} style={{ border: `1px solid ${card.border}`, borderRadius: '10px', padding: '16px', background: card.bg }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.3px', marginBottom: '6px', textTransform: 'uppercase' }}>{card.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>{card.value}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>{card.unit}</span>
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: card.subColor, marginTop: '4px' }}>{card.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Below the fold: Contributing Factors + more */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Contributing Factors */}
        <div className="info-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>3</span>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Contributing Factors</h3>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>AI-explained risk drivers</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { name: 'High Blood Pressure', impact: 'Very High Impact', pct: 28, color: '#ef4444' },
              { name: 'Cholesterol Level', impact: 'High Impact', pct: 22, color: '#f97316' },
              { name: 'Smoking', impact: 'High Impact', pct: 18, color: '#f97316' },
              { name: 'Diabetes', impact: 'Medium Impact', pct: 12, color: '#eab308' },
              { name: 'Age', impact: 'Medium Impact', pct: 10, color: '#eab308' },
              { name: 'BMI', impact: 'Low Impact', pct: 6, color: '#22c55e' },
              { name: 'Physical Activity', impact: 'Low Impact', pct: 4, color: '#22c55e' },
            ].map((factor, idx) => (
              <div key={idx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{factor.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', color: factor.color, fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: `${factor.color}15` }}>{factor.impact}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827', minWidth: '32px', textAlign: 'right' }}>{factor.pct}%</span>
                  </div>
                </div>
                <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${factor.pct}%`, background: factor.color, borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                </div>
              </div>
            ))}
          </div>
          <a href="#" style={{ display: 'block', textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>View All Factors & Details →</a>
        </div>

        {/* Right Column: Recommendations + Recent Records */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Recommendations */}
          <div className="info-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 14px 0' }}>Recommendations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Consult a Cardiologist for comprehensive evaluation', 'Regular blood pressure monitoring (daily)', 'Cholesterol management through diet and medication', 'Quit smoking immediately', 'Maintain healthy diet and 150min/week exercise'].map((rec, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#374151' }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#059669', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#92400e', fontWeight: 600, marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ This is a screening support tool, not a diagnosis.
            </div>
          </div>

          {/* Recent Prediction Records */}
          <div className="info-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Recent Prediction Records</h3>
              <a href="#" style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>View All</a>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, padding: '8px 6px', borderBottom: '2px solid #e5e7eb' }}>Date</th>
                  <th style={{ textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, padding: '8px 6px', borderBottom: '2px solid #e5e7eb' }}>Risk Level</th>
                  <th style={{ textAlign: 'left', fontSize: '11px', color: '#6b7280', fontWeight: 700, padding: '8px 6px', borderBottom: '2px solid #e5e7eb' }}>Risk Score</th>
                  <th style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280', fontWeight: 700, padding: '8px 6px', borderBottom: '2px solid #e5e7eb' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: '24 May 2025, 10:30 AM', level: 'High', score: 82, color: '#dc2626' },
                  { date: '20 May 2025, 09:15 AM', level: 'High', score: 75, color: '#dc2626' },
                  { date: '16 May 2025, 11:20 AM', level: 'Medium', score: 65, color: '#d97706' },
                  { date: '12 May 2025, 10:00 AM', level: 'Medium', score: 68, color: '#d97706' },
                ].map((record, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: '11px', color: '#374151', padding: '8px 6px', borderBottom: '1px solid #f3f4f6' }}>{record.date}</td>
                    <td style={{ padding: '8px 6px', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: record.color, background: `${record.color}15`, padding: '3px 10px', borderRadius: '4px' }}>{record.level}</span>
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 700, color: '#111827', padding: '8px 6px', borderBottom: '1px solid #f3f4f6' }}>{record.score}%</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #f3f4f6' }}>
                      <button style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px' }}>👁️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ background: '#eff8ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>ℹ️</span>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', display: 'block' }}>Disclaimer: This prediction is based on AI model analysis and should not replace professional medical diagnosis.</span>
          <span style={{ fontSize: '10px', color: '#3b82f6' }}>Predictions generated by this dashboard are not medical diagnoses and should not replace professional clinical judgment.</span>
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeMenu, setActiveMenu] = useState<'Overview' | 'EDA' | 'Model Performance' | 'Analytics' | 'Patient History' | 'Predictor' | 'Settings'>('Overview');
  const [datasetPage, setDatasetPage] = useState(1);
  const [datasetLimit, setDatasetLimit] = useState(10);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [theme]);
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
    { id: 'Overview', label: 'Overview', icon: <Grid className="sidebar-menu-icon" /> },
    { id: 'EDA', label: 'Datasets', icon: <Activity className="sidebar-menu-icon" /> },
    { id: 'Model Performance', label: 'Model Performance', icon: <TrendingUp className="sidebar-menu-icon" /> },
    { id: 'Analytics', label: 'Analytics', icon: <BarChart2 className="sidebar-menu-icon" /> },
    { id: 'Patient History', label: 'Patient History', icon: <Clipboard className="sidebar-menu-icon" /> },
    { id: 'Predictor', label: 'Predictor', icon: <Target className="sidebar-menu-icon" /> },
  ] as const;

  return (
    <div className="app-container">
      {/* Sidebar Panel matching screenshot mockup */}
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
              className={`sidebar-menu-item ${activeMenu === item.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedPatientForReport(null);
                setActiveMenu(item.id);
              }}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
          
          <div className="sidebar-divider" style={{ marginTop: 'auto' }}></div>

          <div
            className={`sidebar-menu-item ${activeMenu === 'Settings' ? 'active' : ''}`}
            onClick={() => setActiveMenu('Settings')}
            style={{ marginBottom: '12px' }}
          >
            <Settings className="sidebar-menu-icon" />
            Settings
          </div>
        </nav>

      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {/* Topbar Row matching screenshot */}
        <header className="topbar">
          <div className="topbar-welcome">
            <span>👋</span> Welcome back, Dr. <span className="topbar-welcome-badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>Alex</span>
          </div>
          <div className="topbar-actions">
            <div 
              className="topbar-pill"
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Toggle Light / Dark theme"
            >
              {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />}
              {theme === 'light' ? 'Light' : 'Dark'}
              <ChevronDown size={12} />
            </div>
            <div className="topbar-pill">
              <Calendar size={13} />
              Jun 1 - Jul 31, 2026
              <ChevronDown size={12} />
            </div>
            <div className="topbar-pill" style={{ padding: '8px 10px', position: 'relative' }}>
              <Bell size={14} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', position: 'absolute', top: '6px', right: '6px' }}></span>
            </div>
            <img src={drAlex} alt="Avatar" className="topbar-avatar" />
          </div>
        </header>

        {activeMenu === 'Overview' ? (
          <OverviewView 
            onSelectPatient={handleViewPatientReport}
            onStartRiskAssessment={() => {
              // Open patient report or navigate to predictor flow
              if (recentAssessments.length > 0) {
                handleViewPatientReport(recentAssessments[0]);
              } else {
                setActiveMenu('Predictor');
              }
            }}
          />
        ) : activeMenu === 'EDA' ? (
          <ImportDatasetView />
        ) : activeMenu === 'Model Performance' ? (
          <ClinicalReportsView />
        ) : activeMenu === 'Analytics' ? (
          <AnalyticsView onNavigateToPatient={(patient) => { setSelectedPatientForReport(patient); setActiveMenu('Predictor'); }} />
        ) : activeMenu === 'Patient History' ? (
          <PatientHistoryView onSelectPatientReport={handleViewPatientReport} />
        ) : activeMenu === 'Predictor' && !selectedPatientForReport ? (
          <PredictorView
            initialPrediction={latestPrediction}
            onPrediction={setLatestPrediction}
          />
        ) : (activeMenu === 'Predictor' && selectedPatientForReport) || activeMenu === 'Patient Report' ? (
          <PatientReportView 
            patient={selectedPatientForReport ?? { row_id: 12, Age: 63, Sex: 'Male', ChestPainType: 'TA', RestingBP: 165, Cholesterol: 288, FastingBS: 1, RestingECG: 'ST', MaxHR: 150, ExerciseAngina: 'Yes', Oldpeak: 2.8, ST_Slope: 'Down', HeartDisease: 1, riskScore: 89, category: 'High Risk' }}
            prediction={patientReportPrediction ?? latestPrediction ?? {
              probability: 0.89,
              risk_score: 89,
              category: 'High Risk',
              color: '#b42318',
              model_used: 'XGBoost',
              secondary_model: { name: 'RandomForest', risk: 87, available: true },
              agreement_text: 'High model consensus (89% vs 87%)',
              agreement_score: 0.98,
              top_risk: [{ factor: 'ST Depression (Oldpeak)', contribution: 0.28 }, { factor: 'Cholesterol Level', contribution: 0.22 }],
              top_protective: [{ factor: 'Max Heart Rate', contribution: -0.12 }],
              contributions: [],
              selected_model: 'XGBoost',
              confidence: 'High',
              clinical_summary: { summary: 'Patient demonstrates elevated ischemic risk based on ST depression and high cholesterol.', top_factors: ['ST Depression', 'Cholesterol'] },
              prediction_vs_average: [],
              validation_notes: []
            }}
            onClearReport={() => {
              setSelectedPatientForReport(null);
              setActiveMenu('EDA');
            }}
            onRunNewPrediction={() => {
              setActiveMenu('Predictor');
            }}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />
        ) : activeMenu === 'Settings' ? (
          <ClinicalReportsView />
        ) : null}
      </main>
    </div>
  );
}
