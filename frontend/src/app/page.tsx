"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getContracts, roles } from "@/lib/ethers";
import ContractData from "@/contracts/MEWContracts.json";
import { Role, Tab, LogEntry, Parcel, ParcelMetadata } from "@/lib/types";

// Import Modular Components
import DashboardTab from "@/components/DashboardTab";
import PlantTab from "@/components/PlantTab";
import FundTab from "@/components/FundTab";
import SatelliteTab from "@/components/SatelliteTab";
import LogsPanel from "@/components/LogsPanel";
import WelcomePage from "@/components/WelcomePage";

export default function Home() {
  const [appStarted, setAppStarted] = useState<boolean>(false);

  const [activeRole, setActiveRole] = useState<Role>("worker");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [parcels, setParcels] = useState<Parcel[]>([]);

  // Dashboard Aggregates
  const [totalDonated, setTotalDonated] = useState("0");
  const [totalPlanted, setTotalPlanted] = useState(0);
  const [avgNDVI, setAvgNDVI] = useState(0);

  // Simulation State
  const [simActiveForId, setSimActiveForId] = useState<number | null>(null);
  const [simMonthsPassed, setSimMonthsPassed] = useState<Record<number, number>>({});

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, msg }, ...prev]);
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return "Unknown error";
  };

  const getParcelLabel = useCallback((id: number | null) => {
    if (id === null) return "selected parcel";

    const parcel = parcels.find((item) => item.id === id);
    return parcel?.metadata?.name ? parcel.metadata.name : `Parcel #${id}`;
  }, [parcels]);

  const loadParcels = useCallback(async () => {
    if (!appStarted) return; // Don't load if app hasn't started yet

    try {
      const { forestNFT, escrow, mockOracle } = await getContracts(roles.worker);

      let id = 0;
      const loadedParcels: Parcel[] = [];
      let totalEscrowAmount = 0;
      let totalNdvi = 0;

      while (true) {
        try {
          const owner = await forestNFT.ownerOf(id);
          const state = await forestNFT.forestStates(id);
          const escrowData = await escrow.escrows(id);
          const currentNDVI = await mockOracle.getNDVIScore(id);

          const amt = parseFloat(ethers.formatUnits(escrowData.totalAmount, 18));
          totalEscrowAmount += amt;
          totalNdvi += Number(currentNDVI);

          // Fetch on-chain parcel details
          let metadata: ParcelMetadata | undefined;
          try {
            const details = await forestNFT.parcelDetails(id);
            metadata = {
              name: details.name,
              location: details.location,
              area: Number(details.area),
            };
          } catch {
            // Contract may not have parcelDetails for older tokens
          }

          loadedParcels.push({
            id,
            state: Number(state),
            escrowAmount: amt.toLocaleString(),
            targetNDVI: Number(escrowData.targetNDVIScore),
            currentNDVI: Number(currentNDVI),
            currentPhase: Number(escrowData.currentPhase),
            owner,
            metadata,
          });
          id++;
        } catch {
          // Reverts when token doesn't exist
          break;
        }
      }

      setParcels(loadedParcels);
      setTotalPlanted(loadedParcels.length);
      setTotalDonated(totalEscrowAmount.toLocaleString());
      setAvgNDVI(loadedParcels.length > 0 ? Math.round(totalNdvi / loadedParcels.length) : 0);

    } catch (error: unknown) {
      console.error("Error loading parcels", error);
    }
  }, [appStarted]);

  useEffect(() => {
    if (!appStarted) return;

    const refreshParcels = () => {
      void loadParcels();
    };

    refreshParcels();
    const int = setInterval(refreshParcels, 5000);
    return () => clearInterval(int);
  }, [appStarted, loadParcels]);

  // Simulation Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (simActiveForId !== null) {
      let localMonthsPassed = simMonthsPassed[simActiveForId] || 0; // Track purely in closure
      
      timer = setInterval(async () => {
        try {
          const { escrow } = await getContracts(roles.worker);
          const { mockOracle: adminOracle } = await getContracts(roles.deployer);
          
          const currentNDVI = await adminOracle.getNDVIScore(simActiveForId);
          const currentNDVINum = Number(currentNDVI);
          
          const escrowData = await escrow.escrows(simActiveForId);
          const targetNDVI = Number(escrowData.targetNDVIScore);
          const currentPhase = Number(escrowData.currentPhase);

          if (currentPhase === 3) {
            setSimActiveForId(null);
            addLog(`🏁 ${getParcelLabel(simActiveForId)} has already completed all fund releases.`);
            return;
          }

          // Increase NDVI
          const increment = Math.floor(Math.random() * 50) + 50;
          const newScore = Math.min(currentNDVINum + increment, 1000);
          
          const tx = await adminOracle.updateNDVIScore(simActiveForId, newScore);
          await tx.wait();
          
          const parcelLabel = getParcelLabel(simActiveForId);
          localMonthsPassed += 6;
          setSimMonthsPassed(prev => ({ ...prev, [simActiveForId]: localMonthsPassed }));
          addLog(`📡 ${parcelLabel}: Month ${localMonthsPassed}. NDVI updated to ${newScore}`);

          // Refresh escrow phase before attempting a release so we don't trip over already-completed parcels.
          const latestEscrowData = await escrow.escrows(simActiveForId);
          const latestPhase = Number(latestEscrowData.currentPhase);

          if (latestPhase === 3) {
            setSimActiveForId(null);
            addLog(`🏁 ${parcelLabel} has already completed all fund releases.`);
            return;
          }

          // Check Milestones
          if (latestPhase === 1 && newScore >= targetNDVI / 2) {
            addLog(`✅ ${parcelLabel}: 50% target reached! Releasing phase 2...`);
            try {
              const releaseTx = await escrow.checkMilestones(simActiveForId);
              await releaseTx.wait();
              addLog(`💸 ${parcelLabel}: Phase 2 Funds Released to Worker!`);
            } catch (error: unknown) {
              const message = getErrorMessage(error);
              if (message.includes("All funds already released")) {
                addLog(`ℹ️ ${parcelLabel} has already completed its release.`);
                setSimActiveForId(null);
                return;
              }
              addLog(`❌ Release Error: ${message}`);
              return;
            }
          } else if (latestPhase === 2 && newScore >= targetNDVI) {
            addLog(`✅ ${parcelLabel}: 100% target reached! Releasing final phase...`);
            try {
              const releaseTx = await escrow.checkMilestones(simActiveForId);
              await releaseTx.wait();
              addLog(`💸 ${parcelLabel}: Final Phase Funds Released to Worker!`);
              setSimActiveForId(null); // Stop simulation
            } catch (error: unknown) {
              const message = getErrorMessage(error);
              if (message.includes("All funds already released")) {
                addLog(`ℹ️ ${parcelLabel} has already completed its release.`);
                setSimActiveForId(null);
                return;
              }
              addLog(`❌ Release Error: ${message}`);
              return;
            }
          }

          loadParcels();
        } catch (error: unknown) {
          addLog(`❌ Sim Error: ${getErrorMessage(error)}`);
        }
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [simActiveForId, loadParcels, getParcelLabel, simMonthsPassed]);

  // === ACTIONS ===
  const handlePlant = async (metadata: ParcelMetadata) => {
    setLoading(true);
    try {
      addLog(`🌱 Registering new area "${metadata.name}"...`);
      const { forestNFT } = await getContracts(roles.worker);
      const tx = await forestNFT.mintForest(
        roles.worker,
        "ipfs://new-parcel",
        metadata.name,
        metadata.location,
        metadata.area
      );
      await tx.wait();
      addLog(`✅ Area "${metadata.name}" registered successfully! (${metadata.area.toLocaleString()} m² at ${metadata.location})`);
      await loadParcels();
    } catch (error: unknown) {
      addLog(`❌ Registration failed: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const id = Number(fd.get("parcelId"));
    const amt = fd.get("amount") as string;
    const target = Number(fd.get("targetNDVI"));

    setLoading(true);
    try {
      addLog(`💰 Sponsoring ${getParcelLabel(id)} with ${amt} USDC...`);
      const { mockUSDC, escrow } = await getContracts(roles.sponsor);

      const parsedAmt = ethers.parseUnits(amt, 18);

      const appTx = await mockUSDC.approve(ContractData.MEWEscrow.address, parsedAmt);
      await appTx.wait();

      const tx = await escrow.depositFunds(id, roles.worker, parsedAmt, target);
      await tx.wait();

      addLog(`✅ Funded ${getParcelLabel(id)} successfully!`);
      await loadParcels();
      form.reset();
    } catch (error: unknown) {
      addLog(`❌ Fund failed: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // If user hasn't started the app, show the Welcome Landing Page
  if (!appStarted) {
    return (
      <WelcomePage
        onEnter={(role) => {
          setActiveRole(role);
          setAppStarted(true);
        }}
      />
    );
  }

  // Otherwise, render the main dashboard app shell
  return (
    <>
      <div className="sticky-header-group">
        <header className="top-header">
          <div
            className="brand-area animate-in"
          onClick={() => setAppStarted(false)}
          style={{ cursor: 'pointer' }}
          title="Return to Welcome Page"
        >
          <div className="brand-icon">🌿</div>
          <h1 className="brand-title">EcoView</h1>
        </div>

        <nav className="nav-menu animate-in" style={{ animationDelay: '0.1s' }}>
          <button className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-btn ${activeTab === 'plant' ? 'active' : ''}`} onClick={() => setActiveTab('plant')}>
            Plant
          </button>
          <button className={`nav-btn ${activeTab === 'fund' ? 'active' : ''}`} onClick={() => setActiveTab('fund')}>
            Fund
          </button>
          <button className={`nav-btn ${activeTab === 'satellite' ? 'active' : ''}`} onClick={() => setActiveTab('satellite')}>
            Satellite
          </button>
        </nav>
      </header>

      {/* STATS STRIP */}
      <div className="stats-strip animate-in" style={{ animationDelay: '0.2s' }}>
        <div className="stat-box">
          <div className="stat-inner">
            <div className="stat-label">Total Donated (USDC)</div>
            <div className="stat-value">${totalDonated}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-inner">
            <div className="stat-label">Total Parcels</div>
            <div className="stat-value">{totalPlanted}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-inner">
            <div className="stat-label">Avg Network NDVI</div>
            <div className="stat-value">{avgNDVI}</div>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-inner" style={{ justifyContent: 'center', gap: '0.75rem' }}>
            <div className="stat-label" style={{ textAlign: 'center' }}>Active Role</div>
            <div className="role-selector">
              <button
                className={`role-pill ${activeRole === 'worker' ? 'active' : ''}`}
                onClick={() => setActiveRole('worker')}
              >
                👷 Worker
              </button>
              <button
                className={`role-pill ${activeRole === 'sponsor' ? 'active' : ''}`}
                onClick={() => setActiveRole('sponsor')}
              >
                💎 Sponsor
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <main className="main-layout animate-in" style={{ animationDelay: '0.3s' }}>

        {/* LEFT CONTENT AREA */}
        <div className="content-area">
          {activeTab === 'dashboard' && <DashboardTab parcels={parcels} />}

          {activeTab === 'plant' && (
            <PlantTab
              activeRole={activeRole}
              loading={loading}
              onPlant={handlePlant}
            />
          )}

          {activeTab === 'fund' && (
            <FundTab
              parcels={parcels}
              activeRole={activeRole}
              loading={loading}
              onFund={handleFund}
            />
          )}

          {activeTab === 'satellite' && (
            <SatelliteTab
              parcels={parcels}
              simActiveForId={simActiveForId}
              simMonthsPassed={simActiveForId !== null ? (simMonthsPassed[simActiveForId] || 0) : 0}
              onStartSim={(id) => { setSimActiveForId(id); }}
              onStopSim={() => { setSimActiveForId(null); }}
            />
          )}
        </div>

        {/* RIGHT AREA: ACTIVITY LOG */}
        <LogsPanel logs={logs} />
      </main>
    </>
  );
}
