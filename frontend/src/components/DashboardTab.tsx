import React from 'react';
import { Parcel } from '@/lib/types';

interface DashboardTabProps {
  parcels: Parcel[];
}

export default function DashboardTab({ parcels }: DashboardTabProps) {
  const renderStateBadge = (state: number, isReleased: boolean, targetNDVI: number, currentNDVI: number) => {
    if (isReleased || state === 2) return <span className="parcel-badge badge-verified">Verified</span>;
    if (currentNDVI > 100) return <span className="parcel-badge badge-growing">Growing</span>;
    if (currentNDVI > 0) return <span className="parcel-badge badge-planted">Planted</span>;
    if (targetNDVI > 0) return <span className="parcel-badge badge-funded">Funded</span>;
    return <span className="parcel-badge badge-registered">Registered</span>;
  };

  return (
    <div className="animate-in">
      <div className="page-title-box">
        <h2 className="page-title">Parcels Overview</h2>
      </div>

      <div className="parcels-grid">
        {parcels.length === 0 ? (
          <div className="card" style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', minHeight: '9.375rem', alignItems: 'center'}}>
            <p style={{color: 'var(--muted)'}}>No parcels registered yet.</p>
          </div>
        ) : parcels.map(p => (
          <div className="card parcel-card" key={p.id}>
            <div className="parcel-header">
              <div className="parcel-header-left">
                <span className="parcel-id">
                  {p.metadata?.name || `Parcel #${p.id}`}
                </span>
                <span className="parcel-id-sub">#{p.id}</span>
              </div>
              {renderStateBadge(p.state, Boolean(p.isReleased), p.targetNDVI, p.currentNDVI)}
            </div>

            {/* Metadata row */}
            {p.metadata && (
              <div className="parcel-meta-row">
                {p.metadata.location && (
                  <span className="meta-chip" title={p.metadata.location}>
                    📍 {p.metadata.location.length > 30 ? p.metadata.location.slice(0, 30) + '…' : p.metadata.location}
                  </span>
                )}
                {p.metadata.area > 0 && (
                  <span className="meta-chip">
                    📐 {p.metadata.area.toLocaleString()} m²
                  </span>
                )}
              </div>
            )}

            <div className="parcel-details">
              <div className="detail-row">
                <span className="detail-label">Escrowed:</span>
                <span className="detail-val">${p.escrowAmount}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Target NDVI:</span>
                <span className="detail-val">{p.targetNDVI === 0 ? "Not Funded" : p.targetNDVI}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Current NDVI:</span>
                <span className="detail-val">{p.currentNDVI}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
