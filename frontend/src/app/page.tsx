"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getContracts, roles } from "@/lib/ethers";
import ContractData from "@/contracts/MEWContracts.json";
import { Role, Tab, LogEntry, Parcel } from "@/lib/types";

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
  const [simMonthsPassed, setSimMonthsPassed] = useState(0);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, msg }, ...prev]);
  };

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

          const amt = parseFloat(ethers.formatUnits(escrowData.amount, 18));
          totalEscrowAmount += amt;
          totalNdvi += Number(currentNDVI);

          loadedParcels.push({
            id,
            state: Number(state),
            escrowAmount: amt.toLocaleString(),
            targetNDVI: Number(escrowData.targetNDVIScore),
            currentNDVI: Number(currentNDVI),
            isReleased: escrowData.isReleased,
            owner
          });
          id++;
        } catch (e) {
          // Reverts when token doesn't exist
          break;
        }
      }

      setParcels(loadedParcels);
      setTotalPlanted(loadedParcels.length);
      setTotalDonated(totalEscrowAmount.toLocaleString());
      setAvgNDVI(loadedParcels.length > 0 ? Math.round(totalNdvi / loadedParcels.length) : 0);

    } catch (err) {
      console.error("Error loading parcels", err);
    }
  }, [appStarted]);

  useEffect(() => {
    if (appStarted) {
      loadParcels();
      const int = setInterval(loadParcels, 5000);
      return () => clearInterval(int);
    }
  }, [appStarted, loadParcels]);

  // Simulation Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (simActiveForId !== null) {
      timer = setInterval(async () => {
        setSimMonthsPassed(m => m + 6);
        
        try {
          const parcel = parcels.find(p => p.id === simActiveForId);
          if (!parcel) return;

          const { mockOracle, escrow } = await getContracts(roles.worker);
          
          // Increase NDVI
          const increment = Math.floor(Math.random() * 50) + 50; // +50 to +100 per 6mo
          const newScore = Math.min(parcel.currentNDVI + increment, 1000);
          
          const tx = await mockOracle.updateNDVIScore(simActiveForId, newScore);
          await tx.wait();
          addLog(`📡 Parcel #${simActiveForId}: Time Passed 6mo. NDVI updated to ${newScore}`);

          // Check Release
          if (newScore >= parcel.targetNDVI && !parcel.isReleased) {
            addLog(`✅ Parcel #${simActiveForId}: Target reached! Attempting release...`);
            const releaseTx = await escrow.checkAndRelease(simActiveForId);
            await releaseTx.wait();
            addLog(`💸 Parcel #${simActiveForId}: Funds Released to Worker!`);
            setSimActiveForId(null); // Stop simulation
          }

          loadParcels();
        } catch(e: any) {
          addLog(`❌ Sim Error: ${e.message}`);
        }
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [simActiveForId, parcels, loadParcels]);

  // === ACTIONS ===
  const handlePlant = async () => {
    setLoading(true);
    try {
      addLog("🌱 Minting new Forest Parcel...");
      const { forestNFT } = await getContracts(roles.worker);
      const tx = await forestNFT.mintForest(roles.worker, "ipfs://new-parcel");
      await tx.wait();
      addLog(`✅ New parcel planted!`);
      await loadParcels();
    } catch (e: any) {
      addLog(`❌ Mint failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = Number(fd.get("parcelId"));
    const amt = fd.get("amount") as string;
    const target = Number(fd.get("targetNDVI"));

    setLoading(true);
    try {
      addLog(`💰 Sponsoring Parcel #${id} with ${amt} USDC...`);
      const { mockUSDC, escrow } = await getContracts(roles.sponsor);
      
      const parsedAmt = ethers.parseUnits(amt, 18);
      
      const appTx = await mockUSDC.approve(ContractData.MEWEscrow.address, parsedAmt);
      await appTx.wait();

      const tx = await escrow.depositFunds(id, roles.worker, parsedAmt, target);
      await tx.wait();

      addLog(`✅ Funded Parcel #${id} successfully!`);
      await loadParcels();
      e.currentTarget.reset();
    } catch (e: any) {
      addLog(`❌ Fund failed: ${e.message}`);
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
        
        <nav className="nav-menu animate-in" style={{animationDelay: '0.1s'}}>
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
      <div className="stats-strip animate-in" style={{animationDelay: '0.2s'}}>
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
          <div className="stat-inner" style={{justifyContent: 'center', gap: '0.75rem'}}>
            <div className="stat-label" style={{textAlign: 'center'}}>Active Role</div>
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

      <main className="main-layout animate-in" style={{animationDelay: '0.3s'}}>
        
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
              simMonthsPassed={simMonthsPassed} 
              onStartSim={(id) => { setSimActiveForId(id); setSimMonthsPassed(0); }}
              onStopSim={() => { setSimActiveForId(null); setSimMonthsPassed(0); }}
            />
          )}
        </div>

        {/* RIGHT AREA: ACTIVITY LOG */}
        <LogsPanel logs={logs} />
      </main>
    </>
  );
}
