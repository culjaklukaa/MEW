import React from 'react';
import { Role } from '@/lib/types';

interface WelcomePageProps {
  onEnter: (role: Role) => void;
}

export default function WelcomePage({ onEnter }: WelcomePageProps) {
  return (
    <div className="animate-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* HEADER */}
      <header className="top-header" style={{ borderBottom: 'none', backgroundColor: 'transparent' }}>
        <div className="brand-area">
          <div className="brand-icon">🌿</div>
          <h1 className="brand-title">MostarEcoView</h1>
        </div>
      </header>

      {/* HERO SECTION */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(2rem, 5vw, 4rem) clamp(1rem, 5vw, 2rem)', maxWidth: '75rem', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 800, color: 'var(--foreground)', marginBottom: '1.5rem', lineHeight: 1.1, fontFamily: "'Outfit', sans-serif" }}>
          Decentralized Reforestation,<br />
          <span style={{ color: 'var(--accent-primary)' }}>Verified by Satellite</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--muted)', maxWidth: '43.75rem', margin: '0 auto 3rem auto', lineHeight: 1.6 }}>
          A next-generation platform utilizing Forest NFTs, NDVI Oracle data, and secure smart contract escrows to fund, verify, and reward physical reforestation efforts on-chain.
        </p>

        {/* ROLE SELECTION CTA */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '5rem' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}
            onClick={() => onEnter('worker')}
          >
            👷 Enter as Worker
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '1rem 2.5rem', fontSize: '1.1rem' }}
            onClick={() => onEnter('sponsor')}
          >
            💎 Enter as Sponsor
          </button>
        </div>

        {/* FEATURE GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(15.625rem, 1fr))', gap: '2rem', width: '100%', textAlign: 'left' }}>

          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌱</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.75rem', fontFamily: "'Outfit', sans-serif" }}>
              Dynamic Forest NFTs
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Represent physical land parcels completely on-chain. NFTs dynamically evolve based on real-world verification (Planted → Growing → Verified).
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💰</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.75rem', fontFamily: "'Outfit', sans-serif" }}>
              Sponsor Funding
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Corporates and sponsors fund impact projects using USDC locked in secure, trustless escrow smart contracts.
            </p>
          </div>

          <div className="card">
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📡</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.75rem', fontFamily: "'Outfit', sans-serif" }}>
              Satellite NDVI Oracles
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Real-time vegetation index data triggers automated reward payouts directly to workers when growth targets are met.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
