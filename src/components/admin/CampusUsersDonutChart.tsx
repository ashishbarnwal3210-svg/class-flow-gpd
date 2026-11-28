import { useMemo } from 'react';
import { Users, ShieldCheck, GraduationCap, UserCheck } from 'lucide-react';

interface CampusUsersDonutChartProps {
  people: Array<{ id: string; full_name: string; username: string; classflow_id: string; role?: string; created_at?: string }>;
  onSelectRoleFilter?: (role: string) => void;
}

export function CampusUsersDonutChart({ people = [], onSelectRoleFilter }: CampusUsersDonutChartProps) {
  const stats = useMemo(() => {
    const total = people.length || 1;
    const students = people.filter((p) => !p.role || p.role === 'student').length;
    const subadmins = people.filter((p) => p.role === 'subadmin').length;
    const admins = people.filter((p) => p.role === 'admin').length;

    const studentPct = Math.round((students / total) * 100);
    const subadminPct = Math.round((subadmins / total) * 100);
    const adminPct = 100 - studentPct - subadminPct;

    return { total: people.length, students, subadmins, admins, studentPct, subadminPct, adminPct };
  }, [people]);

  // SVG circular arc calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius; // ~427.25

  // Arc offsets
  const studentsLength = (stats.studentPct / 100) * circumference;
  const subadminsLength = (stats.subadminPct / 100) * circumference;
  const adminsLength = (stats.adminPct / 100) * circumference;

  const strokeWidth = 14;

  return (
    <div className="campus-analytics-card glass-panel">
      <div className="analytics-head">
        <div>
          <span className="eyebrow" style={{ color: 'var(--sage-deep, #10b981)' }}>CAMPUS COMMUNITY ANALYTICS</span>
          <h3 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 600 }}>Total Members Joined</h3>
        </div>
        <span className="route-chip" style={{ fontSize: '10px' }}>
          <UserCheck size={12} /> Live Directory
        </span>
      </div>

      <div className="analytics-body">
        {/* SVG Circular Donut Graph */}
        <div className="donut-chart-wrapper">
          <svg className="donut-svg" width="180" height="180" viewBox="0 0 180 180">
            {/* Background Track */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="var(--line, rgba(0,0,0,0.08))"
              strokeWidth={strokeWidth}
            />

            {/* Students Arc (Emerald) */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#10b981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${studentsLength} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />

            {/* Subadmins Arc (Sky Blue) */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#0284c7"
              strokeWidth={strokeWidth}
              strokeDasharray={`${subadminsLength} ${circumference}`}
              strokeDashoffset={-studentsLength}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />

            {/* Admins Arc (Amber / Violet) */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="transparent"
              stroke="#f59e0b"
              strokeWidth={strokeWidth}
              strokeDasharray={`${adminsLength} ${circumference}`}
              strokeDashoffset={-(studentsLength + subadminsLength)}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>

          {/* Central Donut Readout */}
          <div className="donut-center-label">
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.7 }}>JOINED</span>
            <b style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1.1 }}>{stats.total}</b>
            <small style={{ fontSize: '10px', opacity: 0.8 }}>Students & Staff</small>
          </div>
        </div>

        {/* Legend Breakdown */}
        <div className="donut-legend-col">
          <div
            className="legend-row clickable"
            onClick={() => onSelectRoleFilter?.('student')}
            title="Filter by Students"
          >
            <span className="legend-indicator" style={{ background: '#10b981' }} />
            <div className="legend-copy">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap size={14} style={{ color: '#10b981' }} />
                <b>Students</b>
              </div>
              <small>{stats.students} active learners</small>
            </div>
            <span className="legend-pct">{stats.studentPct}%</span>
          </div>

          <div
            className="legend-row clickable"
            onClick={() => onSelectRoleFilter?.('subadmin')}
            title="Filter by Subadmins"
          >
            <span className="legend-indicator" style={{ background: '#0284c7' }} />
            <div className="legend-copy">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} style={{ color: '#0284c7' }} />
                <b>Subadmins (Moderators)</b>
              </div>
              <small>{stats.subadmins} appointed staff</small>
            </div>
            <span className="legend-pct">{stats.subadminPct}%</span>
          </div>

          <div
            className="legend-row clickable"
            onClick={() => onSelectRoleFilter?.('admin')}
            title="Filter by Admins"
          >
            <span className="legend-indicator" style={{ background: '#f59e0b' }} />
            <div className="legend-copy">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} style={{ color: '#f59e0b' }} />
                <b>Campus Admins</b>
              </div>
              <small>{stats.admins} full privilege</small>
            </div>
            <span className="legend-pct">{stats.adminPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
