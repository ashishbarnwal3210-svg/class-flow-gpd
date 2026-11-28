import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react';

interface AcademicTier {
  sem: number;
  badge: string;
  title: string;
  description: string;
  moduleCount: number;
  color: string;
}

const ACADEMIC_TIERS: AcademicTier[] = [
  { sem: 1, badge: 'SEM 01', title: 'Foundations & Sciences', description: 'Engineering Math, Applied Physics & Computational Logic', moduleCount: 24, color: '#10b981' },
  { sem: 2, badge: 'SEM 02', title: 'Core Programming', description: 'Data Structures, OOP Concepts & Digital Circuits', moduleCount: 28, color: '#06b6d4' },
  { sem: 3, badge: 'SEM 03', title: 'Advanced Systems', description: 'Algorithms, OS Architecture & Computer Networks', moduleCount: 32, color: '#3b82f6' },
  { sem: 4, badge: 'SEM 04', title: 'Data & Databases', description: 'DBMS, Web Engineering & Software Design', moduleCount: 36, color: '#8b5cf6' },
  { sem: 5, badge: 'SEM 05', title: 'Specializations & AI', description: 'Machine Learning, Cloud Systems & Cyber Security', moduleCount: 30, color: '#ec4899' },
  { sem: 6, badge: 'SEM 06', title: 'Capstone & Placements', description: 'Industrial Projects, Interview Prep & Solved PYQs', moduleCount: 26, color: '#f59e0b' },
];

export function AcademicPathway3D() {
  const [activeSem, setActiveSem] = useState<number>(3);
  const [metricCount, setMetricCount] = useState<number>(100);
  const navigate = useNavigate();

  useEffect(() => {
    const target = activeSem * 145 + 32;
    const interval = window.setInterval(() => {
      setMetricCount((prev) => {
        if (Math.abs(prev - target) <= 3) return target;
        return prev + (prev < target ? 3 : -3);
      });
    }, 18);
    return () => clearInterval(interval);
  }, [activeSem]);

  const activeTier = ACADEMIC_TIERS.find((t) => t.sem === activeSem) || ACADEMIC_TIERS[2];

  return (
    <div className="academic-pathway-card glass-panel">
      {/* Header with Academic Roadmaps Info */}
      <div className="pathway-head">
        <div className="pathway-title-wrap">
          <div className="pathway-badge-icon" style={{ background: `${activeTier.color}20`, color: activeTier.color }}>
            <GraduationCap size={18} />
          </div>
          <div>
            <span className="eyebrow" style={{ color: activeTier.color }}>CAMPUS CURRICULUM PATHWAY</span>
            <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 600 }}>Semester Learning Progression</h3>
          </div>
        </div>

        {/* Real-time Ticker */}
        <div className="pathway-metrics">
          <div className="pathway-metric-box">
            <span>VERIFIED TOPICS</span>
            <b style={{ color: activeTier.color }}>{metricCount}+</b>
          </div>
          <div className="pathway-metric-box">
            <span>ACTIVE PATH</span>
            <b>Semester {activeSem}</b>
          </div>
        </div>
      </div>

      {/* 3D Interactive Semester Slider Strip */}
      <div className="pathway-tiers-grid">
        {ACADEMIC_TIERS.map((tier) => {
          const isSelected = tier.sem === activeSem;
          return (
            <div
              key={tier.sem}
              className={`pathway-tier-tab ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveSem(tier.sem)}
              style={{
                borderColor: isSelected ? tier.color : undefined,
                boxShadow: isSelected ? `0 8px 24px ${tier.color}25` : undefined,
              }}
            >
              <div className="tier-top">
                <span className="tier-badge" style={{ background: `${tier.color}20`, color: tier.color }}>
                  {tier.badge}
                </span>
                <span className="tier-modules">{tier.moduleCount} Notes</span>
              </div>
              <h4 className="tier-title">{tier.title}</h4>
              <p className="tier-desc">{tier.description}</p>
            </div>
          );
        })}
      </div>

      {/* Selected Semester Action Bar */}
      <div className="pathway-footer">
        <div className="pathway-footer-info">
          <span className="eyebrow" style={{ color: 'var(--taupe)' }}>SELECTED SEMESTER</span>
          <h4>Semester {activeTier.sem}: {activeTier.title}</h4>
          <p>{activeTier.description}</p>
        </div>
        <button
          type="button"
          className="button button-primary compact pathway-explore-btn"
          onClick={() => navigate(`/library?search=${encodeURIComponent(`Semester ${activeTier.sem}`)}`)}
        >
          <BookOpen size={14} />
          <span>Explore Semester {activeTier.sem} Notes</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
