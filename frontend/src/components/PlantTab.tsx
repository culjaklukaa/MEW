"use client";

import React, { useState } from 'react';
import { Role, ParcelMetadata } from '@/lib/types';

interface PlantTabProps {
  activeRole: Role;
  loading: boolean;
  onPlant: (metadata: ParcelMetadata) => void;
}

export default function PlantTab({ activeRole, loading, onPlant }: PlantTabProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [area, setArea] = useState("");
  const [useCoords, setUseCoords] = useState(false);
  const [lat, setLat] = useState("43.3438");
  const [lng, setLng] = useState("17.8078");

  const isWorker = activeRole === 'worker';
  const isValid = name.trim() !== "" && (useCoords ? lat && lng : location.trim() !== "") && area !== "" && Number(area) > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !isWorker) return;

    const resolvedLocation = useCoords ? `${lat}, ${lng}` : location;

    onPlant({
      name: name.trim(),
      location: resolvedLocation,
      area: Number(area),
    });

    // Reset form
    setName("");
    setLocation("");
    setArea("");
    setLat("43.3438");
    setLng("17.8078");
  };

  return (
    <div className="animate-in">
      <div className="page-title-box">
        <h2 className="page-title">Register Area</h2>
      </div>

      <div className="card plant-form-card">
        <p className="plant-description">
          Register a new reforestation parcel on the blockchain. Provide the parcel details below — once minted as a Forest NFT, sponsors can fund it and satellite monitoring begins.
        </p>

        <form onSubmit={handleSubmit} className="plant-form">
          {/* Parcel Name */}
          <div className="form-group">
            <label className="input-label">
              🌳 Parcel Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Neretva Valley Plot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isWorker}
            />
          </div>

          {/* Location */}
          <div className="form-group">
            <label className="input-label">
              📍 Location <span className="required">*</span>
            </label>

            <div className="location-toggle">
              <button
                type="button"
                className={`toggle-btn ${!useCoords ? 'active' : ''}`}
                onClick={() => setUseCoords(false)}
              >
                Description
              </button>
              <button
                type="button"
                className={`toggle-btn ${useCoords ? 'active' : ''}`}
                onClick={() => setUseCoords(true)}
              >
                Coordinates
              </button>
            </div>

            {!useCoords ? (
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Mostar, Bosnia — near Neretva river"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!isWorker}
              />
            ) : (
              <div className="coord-inputs">
                <div className="coord-field">
                  <label className="coord-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    placeholder="43.3438"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    disabled={!isWorker}
                  />
                </div>
                <div className="coord-field">
                  <label className="coord-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    className="input-field"
                    placeholder="17.8078"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    disabled={!isWorker}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Area */}
          <div className="form-group">
            <label className="input-label">
              📐 Area (m²) <span className="required">*</span>
            </label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 5000"
              min="1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              disabled={!isWorker}
            />
            {area && Number(area) > 0 && (
              <div className="area-conversion">
                ≈ {(Number(area) / 10000).toFixed(2)} hectares
              </div>
            )}
          </div>

          {/* Preview */}
          {isValid && (
            <div className="mint-preview">
              <h4 className="preview-title">Parcel Preview</h4>
              <div className="preview-grid">
                <div className="preview-item">
                  <span className="preview-label">Name</span>
                  <span className="preview-value">{name}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Location</span>
                  <span className="preview-value">{useCoords ? `${lat}, ${lng}` : location}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Area</span>
                  <span className="preview-value">{Number(area).toLocaleString()} m² ({(Number(area) / 10000).toFixed(2)} ha)</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isWorker || loading || !isValid}
          >
            {!isWorker
              ? '🔒 Switch to Worker Account'
              : loading
                ? '⏳ Registering...'
                : '🌱 Register New Area'}
          </button>
        </form>
      </div>
    </div>
  );
}
