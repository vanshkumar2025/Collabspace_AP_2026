import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function SimpleBackground() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div
      className="simple-collab-bg"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        background: isLight
          ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)'
          : 'linear-gradient(168deg, #06081a 0%, #0a0e2a 35%, #110e30 70%, #08071e 100%)',
      }}
    >
      {/* Ambient glow orbs spanning full screen width */}
      <div
        style={{
          position: 'absolute',
          top: '2%',
          left: '0%',
          width: '650px',
          height: '650px',
          borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle, rgba(147, 51, 234, 0.08) 0%, rgba(147, 51, 234, 0) 70%)'
            : 'radial-gradient(circle, rgba(147, 51, 234, 0.22) 0%, rgba(147, 51, 234, 0) 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '4%',
          right: '0%',
          width: '650px',
          height: '650px',
          borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.07) 0%, rgba(99, 102, 241, 0) 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, rgba(99, 102, 241, 0) 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '25%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0) 70%)'
            : 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0) 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: '2%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0) 70%)'
            : 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0) 70%)',
          filter: 'blur(50px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '60%',
          right: '3%',
          width: '550px',
          height: '550px',
          borderRadius: '50%',
          background: isLight
            ? 'radial-gradient(circle, rgba(147, 51, 234, 0.06) 0%, rgba(147, 51, 234, 0) 70%)'
            : 'radial-gradient(circle, rgba(147, 51, 234, 0.14) 0%, rgba(147, 51, 234, 0) 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Subtle geometric dot pattern across full width */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: isLight ? 0.35 : 0.55,
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.3) 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 60%, rgba(0,0,0,0.3) 100%)',
        }}
      >
        <defs>
          <pattern id="collab-grid" width="38" height="38" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill={isLight ? '#7c3aed' : '#a855f7'} opacity="0.65" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#collab-grid)" />
      </svg>
    </div>
  );
}
