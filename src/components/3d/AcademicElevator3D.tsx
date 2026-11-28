import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Layers } from 'lucide-react';

interface AcademicLevel {
  level: number;
  label: string;
  semesterName: string;
  focus: string;
  unitsCount: number;
  color: string;
}

const ACADEMIC_LEVELS: AcademicLevel[] = [
  { level: 1, label: 'LEVEL 01', semesterName: 'Semester 1', focus: 'Foundations · Physics, Math & Basics', unitsCount: 24, color: '#10b981' },
  { level: 2, label: 'LEVEL 02', semesterName: 'Semester 2', focus: 'Core Disciplines · Programming & Electronics', unitsCount: 28, color: '#06b6d4' },
  { level: 3, label: 'LEVEL 03', semesterName: 'Semester 3', focus: 'Advanced Data Structures & Architecture', unitsCount: 32, color: '#3b82f6' },
  { level: 4, label: 'LEVEL 04', semesterName: 'Semester 4', focus: 'Algorithms, Database Systems & OS', unitsCount: 36, color: '#8b5cf6' },
  { level: 5, label: 'LEVEL 05', semesterName: 'Semester 5', focus: 'Networks, Web Engineering & Cloud', unitsCount: 30, color: '#ec4899' },
  { level: 6, label: 'LEVEL 06', semesterName: 'Semester 6', focus: 'Capstone Projects & Placements Prep', unitsCount: 22, color: '#f59e0b' },
];

export function AcademicElevator3D() {
  const [activeLevel, setActiveLevel] = useState<number>(3);
  const [displayCounter, setDisplayCounter] = useState<number>(100);
  const navigate = useNavigate();

  // Smooth counter animation
  useEffect(() => {
    const target = activeLevel * 142 + 28;
    const interval = window.setInterval(() => {
      setDisplayCounter((prev) => {
        if (Math.abs(prev - target) <= 3) return target;
        return prev + (prev < target ? 3 : -3);
      });
    }, 18);
    return () => clearInterval(interval);
  }, [activeLevel]);

  const current = ACADEMIC_LEVELS.find((l) => l.level === activeLevel) || ACADEMIC_LEVELS[2];

  return (
    <div className="academic-elevator-container glass-panel">
      {/* Top Elevator Header with digital readout */}
      <div className="elevator-top-readout">
        <div className="elevator-cab-status">
          <div className="pulse-beacon" style={{ background: current.color }} />
          <div>
            <span className="eyebrow" style={{ fontSize: '9px', letterSpacing: '1.2px' }}>
              ACADEMIC LEVEL ELEVATOR
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <b style={{ fontSize: '18px', fontFamily: 'monospace', letterSpacing: '-0.5px' }}>
                FLOOR {activeLevel < 10 ? `0${activeLevel}` : activeLevel}
              </b>
              <span className="route-chip" style={{ fontSize: '10px' }}>
                {activeLevel >= 5 ? 'Senior Wing' : activeLevel >= 3 ? 'Intermediate Wing' : 'Junior Wing'}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time knowledge ticker */}
        <div className="elevator-metrics">
          <div className="elevator-metric-item">
            <span>INDEXED TOPICS</span>
            <b>{displayCounter}</b>
          </div>
          <div className="elevator-metric-item">
            <span>CAB POSITION</span>
            <b>{Math.round((activeLevel / 6) * 100)}%</b>
          </div>
        </div>
      </div>

      {/* 3D Vertical Elevator Shaft & Floor Strips */}
      <div className="elevator-shaft">
        {/* Elevator Cab Indicator (Track line + Glow) */}
        <div
          className="elevator-cab-indicator"
          style={{
            top: `${((6 - activeLevel) / 5) * 82}%`,
            borderColor: current.color,
            boxShadow: `0 0 20px ${current.color}40`,
          }}
        >
          <div className="cab-icon">
            <Layers size={13} style={{ color: current.color }} />
          </div>
        </div>

        {/* 6 Floor Strips (from 6 down to 1 like real floors) */}
        <div className="elevator-floors-list">
          {[...ACADEMIC_LEVELS].reverse().map((lvl) => {
            const isSelected = lvl.level === activeLevel;
            return (
              <div
                key={lvl.level}
                className={`elevator-floor-strip ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveLevel(lvl.level)}
                style={{
                  borderLeftColor: isSelected ? lvl.color : 'transparent',
                }}
              >
                <div className="floor-number-box">
                  <span className="floor-num">{lvl.label}</span>
                  <small>{lvl.semesterName}</small>
                </div>

                <div className="floor-details">
                  <b>{lvl.focus}</b>
                  <div className="floor-sub">
                    <span>{lvl.unitsCount} verified module notes</span>
                    {isSelected && <span className="floor-live-tag">Floor Selected</span>}
                  </div>
                </div>

                <div className="floor-action">
                  <span className="floor-arrow">
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floor Entry Action Card */}
      <div className="elevator-footer-card">
        <div>
          <span style={{ fontSize: '11px', color: 'var(--taupe)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Ready to explore
          </span>
          <h4 style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600 }}>
            {current.semesterName}: {current.focus}
          </h4>
        </div>
        <button
          type="button"
          className="button button-primary compact"
          onClick={() => navigate(`/library?search=${encodeURIComponent(current.semesterName)}`)}
          style={{ gap: '6px' }}
        >
          <BookOpen size={13} />
          <span>Step Inside {current.semesterName}</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
