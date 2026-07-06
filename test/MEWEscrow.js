import pkg from 'chai';
const { expect } = pkg;
import hre from "hardhat";
const { ethers } = hre;

describe("MEW Escrow Lifecycle", function () {
  let mockUSDC, mockOracle, forestNFT, escrow;
  let deployer, sponsor, worker;

  beforeEach(async function () {
    [deployer, sponsor, worker] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy MockNDVIOracle
    const MockNDVIOracle = await ethers.getContractFactory("MockNDVIOracle");
    mockOracle = await MockNDVIOracle.deploy();
    await mockOracle.waitForDeployment();

    // Deploy ForestNFT
    const ForestNFT = await ethers.getContractFactory("ForestNFT");
    forestNFT = await ForestNFT.deploy();
    await forestNFT.waitForDeployment();

    // Deploy Escrow
    const MEWEscrow = await ethers.getContractFactory("MEWEscrow");
    escrow = await MEWEscrow.deploy(
      await mockUSDC.getAddress(),
      await mockOracle.getAddress(),
      await forestNFT.getAddress()
    );
    await escrow.waitForDeployment();

    // Transfer ownership of NFT contract to Escrow so it can update state
    await forestNFT.transferOwnership(await escrow.getAddress());
  });

  it("should complete the full lifecycle successfully", async function () {
    const depositAmount = ethers.parseUnits("1000", 18);
    const targetNDVI = 800; // out of 1000

    // 1. Worker mints NFT (Parcel) with details
    await forestNFT.connect(worker).mintForest(
      worker.address,
      "ipfs://mock-uri",
      "Test Parcel Alpha",
      "43.3438, 17.8078",
      2500 // area in m²
    );
    const tokenId = 0; // First token minted

    // Verify parcel details stored on-chain
    const details = await forestNFT.parcelDetails(tokenId);
    expect(details.name).to.equal("Test Parcel Alpha");
    expect(details.location).to.equal("43.3438, 17.8078");
    expect(details.area).to.equal(2500);

    // 2. Mint USDC to sponsor and approve escrow
    await mockUSDC.mint(sponsor.address, depositAmount);
    await mockUSDC.connect(sponsor).approve(await escrow.getAddress(), depositAmount);

    // 3. Sponsor deposits funds (Phase 1)
    const upfrontAmount = (depositAmount * 30n) / 100n;
    await expect(escrow.connect(sponsor).depositFunds(tokenId, worker.address, depositAmount, targetNDVI))
      .to.emit(escrow, "FundsDeposited")
      .withArgs(tokenId, sponsor.address, worker.address, depositAmount)
      .to.emit(escrow, "FundsReleased")
      .withArgs(tokenId, worker.address, upfrontAmount, 1);

    // Check escrow details
    const escrowData = await escrow.escrows(tokenId);
    expect(escrowData.totalAmount).to.equal(depositAmount);
    expect(escrowData.currentPhase).to.equal(1);

    // Verify Worker received 30% upfront
    let workerBalance = await mockUSDC.balanceOf(worker.address);
    expect(workerBalance).to.equal(upfrontAmount);

    // 4. Update Oracle with NDVI < 50% (should not change phase)
    await mockOracle.updateNDVIScore(tokenId, 300); // 300 < 400
    await escrow.checkMilestones(tokenId);
    
    let currentEscrow = await escrow.escrows(tokenId);
    expect(currentEscrow.currentPhase).to.equal(1); // Still Phase 1

    // 5. Update Oracle to >= 50% target (Phase 2)
    const phase2Amount = (depositAmount * 30n) / 100n;
    await mockOracle.updateNDVIScore(tokenId, 450); // 450 >= 400
    await expect(escrow.checkMilestones(tokenId))
      .to.emit(escrow, "FundsReleased")
      .withArgs(tokenId, worker.address, phase2Amount, 2);

    currentEscrow = await escrow.escrows(tokenId);
    expect(currentEscrow.currentPhase).to.equal(2);
    
    workerBalance = await mockUSDC.balanceOf(worker.address);
    expect(workerBalance).to.equal(upfrontAmount + phase2Amount);

    let nftState = await forestNFT.forestStates(tokenId);
    expect(nftState).to.equal(1); // ForestState.Growing

    // 6. Update Oracle to >= 100% target (Phase 3)
    const finalAmount = depositAmount - upfrontAmount - phase2Amount;
    await mockOracle.updateNDVIScore(tokenId, 850); // 850 >= 800
    await expect(escrow.checkMilestones(tokenId))
      .to.emit(escrow, "FundsReleased")
      .withArgs(tokenId, worker.address, finalAmount, 3);

    currentEscrow = await escrow.escrows(tokenId);
    expect(currentEscrow.currentPhase).to.equal(3);

    workerBalance = await mockUSDC.balanceOf(worker.address);
    expect(workerBalance).to.equal(depositAmount);

    nftState = await forestNFT.forestStates(tokenId);
    expect(nftState).to.equal(2); // ForestState.Verified
  });
});
