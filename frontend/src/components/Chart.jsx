import React from 'react';

export default function Chart({ breakdown }) {
  const categories = [
    { name: 'Transport', value: breakdown.transport || 0, color: '#10b981', icon: '🚗' },
    { name: 'Energy', value: breakdown.energy || 0, color: '#3b82f6', icon: '⚡' },
    { name: 'Diet', value: breakdown.diet || 0, color: '#f59e0b', icon: '🥗' },
    { name: 'Shopping', value: breakdown.shopping || 0, color: '#f43f5e', icon: '🛍️' }
  ];

  const total = categories.reduce((sum, cat) => sum + cat.value, 0);

  // SVG calculations for Donut
  const radius = 50;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius; // ~314.16
  const center = 70;

  let accumulatedPercentage = 0;

  return (
    <div className="chart-container-div" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%' }}>
      {total > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '2rem', width: '100%' }}>
          {/* Donut Circle */}
          <div style={{ position: 'relative', width: '140px', height: '140px' }}>
            <svg width="140" height="140" viewBox="0 0 140 140" className="svg-chart">
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="var(--bg-tertiary)"
                strokeWidth={strokeWidth}
              />
              {categories.map((cat, idx) => {
                const percentage = total > 0 ? cat.value / total : 0;
                if (percentage === 0) return null;

                const strokeLength = percentage * circumference;
                const strokeOffset = circumference - strokeLength + (accumulatedPercentage * circumference);
                accumulatedPercentage -= percentage;

                return (
                  <circle
                    key={cat.name}
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{
                      transition: 'stroke-dashoffset 0.6s ease',
                      strokeLinecap: 'round'
                    }}
                  />
                );
              })}
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {total.toFixed(1)}t
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', marginTop: '-2px' }}>
                CO₂/yr
              </div>
            </div>
          </div>

          {/* Legends */}
          <div className="category-list" style={{ flex: 1, minWidth: '180px' }}>
            {categories.map(cat => {
              const pct = total > 0 ? Math.round((cat.value / total) * 100) : 0;
              return (
                <div key={cat.name} className="category-row">
                  <div className="icon-box" style={{ background: cat.color + '18', color: cat.color }}>
                    <span>{cat.icon}</span>
                  </div>
                  <div className="cat-details">
                    <div className="cat-header">
                      <span className="cat-name" style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{cat.name}</span>
                      <span className="cat-val" style={{ color: 'var(--text-secondary)' }}>
                        {cat.value.toFixed(1)}t ({pct}%)
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🌱</div>
          <p>Please enter details in the Track tab to generate your dashboard insights.</p>
        </div>
      )}
    </div>
  );
}
